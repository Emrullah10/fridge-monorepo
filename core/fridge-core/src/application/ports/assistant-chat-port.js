// reply({ history, area, mode, foodEnabled, areaName, areaKind, context })
//   -> { reply, suggestedShoppingItems, conversationTitle, modeMismatch, guide }
//
// chef-chat-port.js'in genellemesi (bkz. plan §B).
//
// history: [{ role: 'user'|'assistant', content }] — sohbet geçmişi, en yeni
//   mesaj (kullanıcının yeni sorusu) sonda.
// area: null (alansız sohbet) | {
//   inventory: [{ name, brand, quantity, unit, categoryKey, expiresAt }],
//   expiringSoon: [{ name, expiresAt, daysLeft }],
//   shoppingList: [{ name }],
//   recentlyCooked: [{ title, cookedAt }],   -- yalnızca foodEnabled
//   diet: { allergens, diets } | null,        -- yalnızca foodEnabled
// }
// mode: 'food' | 'repair' | 'general'
// foodEnabled: boolean — alanın yemek özelliği açık mı
// areaName/areaKind: alan adı/türü (prompt'a bağlam olarak girer)
//
// Dönüş:
//   reply: string — kullanıcıya gösterilecek Türkçe cevap
//   suggestedShoppingItems: [{ name, quantity, unit, reasonText }] — ASLA
//     doğrudan listeye yazılmaz, kullanıcı çipe basınca add-shopping-item
//     normal yoldan çağrılır. Boş dizi olabilir.
//   conversationTitle: string | null — sohbetin ilk mesajında üretilir
//   modeMismatch: 'food'|'repair'|'general'|null — seçili modla uyuşmuyorsa
//   guide: { kind, title, servings?, prepMinutes?, cookMinutes?, materials, steps } | null
export {};
