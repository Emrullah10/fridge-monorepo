import { NotFoundError } from '@fridge/errors';

const makeUpdateInventoryItem = ({ inventoryItemRepo, stockMovementRepo }) => {
  return async ({ inventoryItemId, householdId, quantity, expiresAt, openedAt, note, actorUserId }) => {
    const item = await inventoryItemRepo.findById(inventoryItemId);
    if (!item || item.householdId !== householdId) {
      throw new NotFoundError('Inventory item not found');
    }

    const updated = await inventoryItemRepo.update(inventoryItemId, { quantity, expiresAt, openedAt, note });

    // Miktar elle değiştirildiyse denetim defterine yaz — "correction" sebebi
    // manuel/hatalı sayım düzeltmelerini receipt/consumed'dan ayırt eder.
    if (quantity !== undefined && quantity !== item.quantity) {
      await stockMovementRepo.create({
        householdId,
        inventoryItemId,
        delta: quantity - item.quantity,
        reason: 'correction',
        actorUserId,
      });
    }

    return updated;
  };
};

export { makeUpdateInventoryItem };
