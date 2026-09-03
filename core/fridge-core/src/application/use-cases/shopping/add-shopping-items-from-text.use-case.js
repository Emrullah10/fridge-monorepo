import { ValidationError } from '@fridge/errors';

// "bu hafta 4 kişilik kahvaltılık lazım" gibi serbest metinden alışveriş
// önerisi üretir. Tüketim geçmişi gerektirmez (suggest-ai-shopping-items'ın
// aksine), yeni kullanıcıda da çalışır. Aynı şekilde listeye doğrudan
// yazmaz — yalnızca öneri döndürür, kullanıcı dokununca eklenir.
const MAX_SUGGESTIONS = 10;

const makeAddShoppingItemsFromText = ({ inventoryItemRepo, shoppingSuggesterPort }) => {
  return async ({ householdId, text, userId = null, isGuest = false }) => {
    if (!text?.trim()) {
      throw new ValidationError('İstek metni boş olamaz');
    }

    const inventoryItems = await inventoryItemRepo.listByHousehold(householdId);
    const inventorySummary = inventoryItems.map((item) => ({ name: item.productName }));

    const { suggestions } = await shoppingSuggesterPort.fromText({
      text: text.trim(),
      inventorySummary,
      context: { userId, householdId, isGuest },
    });

    return {
      suggestions: suggestions
        .filter((s) => s.name?.trim())
        .map((s) => ({ ...s, productId: null }))
        .slice(0, MAX_SUGGESTIONS),
    };
  };
};

export { makeAddShoppingItemsFromText };
