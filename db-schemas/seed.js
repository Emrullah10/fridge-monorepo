import pg from 'pg';
import { normalizeAliasText } from '../core/fridge-core/src/infrastructure/persistence/repositories/product-alias.repository.js';

const { Pool } = pg;

const CATEGORIES = [
  { key: 'dairy', name_tr: 'Süt Ürünleri', name_en: 'Dairy', parent_key: null },
  { key: 'dairy.milk', name_tr: 'Süt', name_en: 'Milk', parent_key: 'dairy' },
  { key: 'dairy.cheese', name_tr: 'Peynir', name_en: 'Cheese', parent_key: 'dairy' },
  { key: 'dairy.yogurt', name_tr: 'Yoğurt', name_en: 'Yogurt', parent_key: 'dairy' },
  { key: 'produce', name_tr: 'Sebze & Meyve', name_en: 'Produce', parent_key: null },
  { key: 'meat', name_tr: 'Et & Tavuk', name_en: 'Meat & Poultry', parent_key: null },
  { key: 'bakery', name_tr: 'Fırın Ürünleri', name_en: 'Bakery', parent_key: null },
  { key: 'pantry', name_tr: 'Kiler', name_en: 'Pantry', parent_key: null },
  { key: 'beverages', name_tr: 'İçecekler', name_en: 'Beverages', parent_key: null },
  { key: 'frozen', name_tr: 'Dondurulmuş', name_en: 'Frozen', parent_key: null },
  { key: 'other', name_tr: 'Diğer', name_en: 'Other', parent_key: null },
];

// Yaygın market fişi kısaltmaları — global alias seed. household_id NULL,
// böylece her ev bu eşleştirmelerden bedava faydalanır.
const GLOBAL_PRODUCTS = [
  { raw: 'DMS SUT 1L', canonical: 'Süt (1L)', category: 'dairy.milk', unit: 'liter' },
  { raw: 'DMS SUT 1LT', canonical: 'Süt (1L)', category: 'dairy.milk', unit: 'liter' },
  { raw: 'YAYLA YOGURT', canonical: 'Yoğurt', category: 'dairy.yogurt', unit: 'kilogram' },
  { raw: 'BEYAZ PEYNIR', canonical: 'Beyaz Peynir', category: 'dairy.cheese', unit: 'kilogram' },
  { raw: 'KASAR PEYNIR', canonical: 'Kaşar Peyniri', category: 'dairy.cheese', unit: 'kilogram' },
  { raw: 'YUMURTA 15 LI', canonical: 'Yumurta (15\'li)', category: 'other', unit: 'package' },
  { raw: 'EKMEK', canonical: 'Ekmek', category: 'bakery', unit: 'piece' },
  { raw: 'DOMATES', canonical: 'Domates', category: 'produce', unit: 'kilogram' },
  { raw: 'SALATALIK', canonical: 'Salatalık', category: 'produce', unit: 'kilogram' },
  { raw: 'SOGAN KURU', canonical: 'Soğan', category: 'produce', unit: 'kilogram' },
  { raw: 'PATATES', canonical: 'Patates', category: 'produce', unit: 'kilogram' },
  { raw: 'TAVUK GOGSU', canonical: 'Tavuk Göğsü', category: 'meat', unit: 'kilogram' },
  { raw: 'KIYMA', canonical: 'Kıyma', category: 'meat', unit: 'kilogram' },
];

const run = async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString });

  const categoryIdByKey = {};
  for (const category of CATEGORIES) {
    const parentId = category.parent_key ? categoryIdByKey[category.parent_key] : null;
    const { rows } = await pool.query(
      `INSERT INTO product_category (key, parent_id, name_tr, name_en)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET name_tr = EXCLUDED.name_tr
       RETURNING id`,
      [category.key, parentId, category.name_tr, category.name_en],
    );
    categoryIdByKey[category.key] = rows[0].id;
  }
  console.log(`Seeded ${CATEGORIES.length} categories.`);

  for (const item of GLOBAL_PRODUCTS) {
    const categoryId = categoryIdByKey[item.category];

    const { rows: existing } = await pool.query(
      `SELECT id FROM product WHERE household_id IS NULL AND canonical_name = $1`,
      [item.canonical],
    );

    const productId = existing.length > 0
      ? existing[0].id
      : (await pool.query(
          `INSERT INTO product (household_id, canonical_name, category_id, default_unit, is_global)
           VALUES (NULL, $1, $2, $3, true)
           RETURNING id`,
          [item.canonical, categoryId, item.unit],
        )).rows[0].id;

    await pool.query(
      `INSERT INTO product_alias (household_id, raw_text, normalized_text, product_id, source, confidence)
       VALUES (NULL, $1, $2, $3, 'seed', 1.0)
       ON CONFLICT DO NOTHING`,
      [item.raw, normalizeAliasText(item.raw), productId],
    );
  }
  console.log(`Seeded ${GLOBAL_PRODUCTS.length} global product aliases.`);

  await pool.end();
  console.log('Seed complete.');
};

run().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
