const makeSuggestShoppingItems = ({ shoppingListRepo }) => {
  return async ({ householdId, userId }) => {
    const list = await shoppingListRepo.getOrCreateActiveList({ householdId, userId });
    return shoppingListRepo.suggestLowStock({ householdId, shoppingListId: list.id });
  };
};

export { makeSuggestShoppingItems };
