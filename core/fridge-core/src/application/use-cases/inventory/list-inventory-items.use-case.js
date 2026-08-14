const makeListInventoryItems = ({ inventoryItemRepo }) => {
  return async ({ householdId, storageLocationId }) => {
    return inventoryItemRepo.listByHousehold(householdId, { storageLocationId });
  };
};

export { makeListInventoryItems };
