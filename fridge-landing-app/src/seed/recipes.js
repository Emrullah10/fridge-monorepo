/**
 * @typedef {Object} RecipeIngredient
 * @property {string} name
 * @property {boolean} have
 * @property {string} [quantity]
 * @typedef {Object} Recipe
 * @property {string} id
 * @property {string} title
 * @property {string} imageEmoji
 * @property {number} minutes
 * @property {number} servings
 * @property {RecipeIngredient[]} ingredients
 * @property {number} missingCount
 * @property {string[]} steps
 */

/** @type {Recipe[]} — 4 tarif, biri 2 eksik malzemeli */
export const recipes = [
  {
    id: 're-1',
    title: 'Domates Soslu Makarna',
    imageEmoji: '🍝',
    minutes: 25,
    servings: 3,
    ingredients: [
      { name: 'Makarna', have: true, quantity: '300 g' },
      { name: 'Domates', have: true, quantity: '3 adet' },
      { name: 'Salça', have: true, quantity: '1 kaşık' },
      { name: 'Zeytinyağı', have: true, quantity: '2 kaşık' },
      { name: 'Soğan', have: true, quantity: '1 adet' },
    ],
    missingCount: 0,
    steps: [
      'Soğanı ince doğrayıp zeytinyağında kavurun.',
      'Salçayı ekleyip 2 dakika kavurmaya devam edin.',
      'Doğranmış domatesleri ekleyip 10 dakika pişirin.',
      'Makarnayı ayrı kaynar suda haşlayıp sosla karıştırın.',
    ],
  },
  {
    id: 're-2',
    title: 'Tavuklu Sebze Sote',
    imageEmoji: '🍗',
    minutes: 30,
    servings: 4,
    ingredients: [
      { name: 'Tavuk Göğsü', have: true, quantity: '500 g' },
      { name: 'Karışık Sebze', have: true, quantity: '400 g' },
      { name: 'Soya Sosu', have: false, quantity: '2 kaşık' },
      { name: 'Sarımsak', have: false, quantity: '2 diş' },
    ],
    missingCount: 2,
    steps: [
      'Tavuğu küp küp doğrayıp yüksek ateşte soteleyin.',
      'Sebzeleri ekleyip 5 dakika daha pişirin.',
      'Soya sosu ve sarımsağı ekleyip karıştırın.',
    ],
  },
  {
    id: 're-3',
    title: 'Basit Omlet',
    imageEmoji: '🍳',
    minutes: 10,
    servings: 1,
    ingredients: [
      { name: 'Yumurta', have: true, quantity: '3 adet' },
      { name: 'Tuz', have: true },
      { name: 'Tereyağı', have: true, quantity: '1 kaşık' },
    ],
    missingCount: 0,
    steps: [
      'Yumurtaları çırpıp tuz ekleyin.',
      'Tereyağını tavada eritip yumurtayı dökün.',
      'Orta ateşte 3-4 dakika pişirin.',
    ],
  },
  {
    id: 're-4',
    title: 'Mercimek Çorbası',
    imageEmoji: '🍲',
    minutes: 40,
    servings: 4,
    ingredients: [
      { name: 'Kırmızı Mercimek', have: true, quantity: '1 su bardağı' },
      { name: 'Soğan', have: true, quantity: '1 adet' },
      { name: 'Havuç', have: false, quantity: '1 adet' },
      { name: 'Tereyağı', have: true, quantity: '1 kaşık' },
    ],
    missingCount: 1,
    steps: [
      'Soğan ve havucu tereyağında kavurun.',
      'Mercimeği ekleyip su ile kaynatın.',
      'Mercimek yumuşayınca blenderdan geçirin.',
      'Tuz ekleyip servis edin.',
    ],
  },
];
