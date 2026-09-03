// Tüketim ritmine dayalı alışveriş önerisi. Mevcut suggest-shopping-items
// (saf SQL heuristik, "biten ürün") dokunulmadan kalır — bu AI yolu ayrı,
// açık kullanıcı jestiyle (POST /suggestions/ai) çağrılır, otomatik değil.
//
// AI listeye hiçbir zaman doğrudan yazmaz — yalnızca öneri döndürür.
// Kullanıcı bir öneriye dokununca normal addShoppingItem use-case'i
// source: 'ai_suggestion' ile çağrılır. Böylece bir halüsinasyon listeyi
// kalıcı olarak kirletemez.
const MAX_SUGGESTIONS = 8;

const makeSuggestAiShoppingItems = ({ shoppingListRepo, shoppingSuggesterPort }) => {
  return async ({ householdId, userId, isGuest = false }) => {
    const list = await shoppingListRepo.getOrCreateActiveList({ householdId, userId });
    const profile = await shoppingListRepo.consumptionProfile({ householdId, shoppingListId: list.id });

    // Yeterli tüketim geçmişi yoksa (yeni ev, az veri) AI'ı hiç çağırma —
    // boşuna para harcanmasın, mevcut low_stock önerisine düş.
    if (profile.length === 0) {
      const lowStock = await shoppingListRepo.suggestLowStock({ householdId, shoppingListId: list.id });
      return { suggestions: lowStock };
    }

    const knownProductIds = new Set(profile.map((item) => item.productId));
    const { suggestions } = await shoppingSuggesterPort.suggest({
      profile,
      context: { userId, householdId, isGuest },
    });

    // Sunucu tarafı doğrulama — model verilmeyen bir productId uydurursa
    // (halüsinasyon) yeni ürün önerisi gibi ele al, kırık bir id gönderme.
    return {
      suggestions: suggestions
        .filter((s) => s.name?.trim())
        .map((s) => ({
          ...s,
          productId: s.productId && knownProductIds.has(s.productId) ? s.productId : null,
        }))
        .slice(0, MAX_SUGGESTIONS),
    };
  };
};

export { makeSuggestAiShoppingItems };
