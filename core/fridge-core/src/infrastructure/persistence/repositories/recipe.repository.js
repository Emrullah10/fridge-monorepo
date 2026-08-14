const mapRow = (row) => row && ({
  id: row.id,
  householdId: row.household_id,
  title: row.title,
  description: row.description,
  instructions: row.instructions,
  servings: row.servings,
  prepMinutes: row.prep_minutes,
  cookMinutes: row.cook_minutes,
  sourceUrl: row.source_url,
  createdBy: row.created_by,
});

const makeRecipeRepository = ({ rawQuery }) => {
  return {
    findById: async (id) => {
      const { rows } = await rawQuery('SELECT * FROM recipe WHERE id = $1', [id]);
      return mapRow(rows[0]);
    },

    create: async ({ householdId = null, title, description = null, instructions, servings = null, prepMinutes = null, cookMinutes = null, sourceUrl = null, createdBy }) => {
      const { rows } = await rawQuery(
        `INSERT INTO recipe (household_id, title, description, instructions, servings, prep_minutes, cook_minutes, source_url, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [householdId, title, description, instructions, servings, prepMinutes, cookMinutes, sourceUrl, createdBy],
      );
      return mapRow(rows[0]);
    },

    addIngredient: async ({ recipeId, productId, quantity, unit, isOptional = false }) => {
      await rawQuery(
        `INSERT INTO recipe_ingredient (recipe_id, product_id, quantity, unit, is_optional)
         VALUES ($1, $2, $3, $4, $5)`,
        [recipeId, productId, quantity, unit, isOptional],
      );
    },

    listIngredients: async (recipeId) => {
      const { rows } = await rawQuery(
        `SELECT * FROM recipe_ingredient WHERE recipe_id = $1`,
        [recipeId],
      );
      return rows.map((row) => ({
        id: row.id,
        recipeId: row.recipe_id,
        productId: row.product_id,
        quantity: Number(row.quantity),
        unit: row.unit,
        isOptional: row.is_optional,
      }));
    },

    // "Dolabımdakilerle ne pişirebilirim": recipe_ingredient ⋈ inventory_item.
    // Eksik malzeme sayısına göre sıralar — 0 eksik olanlar en üstte.
    listSuggestionsForHousehold: async (householdId) => {
      const { rows } = await rawQuery(
        `SELECT
           r.id, r.title, r.description, r.servings, r.prep_minutes, r.cook_minutes,
           COUNT(ri.id) AS total_ingredients,
           COUNT(inv.id) AS available_ingredients,
           COUNT(ri.id) - COUNT(inv.id) AS missing_count
         FROM recipe r
         JOIN recipe_ingredient ri ON ri.recipe_id = r.id
         LEFT JOIN inventory_item inv
           ON inv.product_id = ri.product_id
          AND inv.household_id = $1
          AND inv.quantity > 0
         WHERE r.household_id IS NULL OR r.household_id = $1
         GROUP BY r.id
         ORDER BY missing_count ASC, total_ingredients DESC`,
        [householdId],
      );
      return rows.map((row) => ({
        ...mapRow(row),
        totalIngredients: Number(row.total_ingredients),
        availableIngredients: Number(row.available_ingredients),
        missingCount: Number(row.missing_count),
      }));
    },
  };
};

export { makeRecipeRepository };
