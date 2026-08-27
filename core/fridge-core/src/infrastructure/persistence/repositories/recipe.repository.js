import { matchRecipeIngredients, summarizeMatch } from '../../../domain/ingredient-match.js';

const mapRow = (row) => row && ({
  id: row.id,
  householdId: row.household_id,
  title: row.title,
  description: row.description,
  instructions: row.instructions,
  steps: row.steps ?? null,
  servings: row.servings,
  prepMinutes: row.prep_minutes,
  cookMinutes: row.cook_minutes,
  sourceUrl: row.source_url,
  createdBy: row.created_by,
  generatedBy: row.generated_by,
});

const makeRecipeRepository = ({ rawQuery }) => {
  return {
    findById: async (id) => {
      const { rows } = await rawQuery('SELECT * FROM recipe WHERE id = $1', [id]);
      return mapRow(rows[0]);
    },

    create: async ({ householdId = null, title, description = null, instructions, steps = null, servings = null, prepMinutes = null, cookMinutes = null, sourceUrl = null, createdBy, generatedBy = 'user' }) => {
      const { rows } = await rawQuery(
        `INSERT INTO recipe (household_id, title, description, instructions, steps, servings, prep_minutes, cook_minutes, source_url, created_by, generated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [householdId, title, description, instructions, steps ? JSON.stringify(steps) : null, servings, prepMinutes, cookMinutes, sourceUrl, createdBy, generatedBy],
      );
      return mapRow(rows[0]);
    },

    update: async (id, { title, description, instructions, steps, servings, prepMinutes, cookMinutes, sourceUrl }) => {
      const { rows } = await rawQuery(
        `UPDATE recipe SET
           title = COALESCE($2, title),
           description = CASE WHEN $3::boolean THEN $4 ELSE description END,
           instructions = COALESCE($5, instructions),
           steps = CASE WHEN $6::boolean THEN $7::jsonb ELSE steps END,
           servings = CASE WHEN $8::boolean THEN $9 ELSE servings END,
           prep_minutes = CASE WHEN $10::boolean THEN $11 ELSE prep_minutes END,
           cook_minutes = CASE WHEN $12::boolean THEN $13 ELSE cook_minutes END,
           source_url = CASE WHEN $14::boolean THEN $15 ELSE source_url END
         WHERE id = $1 RETURNING *`,
        [
          id, title ?? null,
          description !== undefined, description ?? null,
          instructions ?? null,
          steps !== undefined, steps ? JSON.stringify(steps) : null,
          servings !== undefined, servings ?? null,
          prepMinutes !== undefined, prepMinutes ?? null,
          cookMinutes !== undefined, cookMinutes ?? null,
          sourceUrl !== undefined, sourceUrl ?? null,
        ],
      );
      return mapRow(rows[0]);
    },

    delete: async (id) => {
      await rawQuery('DELETE FROM recipe WHERE id = $1', [id]);
    },

    listByHousehold: async (householdId) => {
      const { rows } = await rawQuery(
        `SELECT * FROM recipe WHERE household_id IS NULL OR household_id = $1 ORDER BY created_at DESC`,
        [householdId],
      );
      return rows.map(mapRow);
    },

    // productId null olabilir — AI tarif üretimi artık eşleşmeyen malzeme
    // için yeni bir product yaratmıyor (katalog kirlenmesin diye, bkz.
    // 13-recipe-ingredient-custom-name.sql), bunun yerine customName ile
    // serbest metin olarak kaydediyor. shopping_list_item'daki desenin aynısı.
    addIngredient: async ({ recipeId, productId = null, customName = null, quantity, unit, isOptional = false }) => {
      await rawQuery(
        `INSERT INTO recipe_ingredient (recipe_id, product_id, custom_name, quantity, unit, is_optional)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [recipeId, productId, customName, quantity, unit, isOptional],
      );
    },

    // productName: LEFT JOIN product (productId null olabilir artık) +
    // custom_name fallback. Önceden bare productId dönüyordu, UI ürün adı
    // için ayrı istek atmak zorunda kalıyordu.
    listIngredients: async (recipeId) => {
      const { rows } = await rawQuery(
        `SELECT ri.*, p.canonical_name, p.nutrition
         FROM recipe_ingredient ri
         LEFT JOIN product p ON p.id = ri.product_id
         WHERE ri.recipe_id = $1`,
        [recipeId],
      );
      return rows.map((row) => ({
        id: row.id,
        recipeId: row.recipe_id,
        productId: row.product_id,
        productName: row.canonical_name ?? row.custom_name,
        quantity: Number(row.quantity),
        unit: row.unit,
        isOptional: row.is_optional,
        // 100g/100ml başına {kcal, protein, carb, fat, basis} — null olabilir.
        nutrition: row.nutrition ?? null,
      }));
    },

    // "Dolabımdakilerle ne pişirebilirim": eşleştirme SQL'de JOIN ile değil,
    // domain/ingredient-match.js'te (app tarafında) yapılıyor. Bir ürünün
    // birden fazla inventory_item satırı olabildiği için (farklı lokasyon/
    // SKT) SQL'de COUNT(ri.id) - COUNT(inv.id) yaklaşımı LEFT JOIN satır
    // çoğalmasından dolayı NEGATİF missing_count üretebiliyordu — aynı
    // matematiği burada tekrarlamak yerine tek doğruluk kaynağını
    // (matchRecipeIngredients) çağırıyoruz.
    listSuggestionsForHousehold: async (householdId) => {
      const { rows: recipeRows } = await rawQuery(
        `SELECT DISTINCT r.*
         FROM recipe r
         JOIN recipe_ingredient ri ON ri.recipe_id = r.id
         WHERE r.household_id IS NULL OR r.household_id = $1`,
        [householdId],
      );
      if (recipeRows.length === 0) return [];

      const { rows: invRows } = await rawQuery(
        `SELECT product_id, unit, quantity FROM inventory_item WHERE household_id = $1 AND quantity > 0`,
        [householdId],
      );
      const inventoryItems = invRows.map((row) => ({
        productId: row.product_id,
        unit: row.unit,
        quantity: Number(row.quantity),
      }));

      const results = [];
      for (const row of recipeRows) {
        const recipe = mapRow(row);
        const { rows: ingredientRows } = await rawQuery(
          `SELECT * FROM recipe_ingredient WHERE recipe_id = $1`,
          [recipe.id],
        );
        const ingredients = ingredientRows.map((ing) => ({
          productId: ing.product_id,
          quantity: Number(ing.quantity),
          unit: ing.unit,
          isOptional: ing.is_optional,
        }));
        const matched = matchRecipeIngredients(ingredients, inventoryItems);
        const summary = summarizeMatch(matched);
        results.push({ ...recipe, ...summary });
      }

      results.sort((a, b) => a.missingCount - b.missingCount || b.totalIngredients - a.totalIngredients);
      return results;
    },
  };
};

export { makeRecipeRepository };
