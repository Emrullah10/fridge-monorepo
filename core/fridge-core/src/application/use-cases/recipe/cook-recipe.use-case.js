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
      const itemsByProduct = new Map(items.map((item) => [item.productId, item]));

      for (const ingredient of ingredients) {
        const inventoryItem = itemsByProduct.get(ingredient.productId);
        if (!inventoryItem || inventoryItem.quantity <= 0) continue;

        const deltaQuantity = -Math.min(inventoryItem.quantity, ingredient.quantity);

        await inventoryItemRepo.adjustQuantity({ id: inventoryItem.id, deltaQuantity });
        await stockMovementRepo.create({
          householdId,
          inventoryItemId: inventoryItem.id,
          delta: deltaQuantity,
          reason: 'recipe_used',
          actorUserId: cookedBy,
        });
      }

      await recipeCookLogRepo.create({ householdId, recipeId, cookedBy });
    });

    return { recipeId, cookedBy };
  };
};

export { makeCookRecipe };
