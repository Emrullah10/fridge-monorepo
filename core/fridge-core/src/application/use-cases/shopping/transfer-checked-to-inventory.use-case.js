import { ValidationError } from '@fridge/errors';

// İşaretli alışveriş kalemlerini envantere yazar ("aldıklarımı dolaba
// aktar"). cook-recipe.use-case.js'teki transaction kalıbını izler:
// datasource.withTransaction ile tek client üzerinden tüm repo'lar açılır.
const makeTransferCheckedToInventory = ({
  datasource,
  shoppingListRepo,
  makeProductRepo,
  makeInventoryItemRepo,
  makeStockMovementRepo,
}) => {
  return async ({ householdId, storageLocationId, expiresAt = null, actorUserId }) => {
    if (!storageLocationId) {
      throw new ValidationError('Hedef bölüm (storageLocationId) gerekli');
    }

    const list = await shoppingListRepo.getOrCreateActiveList({ householdId, userId: actorUserId });
    const checkedItems = await shoppingListRepo.listCheckedItems(list.id);
    if (checkedItems.length === 0) {
      return { transferred: 0, items: [] };
    }

    const transferred = await datasource.withTransaction(async ({ query }) => {
      const productRepo = makeProductRepo({ rawQuery: query });
      const inventoryItemRepo = makeInventoryItemRepo({ rawQuery: query });
      const stockMovementRepo = makeStockMovementRepo({ rawQuery: query });
      const results = [];

      for (const item of checkedItems) {
        let productId = item.productId;
        // Serbest metin kalemler (product_id NULL) için önce bir ürün
        // yaratılır — envanter tablosu product_id'yi zorunlu tutuyor.
        if (!productId) {
          const product = await productRepo.create({
            householdId,
            canonicalName: item.name,
            defaultUnit: item.unit,
            source: 'user',
          });
          productId = product.id;
        }

        const inventoryItem = await inventoryItemRepo.upsertQuantity({
          householdId,
          storageLocationId,
          productId,
          unit: item.unit,
          expiresAt,
          deltaQuantity: item.quantity,
        });

        await stockMovementRepo.create({
          householdId,
          inventoryItemId: inventoryItem.id,
          delta: item.quantity,
          reason: 'manual_add',
          actorUserId,
        });

        results.push(inventoryItem);
      }

      return results;
    });

    // İşaretli kalemler artık dolapta — listeden temizle.
    await shoppingListRepo.clearChecked(list.id);

    return { transferred: transferred.length, items: transferred };
  };
};

export { makeTransferCheckedToInventory };
