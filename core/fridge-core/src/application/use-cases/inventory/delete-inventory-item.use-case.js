import { NotFoundError } from '@fridge/errors';

const makeDeleteInventoryItem = ({ inventoryItemRepo, stockMovementRepo }) => {
  return async ({ inventoryItemId, householdId, actorUserId, reason = 'discarded' }) => {
    const item = await inventoryItemRepo.findById(inventoryItemId);
    if (!item || item.householdId !== householdId) {
      throw new NotFoundError('Inventory item not found');
    }

    // Silmeden önce denetim defterine son hareketi yaz — yoksa "bu ürün
    // nereye gitti" sorusu stock_movement'ta cevapsız kalır.
    if (item.quantity > 0) {
      await stockMovementRepo.create({
        householdId,
        inventoryItemId,
        delta: -item.quantity,
        reason,
        actorUserId,
      });
    }

    await inventoryItemRepo.delete(inventoryItemId);
  };
};

export { makeDeleteInventoryItem };
