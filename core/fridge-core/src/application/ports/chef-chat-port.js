// reply({ history, kitchen }) -> { reply, suggestedShoppingItems }
//
// history: [{ role: 'user'|'assistant', content }] — sohbet geçmişi, en yeni
//   mesaj (kullanıcının yeni sorusu) sonda.
// kitchen: {
//   inventory: [{ name, brand, quantity, unit, categoryKey, expiresAt }],
//   expiringSoon: [{ name, expiresAt, daysLeft }],
//   shoppingList: [{ name }],
//   recentlyCooked: [{ title, cookedAt }],
// }
//
// Dönüş:
//   reply: string — kullanıcıya gösterilecek Türkçe cevap
//   suggestedShoppingItems: [{ name, quantity, unit, reasonText }] — model
//     "şunu da alman lazım" derse; ASLA doğrudan listeye yazılmaz, kullanıcı
//     çipe basınca add-shopping-item normal yoldan çağrılır (halüsinasyon
//     savunması, suggest-ai-shopping-items deseni). Boş dizi olabilir.
export {};
