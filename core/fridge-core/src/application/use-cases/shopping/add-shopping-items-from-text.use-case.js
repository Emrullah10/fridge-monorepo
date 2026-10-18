import { ValidationError } from '@fridge/errors';

// "bu hafta 4 kişilik kahvaltılık lazım" gibi serbest metinden alışveriş
// önerisi üretir. Tüketim geçmişi gerektirmez (suggest-ai-shopping-items'ın
// aksine), yeni kullanıcıda da çalışır. Aynı şekilde listeye doğrudan
// yazmaz — yalnızca öneri döndürür, kullanıcı dokununca eklenir.
const MAX_SUGGESTIONS = 10;
const VALID_UNITS = new Set(['piece', 'gram', 'kilogram', 'milliliter', 'liter', 'package']);

// Model şemayı her zaman tutmaz (eksik/enum dışı unit, string miktar) — istemci
// katı tip dönüşümü yaptığı için burada güvenli varsayılanlara indirgenir.
const normalizeSuggestion = (s) => {
  const quantity = Number(s.quantity);
  return {
    ...s,
    name: s.name.trim(),
    unit: VALID_UNITS.has(s.unit) ? s.unit : 'piece',
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    productId: null,
  };
};

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
      householdId,
    });

    return {
      suggestions: suggestions
        .filter((s) => typeof s?.name === 'string' && s.name.trim())
        .map(normalizeSuggestion)
        .slice(0, MAX_SUGGESTIONS),
    };
  };
};

export { makeAddShoppingItemsFromText };
