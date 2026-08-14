const makeSuggestRecipes = ({ recipeRepo }) => {
  return async ({ householdId }) => {
    return recipeRepo.listSuggestionsForHousehold(householdId);
  };
};

export { makeSuggestRecipes };
