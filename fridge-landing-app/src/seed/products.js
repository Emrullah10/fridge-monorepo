/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} name
 * @property {string} [brand]
 * @property {string} category
 * @property {number} [packSize]
 * @property {string} [packUnit]
 */

/** @type {Product[]} */
export const products = [
  { id: 'p-1', name: 'Tam Yağlı Süt', brand: 'Sütaş', category: 'dairy', packSize: 1, packUnit: 'lt' },
  { id: 'p-2', name: 'Yoğurt', brand: 'Danone', category: 'dairy', packSize: 900, packUnit: 'g' },
  { id: 'p-3', name: 'Beyaz Peynir', brand: 'Pınar', category: 'dairy', packSize: 500, packUnit: 'g' },
  { id: 'p-4', name: 'Yumurta (10\'lu)', brand: 'Yumurcak', category: 'dairy', packSize: 10, packUnit: 'adet' },
  { id: 'p-5', name: 'Tereyağı', brand: 'Sütaş', category: 'dairy', packSize: 250, packUnit: 'g' },
  { id: 'p-6', name: 'Tavuk Göğsü', brand: 'Banvit', category: 'meat', packSize: 1, packUnit: 'kg' },
  { id: 'p-7', name: 'Dana Kıyma', category: 'meat', packSize: 500, packUnit: 'g' },
  { id: 'p-8', name: 'Sucuk', brand: 'Namet', category: 'meat', packSize: 250, packUnit: 'g' },
  { id: 'p-9', name: 'Domates', category: 'produce', packSize: 1, packUnit: 'kg' },
  { id: 'p-10', name: 'Salatalık', category: 'produce', packSize: 500, packUnit: 'g' },
  { id: 'p-11', name: 'Muz', category: 'produce', packSize: 1, packUnit: 'kg' },
  { id: 'p-12', name: 'Elma', category: 'produce', packSize: 1, packUnit: 'kg' },
  { id: 'p-13', name: 'Marul', category: 'produce', packSize: 1, packUnit: 'adet' },
  { id: 'p-14', name: 'Soğan', category: 'produce', packSize: 2, packUnit: 'kg' },
  { id: 'p-15', name: 'Ekmek', category: 'bakery', packSize: 1, packUnit: 'adet' },
  { id: 'p-16', name: 'Yulaflı Ekmek', brand: 'Uno', category: 'bakery', packSize: 1, packUnit: 'adet' },
  { id: 'p-17', name: 'Makarna', brand: 'Barilla', category: 'pantry', packSize: 500, packUnit: 'g' },
  { id: 'p-18', name: 'Pirinç', brand: 'Reis', category: 'pantry', packSize: 1, packUnit: 'kg' },
  { id: 'p-19', name: 'Zeytinyağı', brand: 'Komili', category: 'pantry', packSize: 1, packUnit: 'lt' },
  { id: 'p-20', name: 'Salça', brand: 'Tat', category: 'pantry', packSize: 700, packUnit: 'g' },
  { id: 'p-21', name: 'Un', brand: 'Sinangil', category: 'pantry', packSize: 2, packUnit: 'kg' },
  { id: 'p-22', name: 'Şeker', category: 'pantry', packSize: 1, packUnit: 'kg' },
  { id: 'p-23', name: 'Tuz', category: 'pantry', packSize: 500, packUnit: 'g' },
  { id: 'p-24', name: 'Maden Suyu', brand: 'Kızılay', category: 'beverages', packSize: 6, packUnit: 'adet' },
  { id: 'p-25', name: 'Portakal Suyu', brand: 'Cappy', category: 'beverages', packSize: 1, packUnit: 'lt' },
  { id: 'p-26', name: 'Kola', brand: 'Coca-Cola', category: 'beverages', packSize: 6, packUnit: '200ml' },
  { id: 'p-27', name: 'Çay', brand: 'Doğuş', category: 'beverages', packSize: 1, packUnit: 'kg' },
  { id: 'p-28', name: 'Kahve', brand: 'Nescafé', category: 'beverages', packSize: 100, packUnit: 'g' },
  { id: 'p-29', name: 'Dondurulmuş Karışık Sebze', brand: 'Süzer', category: 'frozen', packSize: 1, packUnit: 'kg' },
  { id: 'p-30', name: 'Dondurulmuş Patates', brand: 'McCain', category: 'frozen', packSize: 750, packUnit: 'g' },
  { id: 'p-31', name: 'Dondurma', brand: 'Algida', category: 'frozen', packSize: 1, packUnit: 'lt' },
  { id: 'p-32', name: 'Bulaşık Deterjanı', brand: 'Fairy', category: 'cleaning', packSize: 650, packUnit: 'ml' },
  { id: 'p-33', name: 'Çamaşır Deterjanı', brand: 'Ariel', category: 'cleaning', packSize: 3, packUnit: 'kg' },
  { id: 'p-34', name: 'Tuvalet Kağıdı', brand: 'Selpak', category: 'cleaning', packSize: 32, packUnit: 'rulo' },
  { id: 'p-35', name: 'Şampuan', brand: 'Elidor', category: 'personal_care', packSize: 500, packUnit: 'ml' },
  { id: 'p-36', name: 'Diş Macunu', brand: 'Colgate', category: 'personal_care', packSize: 100, packUnit: 'ml' },
  { id: 'p-37', name: 'Bebek Bezi', brand: 'Prima', category: 'personal_care', packSize: 44, packUnit: 'adet' },
  { id: 'p-38', name: 'Fındık Ezmesi', brand: 'Nutella', category: 'pantry', packSize: 350, packUnit: 'g' },
  { id: 'p-39', name: 'Bal', category: 'pantry', packSize: 850, packUnit: 'g' },
  { id: 'p-40', name: 'Zeytin', brand: 'Marmarabirlik', category: 'pantry', packSize: 500, packUnit: 'g' },
];
