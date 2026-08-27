import { NotFoundError } from '@fridge/errors';
import { matchRecipeIngredients } from '../../../domain/ingredient-match.js';

// Tarifteki eksik/kısmi/birim-uyuşmayan malzemeleri alışveriş listesine
// ekler. Zaten listede olan ürün varsa yeni satır açmak yerine miktarı
// artırır (bkz. shoppingListRepo.findItemByProduct — add-shopping-item ile
// aynı davranış).
const makeAddRecipeMissingToList = ({ recipeRepo, inventoryItemRepo, shoppingListRepo }) => {
  return async ({ recipeId, householdId, userId }) => {
    const recipe = await recipeRepo.findById(recipeId);
    if (!recipe || (recipe.householdId !== null && recipe.householdId !== householdId)) {
      throw new NotFoundError('Recipe not found');
    }

    const ingredients = await recipeRepo.listIngredients(recipeId);
    const inventoryItems = await inventoryItemRepo.listByHousehold(householdId);
    const matched = matchRecipeIngredients(ingredients, inventoryItems);

    const missing = matched.filter((i) => !i.isOptional && i.matchStatus !== 'available');
    if (missing.length === 0) return { added: 0, items: [] };

    const list = await shoppingListRepo.getOrCreateActiveList({ householdId, userId });
    const addedItems = [];

    for (const ingredient of missing) {
      const neededQuantity = Math.max(ingredient.quantity - ingredient.availableQuantity, ingredient.quantity);
      // productId null olabilir (tarif AI'ı artık eşleşmeyen malzeme için
      // yeni product yaratmıyor, bkz. generate-ai-recipes.use-case.js) —
      // bu durumda customName ile serbest metin satırı açılır, mevcut ürün
      // arama/artırma (findItemByProduct) atlanır.
      const existing = ingredient.productId
        ? await shoppingListRepo.findItemByProduct({ shoppingListId: list.id, productId: ingredient.productId })
        : null;
      if (existing) {
        addedItems.push(await shoppingListRepo.incrementQuantity({ id: existing.id, deltaQuantity: neededQuantity }));
      } else {
        addedItems.push(await shoppingListRepo.addItem({
          shoppingListId: list.id,
          productId: ingredient.productId,
          customName: ingredient.productId ? null : ingredient.productName,
          quantity: neededQuantity,
          unit: ingredient.unit,
          source: 'recipe',
          addedBy: userId,
          note: recipe.title,
        }));
      }
    }

    return { added: addedItems.length, items: addedItems };
  };
};

export { makeAddRecipeMissingToList };
