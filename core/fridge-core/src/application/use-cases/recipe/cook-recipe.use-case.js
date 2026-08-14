// Tarif pişirildiğinde malzemeler stock_movement'a 'recipe_used' sebebiyle
// düşülür. Sadece mevcut stoktaki miktar kadar düşülür — eksik malzeme
// varsa o kalem atlanır, kullanıcı zaten dolapta olmayanı kullanamaz.
const makeCookRecipe = ({
  datasource,
  recipeRepo,
  makeInventoryItemRepo,
  makeStockMovementRepo,
  makeRecipeCookLogRepo,
}) => {
  return async ({ recipeId, householdId, cookedBy }) => {
    const ingredients = await recipeRepo.listIngredients(recipeId);

    await datasource.withTransaction(async ({ query }) => {
      const inventoryItemRepo = makeInventoryItemRepo({ rawQuery: query });
      const stockMovementRepo = makeStockMovementRepo({ rawQuery: query });
      const recipeCookLogRepo = makeRecipeCookLogRepo({ rawQuery: query });

      const items = await inventoryItemRepo.listByHousehold(householdId);
      // Aynı ürün birden fazla lokasyon/SKT'de ayrı satır olarak durabilir
      // (bkz. inventory_item UNIQUE kısıtı) — hepsini grupluyoruz ki
      // sadece sonuncusu değil, ürünün TÜM stoku görülsün.
      const itemsByProduct = new Map();
      for (const item of items) {
        const list = itemsByProduct.get(item.productId) ?? [];
        list.push(item);
        itemsByProduct.set(item.productId, list);
      }

      for (const ingredient of ingredients) {
        const candidates = (itemsByProduct.get(ingredient.productId) ?? [])
          // Birim uyuşmazlığında (örn. tarif "gram" istiyor, envanterde
          // "kilogram" var) o satırı sessizce yanlış düşürmek yerine atlıyoruz
          // — birim dönüşümü yapmadan miktarları karıştırmak veri bozar.
          .filter((item) => item.unit === ingredient.unit && item.quantity > 0);

        let remaining = ingredient.quantity;
        for (const inventoryItem of candidates) {
          if (remaining <= 0) break;
          const deltaQuantity = -Math.min(inventoryItem.quantity, remaining);
          remaining += deltaQuantity; // deltaQuantity negatif, yani remaining azalır

          await inventoryItemRepo.adjustQuantity({ id: inventoryItem.id, deltaQuantity });
          await stockMovementRepo.create({
            householdId,
            inventoryItemId: inventoryItem.id,
            delta: deltaQuantity,
            reason: 'recipe_used',
            actorUserId: cookedBy,
          });
        }
      }

      await recipeCookLogRepo.create({ householdId, recipeId, cookedBy });
    });

    return { recipeId, cookedBy };
  };
};

export { makeCookRecipe };
