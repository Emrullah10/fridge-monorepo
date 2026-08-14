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
  };
};

export { makeRecipeCookLogRepository };
