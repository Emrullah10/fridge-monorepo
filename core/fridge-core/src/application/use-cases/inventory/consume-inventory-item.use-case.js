import { NotFoundError } from '@fridge/errors';
import { InsufficientStockError } from '../../../domain/errors/index.js';

const makeConsumeInventoryItem = ({ inventoryItemRepo, stockMovementRepo, productRepo }) => {
  return async ({ inventoryItemId, quantity, actorUserId, reason = 'consumed' }) => {
    const item = await inventoryItemRepo.findById(inventoryItemId);
    if (!item) {
      throw new NotFoundError('Inventory item not found');
    }

    if (item.quantity < quantity) {
      const product = await productRepo.findById(item.productId);
      throw new InsufficientStockError(product?.canonicalName ?? item.productId);
    }

    const updated = await inventoryItemRepo.adjustQuantity({ id: item.id, deltaQuantity: -quantity });

    await stockMovementRepo.create({
      householdId: item.householdId,
      inventoryItemId: item.id,
      delta: -quantity,
      reason,
      actorUserId,
    });

    return updated;
  };
};

export { makeConsumeInventoryItem };
