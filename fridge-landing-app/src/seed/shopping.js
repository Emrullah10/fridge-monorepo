/**
 * @typedef {Object} ShoppingItem
 * @property {string} id
 * @property {string} name
 * @property {string} [quantity]
 * @property {boolean} isChecked
 * @property {boolean} [isAiSuggested]
 */

/** @type {ShoppingItem[]} — 12 kalem (5 işaretli) + 3 AI önerisi */
export const shopping = [
  { id: 's-1', name: 'Süt', quantity: '1 lt', isChecked: true },
  { id: 's-2', name: 'Yumurta', quantity: '10\'lu', isChecked: true },
  { id: 's-3', name: 'Domates', quantity: '1 kg', isChecked: true },
  { id: 's-4', name: 'Ekmek', isChecked: true },
  { id: 's-5', name: 'Tuvalet Kağıdı', isChecked: true },
  { id: 's-6', name: 'Zeytinyağı', isChecked: false },
  { id: 's-7', name: 'Makarna', isChecked: false },
  { id: 's-8', name: 'Muz', quantity: '1 kg', isChecked: false },
  { id: 's-9', name: 'Bulaşık Deterjanı', isChecked: false },
  { id: 's-10', name: 'Kahve', isChecked: false },
  { id: 's-11', name: 'Peynir', quantity: '500 g', isChecked: false, isAiSuggested: true },
  { id: 's-12', name: 'Salatalık', isChecked: false, isAiSuggested: true },
  { id: 's-13', name: 'Tavuk Göğsü', quantity: '1 kg', isChecked: false, isAiSuggested: true },
];

/** @type {ShoppingItem[]} */
export const emptyShopping = [];
