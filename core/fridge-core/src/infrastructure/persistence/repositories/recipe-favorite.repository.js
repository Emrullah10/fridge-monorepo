const makeRecipeFavoriteRepository = ({ rawQuery }) => {
  return {
    add: async ({ householdId, recipeId, userId }) => {
      await rawQuery(
        `INSERT INTO recipe_favorite (household_id, recipe_id, user_id)
         VALUES ($1, $2, $3) ON CONFLICT (recipe_id, user_id) DO NOTHING`,
        [householdId, recipeId, userId],
      );
    },

    remove: async ({ recipeId, userId }) => {
      await rawQuery('DELETE FROM recipe_favorite WHERE recipe_id = $1 AND user_id = $2', [recipeId, userId]);
    },

    listRecipeIdsForUser: async ({ householdId, userId }) => {
      const { rows } = await rawQuery(
        'SELECT recipe_id FROM recipe_favorite WHERE household_id = $1 AND user_id = $2',
        [householdId, userId],
      );
      return rows.map((row) => row.recipe_id);
    },
  };
};

export { makeRecipeFavoriteRepository };
