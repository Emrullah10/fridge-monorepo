const mapRow = (row) => row && ({
  id: row.id,
  householdId: row.household_id,
  recipeId: row.recipe_id,
  cookedBy: row.cooked_by,
  cookedAt: row.cooked_at,
});

const makeRecipeCookLogRepository = ({ rawQuery }) => {
  return {
    create: async ({ householdId, recipeId, cookedBy }) => {
      const { rows } = await rawQuery(
        `INSERT INTO recipe_cook_log (household_id, recipe_id, cooked_by) VALUES ($1, $2, $3) RETURNING *`,
        [householdId, recipeId, cookedBy],
      );
      return mapRow(rows[0]);
    },

    // "Son pişirdiklerim" — cook-recipe.use-case.js hep yazıyordu ama hiç
    // okunmuyordu.
    listByHousehold: async (householdId, { limit = 20 } = {}) => {
      const { rows } = await rawQuery(
        `SELECT log.*, r.title AS recipe_title
         FROM recipe_cook_log log
         JOIN recipe r ON r.id = log.recipe_id
         WHERE log.household_id = $1
         ORDER BY log.cooked_at DESC
         LIMIT $2`,
        [householdId, limit],
      );
      return rows.map((row) => ({ ...mapRow(row), recipeTitle: row.recipe_title }));
    },
  };
};

export { makeRecipeCookLogRepository };
