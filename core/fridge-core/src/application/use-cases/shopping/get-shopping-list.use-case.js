const makeGetShoppingList = ({ shoppingListRepo }) => {
  return async ({ householdId, userId }) => {
    const list = await shoppingListRepo.getOrCreateActiveList({ householdId, userId });
    const items = await shoppingListRepo.listItems(list.id);
    return { list, items };
  };
};

export { makeGetShoppingList };
