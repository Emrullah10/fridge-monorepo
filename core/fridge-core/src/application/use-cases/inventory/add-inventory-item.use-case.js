const makeAddInventoryItem = ({ inventoryItemRepo, stockMovementRepo }) => {
  return async ({ householdId, storageLocationId, productId, unit, quantity, expiresAt = null, actorUserId, unitPrice = undefined }) => {
    const item = await inventoryItemRepo.upsertQuantity({
      householdId,
      storageLocationId,
      productId,
      unit,
      expiresAt,
      deltaQuantity: quantity,
      unitPrice,
    });

    await stockMovementRepo.create({
      householdId,
      inventoryItemId: item.id,
      delta: quantity,
      reason: 'manual_add',
      actorUserId,
      unitPrice,
    });

    return item;
  };
};

export { makeAddInventoryItem };
