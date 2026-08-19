// storage_location.kind ve household.kind için izin verilen değerler.
// db-schemas/07-storage-kind-text.sql'deki CHECK kısıtlarının tek doğruluk
// kaynağı — burada listelenmeyen bir değer Postgres'e hiç gitmeden 422
// olarak reddedilsin diye (aksi halde CHECK ihlali 500'e düşerdi).
const STORAGE_KINDS = [
  'fridge', 'freezer', 'pantry', 'cabinet', 'drawer', 'counter',
  'cellar', 'box', 'shelf', 'wine', 'medicine', 'balcony', 'garage', 'other',
];

const HOUSEHOLD_KINDS = [
  'home', 'office', 'summerhouse', 'cottage', 'workshop',
  'shop', 'dorm', 'garage', 'boat', 'other',
];

export { STORAGE_KINDS, HOUSEHOLD_KINDS };
