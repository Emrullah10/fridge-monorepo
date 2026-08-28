/**
 * @typedef {Object} ChefMessage
 * @property {string} id
 * @property {'user'|'assistant'} role
 * @property {string} text
 * @property {string[]} [suggestedAddToList]
 */

/** @type {ChefMessage[]} — 6 mesajlık sohbet, biri "listeye ekle?" aksiyonlu */
export const chef = [
  { id: 'c-1', role: 'user', text: 'Bugün ne pişirsem, dolapta ne var?' },
  {
    id: 'c-2',
    role: 'assistant',
    text: 'Dolabında tavuk göğsü ve karışık sebzen var — Tavuklu Sebze Sote yapabilirsin. Sarımsak ve soya sosu eksik görünüyor.',
  },
  { id: 'c-3', role: 'user', text: 'Onları da alışveriş listesine ekler misin?' },
  {
    id: 'c-4',
    role: 'assistant',
    text: 'Tabii, ikisini de listene ekliyorum.',
    suggestedAddToList: ['Sarımsak', 'Soya Sosu'],
  },
  { id: 'c-5', role: 'user', text: 'Peki mercimek çorbası için ne eksik?' },
  {
    id: 'c-6',
    role: 'assistant',
    text: 'Sadece havuç eksik, gerisi dolabında hazır.',
  },
];
