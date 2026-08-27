import { ValidationError } from '@fridge/errors';

const makeAddShoppingItem = ({ shoppingListRepo }) => {
  return async ({ householdId, userId, productId = null, customName = null, quantity = 1, unit = 'piece', note = null, source = 'manual' }) => {
    if (!productId && !customName?.trim()) {
      throw new ValidationError('Ürün seçin veya bir isim girin');
    }

    const list = await shoppingListRepo.getOrCreateActiveList({ householdId, userId });

    if (productId) {
      const existing = await shoppingListRepo.findItemByProduct({ shoppingListId: list.id, productId });
      if (existing) {
        return shoppingListRepo.incrementQuantity({ id: existing.id, deltaQuantity: quantity });
      }
    }

    return shoppingListRepo.addItem({
      shoppingListId: list.id, productId, customName, quantity, unit, note, source, addedBy: userId,
    });
  };
};

export { makeAddShoppingItem };
