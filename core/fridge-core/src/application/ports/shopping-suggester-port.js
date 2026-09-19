// suggest({ profile, currentList }) -> { suggestions: [...] }
// profile: [{ productId, name, brand, categoryId, unit, onHand, totalConsumed,
//   eventCount, avgIntervalDays, daysSinceLast }] — bkz. shopping-list.repository.js
//   consumptionProfile()
// currentList: [{ productId, name }] — zaten aktif listede olanlar
//   (tekrar önerilmesin diye)
// Dönüş: suggestions -> { productId: string|null, name, quantity, unit,
//   reason: 'due_soon'|'ran_out'|'complementary', reasonText, confidence }

// fromText({ text, inventorySummary, householdId }) -> { suggestions: [...] }
// text: kullanıcının serbest metin isteği ("bu hafta 4 kişilik kahvaltılık lazım")
// inventorySummary: [{ name }] — elde olanı tekrar önermesin diye
// householdId: Faz 2 AI cache'inin key'ine girer (bkz. zai-shopping.adapter.js) —
//   cache özelliği kapalıysa/yoksa adaptör tarafından hiç okunmaz.
// Dönüş: aynı şekil, reason: 'user_request'

export {};
