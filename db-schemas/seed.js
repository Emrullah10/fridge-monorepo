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
  { key: 'pantry.pasta', name_tr: 'Makarna & Bakliyat', name_en: 'Pasta & Legumes', parent_key: 'pantry' },
  { key: 'pantry.canned', name_tr: 'Konserve', name_en: 'Canned Goods', parent_key: 'pantry' },
  { key: 'pantry.condiments', name_tr: 'Sos & Baharat', name_en: 'Condiments & Spices', parent_key: 'pantry' },
  { key: 'beverages', name_tr: 'İçecekler', name_en: 'Beverages', parent_key: null },
  { key: 'frozen', name_tr: 'Dondurulmuş', name_en: 'Frozen', parent_key: null },
  { key: 'cleaning', name_tr: 'Temizlik', name_en: 'Cleaning', parent_key: null },
  { key: 'personal_care', name_tr: 'Kişisel Bakım', name_en: 'Personal Care', parent_key: null },
  { key: 'snacks', name_tr: 'Atıştırmalık', name_en: 'Snacks', parent_key: null },
  { key: 'other', name_tr: 'Diğer', name_en: 'Other', parent_key: null },
];

// Yaygın market fişi kısaltmaları — global alias seed. household_id NULL,
// böylece her ev bu eşleştirmelerden bedava faydalanır. Kapsamlı bir liste
// değil (o işi artık AI otomatik ürün oluşturma yapıyor, bkz.
// process-receipt-scan.use-case.js) — amaç en yaygın ~90 ürünle ilk
// deneyimi iyileştirmek, alias öğrenmesine bel bağlamadan.
const GLOBAL_PRODUCTS = [
  // Süt ürünleri
  { raw: 'DMS SUT 1L', canonical: 'Süt (1L)', category: 'dairy.milk', unit: 'liter' },
  { raw: 'DMS SUT 1LT', canonical: 'Süt (1L)', category: 'dairy.milk', unit: 'liter' },
  { raw: 'SUT YARIM YAG', canonical: 'Yarım Yağlı Süt', category: 'dairy.milk', unit: 'liter' },
  { raw: 'AYRAN', canonical: 'Ayran', category: 'dairy', unit: 'liter' },
  { raw: 'YAYLA YOGURT', canonical: 'Yoğurt', category: 'dairy.yogurt', unit: 'kilogram' },
  { raw: 'SUZME YOGURT', canonical: 'Süzme Yoğurt', category: 'dairy.yogurt', unit: 'kilogram' },
  { raw: 'BEYAZ PEYNIR', canonical: 'Beyaz Peynir', category: 'dairy.cheese', unit: 'kilogram' },
  { raw: 'KASAR PEYNIR', canonical: 'Kaşar Peyniri', category: 'dairy.cheese', unit: 'kilogram' },
  { raw: 'LOR PEYNIR', canonical: 'Lor Peyniri', category: 'dairy.cheese', unit: 'kilogram' },
  { raw: 'TEREYAGI', canonical: 'Tereyağı', category: 'dairy', unit: 'gram' },
  { raw: 'KREMA', canonical: 'Krema', category: 'dairy', unit: 'milliliter' },
  { raw: 'YUMURTA 15 LI', canonical: 'Yumurta (15\'li)', category: 'other', unit: 'package' },
  { raw: 'YUMURTA 10 LU', canonical: 'Yumurta (10\'lu)', category: 'other', unit: 'package' },
  { raw: 'YUMURTA 30 LU', canonical: 'Yumurta (30\'lu)', category: 'other', unit: 'package' },

  // Fırın
  { raw: 'EKMEK', canonical: 'Ekmek', category: 'bakery', unit: 'piece' },
  { raw: 'TAM BUGDAY EKMEK', canonical: 'Tam Buğday Ekmeği', category: 'bakery', unit: 'piece' },
  { raw: 'SIMIT', canonical: 'Simit', category: 'bakery', unit: 'piece' },
  { raw: 'POGACA', canonical: 'Poğaça', category: 'bakery', unit: 'piece' },

  // Sebze & meyve
  { raw: 'DOMATES', canonical: 'Domates', category: 'produce', unit: 'kilogram' },
  { raw: 'SALATALIK', canonical: 'Salatalık', category: 'produce', unit: 'kilogram' },
  { raw: 'SOGAN KURU', canonical: 'Soğan', category: 'produce', unit: 'kilogram' },
  { raw: 'PATATES', canonical: 'Patates', category: 'produce', unit: 'kilogram' },
  { raw: 'BIBER SIVRI', canonical: 'Sivri Biber', category: 'produce', unit: 'kilogram' },
  { raw: 'BIBER KAPYA', canonical: 'Kapya Biber', category: 'produce', unit: 'kilogram' },
  { raw: 'PATLICAN', canonical: 'Patlıcan', category: 'produce', unit: 'kilogram' },
  { raw: 'HAVUC', canonical: 'Havuç', category: 'produce', unit: 'kilogram' },
  { raw: 'SARIMSAK', canonical: 'Sarımsak', category: 'produce', unit: 'gram' },
  { raw: 'LIMON', canonical: 'Limon', category: 'produce', unit: 'kilogram' },
  { raw: 'ELMA', canonical: 'Elma', category: 'produce', unit: 'kilogram' },
  { raw: 'MUZ', canonical: 'Muz', category: 'produce', unit: 'kilogram' },
  { raw: 'PORTAKAL', canonical: 'Portakal', category: 'produce', unit: 'kilogram' },
  { raw: 'MARUL', canonical: 'Marul', category: 'produce', unit: 'piece' },
  { raw: 'MAYDANOZ', canonical: 'Maydanoz', category: 'produce', unit: 'piece' },

  // Et & tavuk
  { raw: 'TAVUK GOGSU', canonical: 'Tavuk Göğsü', category: 'meat', unit: 'kilogram' },
  { raw: 'TAVUK BUT', canonical: 'Tavuk But', category: 'meat', unit: 'kilogram' },
  { raw: 'TAVUK KANAT', canonical: 'Tavuk Kanat', category: 'meat', unit: 'kilogram' },
  { raw: 'KIYMA', canonical: 'Kıyma', category: 'meat', unit: 'kilogram' },
  { raw: 'DANA KUSBASI', canonical: 'Dana Kuşbaşı', category: 'meat', unit: 'kilogram' },
  { raw: 'SUCUK', canonical: 'Sucuk', category: 'meat', unit: 'gram' },
  { raw: 'SALAM', canonical: 'Salam', category: 'meat', unit: 'gram' },
  { raw: 'SOSIS', canonical: 'Sosis', category: 'meat', unit: 'gram' },
  { raw: 'PASTIRMA', canonical: 'Pastırma', category: 'meat', unit: 'gram' },

  // Makarna & bakliyat
  { raw: 'MAKARNA', canonical: 'Makarna', category: 'pantry.pasta', unit: 'gram' },
  { raw: 'PIRINC', canonical: 'Pirinç', category: 'pantry.pasta', unit: 'kilogram' },
  { raw: 'BULGUR', canonical: 'Bulgur', category: 'pantry.pasta', unit: 'kilogram' },
  { raw: 'MERCIMEK KIRMIZI', canonical: 'Kırmızı Mercimek', category: 'pantry.pasta', unit: 'kilogram' },
  { raw: 'NOHUT', canonical: 'Nohut', category: 'pantry.pasta', unit: 'kilogram' },
  { raw: 'KURU FASULYE', canonical: 'Kuru Fasulye', category: 'pantry.pasta', unit: 'kilogram' },
  { raw: 'UN', canonical: 'Un', category: 'pantry', unit: 'kilogram' },
  { raw: 'SEKER', canonical: 'Şeker', category: 'pantry', unit: 'kilogram' },
  { raw: 'TUZ', canonical: 'Tuz', category: 'pantry', unit: 'kilogram' },

  // Sos & baharat
  { raw: 'AYCICEK YAGI', canonical: 'Ayçiçek Yağı', category: 'pantry.condiments', unit: 'liter' },
  { raw: 'ZEYTINYAGI', canonical: 'Zeytinyağı', category: 'pantry.condiments', unit: 'liter' },
  { raw: 'SALCA', canonical: 'Salça', category: 'pantry.condiments', unit: 'gram' },
  { raw: 'KETCAP', canonical: 'Ketçap', category: 'pantry.condiments', unit: 'gram' },
  { raw: 'MAYONEZ', canonical: 'Mayonez', category: 'pantry.condiments', unit: 'gram' },
  { raw: 'SIRKE', canonical: 'Sirke', category: 'pantry.condiments', unit: 'milliliter' },
  { raw: 'ZEYTIN SIYAH', canonical: 'Siyah Zeytin', category: 'pantry.canned', unit: 'gram' },
  { raw: 'ZEYTIN YESIL', canonical: 'Yeşil Zeytin', category: 'pantry.canned', unit: 'gram' },
  { raw: 'BAL', canonical: 'Bal', category: 'pantry', unit: 'gram' },
  { raw: 'RECEL', canonical: 'Reçel', category: 'pantry', unit: 'gram' },
  { raw: 'FISTIK EZMESI', canonical: 'Fıstık Ezmesi', category: 'pantry', unit: 'gram' },

  // İçecekler
  { raw: 'SU 5LT', canonical: 'Su (5L)', category: 'beverages', unit: 'liter' },
  { raw: 'SU 1.5LT', canonical: 'Su (1.5L)', category: 'beverages', unit: 'liter' },
  { raw: 'COCA COLA', canonical: 'Coca-Cola', category: 'beverages', unit: 'liter' },
  { raw: 'FANTA', canonical: 'Fanta', category: 'beverages', unit: 'liter' },
  { raw: 'CAY', canonical: 'Çay', category: 'beverages', unit: 'gram' },
  { raw: 'KAHVE', canonical: 'Kahve', category: 'beverages', unit: 'gram' },
  { raw: 'MEYVE SUYU', canonical: 'Meyve Suyu', category: 'beverages', unit: 'liter' },

  // Atıştırmalık
  { raw: 'CIKOLATA', canonical: 'Çikolata', category: 'snacks', unit: 'gram' },
  { raw: 'BISKUVI', canonical: 'Bisküvi', category: 'snacks', unit: 'gram' },
  { raw: 'CIPS', canonical: 'Cips', category: 'snacks', unit: 'gram' },
  { raw: 'KURUYEMIS', canonical: 'Kuruyemiş', category: 'snacks', unit: 'gram' },

  // Dondurulmuş
  { raw: 'DONDURULMUS SEBZE', canonical: 'Dondurulmuş Sebze', category: 'frozen', unit: 'gram' },
  { raw: 'DONDURMA', canonical: 'Dondurma', category: 'frozen', unit: 'milliliter' },

  // Temizlik
  { raw: 'BULASIK DETERJANI', canonical: 'Bulaşık Deterjanı', category: 'cleaning', unit: 'milliliter' },
  { raw: 'CAMASIR DETERJANI', canonical: 'Çamaşır Deterjanı', category: 'cleaning', unit: 'milliliter' },
  { raw: 'YUMUSATICI', canonical: 'Yumuşatıcı', category: 'cleaning', unit: 'milliliter' },
  { raw: 'CAMASIR SUYU', canonical: 'Çamaşır Suyu', category: 'cleaning', unit: 'milliliter' },
  { raw: 'TUVALET KAGIDI', canonical: 'Tuvalet Kağıdı', category: 'cleaning', unit: 'package' },
  { raw: 'KAGIT HAVLU', canonical: 'Kağıt Havlu', category: 'cleaning', unit: 'package' },
  { raw: 'COP POSETI', canonical: 'Çöp Poşeti', category: 'cleaning', unit: 'package' },

  // Kişisel bakım
  { raw: 'SAMPUAN', canonical: 'Şampuan', category: 'personal_care', unit: 'milliliter' },
  { raw: 'DIS MACUNU', canonical: 'Diş Macunu', category: 'personal_care', unit: 'gram' },
  { raw: 'SIVI SABUN', canonical: 'Sıvı Sabun', category: 'personal_care', unit: 'milliliter' },
  { raw: 'PECETE', canonical: 'Peçete', category: 'personal_care', unit: 'package' },
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
          `INSERT INTO product (household_id, canonical_name, category_id, default_unit, is_global, source)
           VALUES (NULL, $1, $2, $3, true, 'seed')
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
