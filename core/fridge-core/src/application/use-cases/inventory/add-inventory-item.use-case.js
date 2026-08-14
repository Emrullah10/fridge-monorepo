const makeAddInventoryItem = ({ inventoryItemRepo, stockMovementRepo }) => {
  return async ({ householdId, storageLocationId, productId, unit, quantity, expiresAt = null, actorUserId }) => {
    const item = await inventoryItemRepo.upsertQuantity({
      householdId,
      storageLocationId,
      productId,
      unit,
      expiresAt,
      deltaQuantity: quantity,
    });

    await stockMovementRepo.create({
      householdId,
      inventoryItemId: item.id,
      delta: quantity,
      reason: 'manual_add',
      actorUserId,
    });

    return item;
  };
};

export { makeAddInventoryItem };
