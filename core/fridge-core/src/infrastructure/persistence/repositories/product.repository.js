const mapRow = (row) => row && ({
  id: row.id,
  householdId: row.household_id,
  canonicalName: row.canonical_name,
  brand: row.brand,
  categoryId: row.category_id,
  defaultUnit: row.default_unit,
  isGlobal: row.is_global,
  source: row.source,
  packSize: row.pack_size === null ? null : Number(row.pack_size),
  packUnit: row.pack_unit,
  barcode: row.barcode ?? null,
  nutrition: row.nutrition ?? null,
});

const makeProductRepository = ({ rawQuery }) => {
  return {
    findById: async (id) => {
      const { rows } = await rawQuery('SELECT * FROM product WHERE id = $1', [id]);
      return mapRow(rows[0]);
    },

    create: async ({ householdId = null, canonicalName, brand = null, categoryId = null, defaultUnit, isGlobal = false, source = 'user', packSize = null, packUnit = null, barcode = null, nutrition = null }) => {
      const { rows } = await rawQuery(
        `INSERT INTO product (household_id, canonical_name, brand, category_id, default_unit, is_global, source, pack_size, pack_unit, barcode, nutrition)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb) RETURNING *`,
        [householdId, canonicalName, brand, categoryId, defaultUnit, isGlobal, source, packSize, packUnit, barcode, nutrition === null ? null : JSON.stringify(nutrition)],
      );
      return mapRow(rows[0]);
    },

    findByBarcode: async (barcode) => {
      const { rows } = await rawQuery('SELECT * FROM product WHERE barcode = $1 LIMIT 1', [barcode]);
      return mapRow(rows[0]);
    },

    // Kullanıcı fiş satırını düzeltirken marka girerse kalıcılaşır — bir
    // dahaki sefere o ürün için AI'a ihtiyaç kalmaz (bkz. correct-line-item).
    updateBrand: async (id, brand) => {
      const { rows } = await rawQuery(
        'UPDATE product SET brand = $2 WHERE id = $1 RETURNING *',
        [id, brand],
      );
      return mapRow(rows[0]);
    },

    // AI'ın uydurduğu bir isim kullanıcı tarafından düzeltildiğinde
    // kalıcılaşır — aksi halde sonraki fişte alias eşleşip eski yanlış ismi
    // geri getirir (bkz. correct-line-item).
    updateCanonicalName: async (id, canonicalName) => {
      const { rows } = await rawQuery(
        'UPDATE product SET canonical_name = $2 WHERE id = $1 RETURNING *',
        [id, canonicalName],
      );
      return mapRow(rows[0]);
    },

    // Kullanıcı fiş onay ekranında kategoriyi düzeltirse kalıcılaşır — bu,
    // AI tarif üretiminin envanteri doğru sınıflandırması için tek geribesleme
    // mekanizmasıdır (bkz. recipe-eligibility.js, correct-line-item).
    updateCategoryId: async (id, categoryId) => {
      const { rows } = await rawQuery(
        'UPDATE product SET category_id = $2 WHERE id = $1 RETURNING *',
        [id, categoryId],
      );
      return mapRow(rows[0]);
    },

    // Kullanıcı fiş onay ekranında paket boyutunu düzeltirse (ör. "6X200ML"
    // satırında birim çözülemediyse) kalıcılaşır — updateBrand/updateCategoryId
    // ile aynı desen. AI kaynaklı olsun olmasın her zaman düzeltilebilir
    // (paket boyutu objektif bir üretici gerçeği, "AI mı yazdı" ayrımı yok).
    updatePackSize: async (id, { packSize, packUnit }) => {
      const { rows } = await rawQuery(
        'UPDATE product SET pack_size = $2, pack_unit = $3 WHERE id = $1 RETURNING *',
        [id, packSize, packUnit],
      );
      return mapRow(rows[0]);
    },

    // Household'a özel + global ürünleri birlikte arar. Ürün seçici (fiş
    // düzeltme, manuel envanter ekleme) bunu kullanır. Boş query tüm
    // ürünleri en yeni önce döner — kullanıcı liste halinde de görebilir.
    search: async ({ householdId, query = '', limit = 20 }) => {
      if (!query.trim()) {
        const { rows } = await rawQuery(
          `SELECT * FROM product WHERE household_id = $1 OR household_id IS NULL
           ORDER BY is_global ASC, canonical_name ASC LIMIT $2`,
          [householdId, limit],
        );
        return rows.map(mapRow);
      }

      // Substring eşleşmesi ("kola" -> "Coca-Cola") kısa kelimelerde trigram
      // benzerliğinden daha güvenilir bir sinyal olduğu için önce o gelir;
      // trigram sadece substring bulunamadığında (yazım hatası vb.) devreye girer.
      const { rows } = await rawQuery(
        `SELECT *, similarity(canonical_name, $2) AS sim,
                (canonical_name ILIKE '%' || $2 || '%') AS is_substring_match
         FROM product
         WHERE (household_id = $1 OR household_id IS NULL)
           AND (canonical_name ILIKE '%' || $2 || '%' OR similarity(canonical_name, $2) > 0.15)
         ORDER BY is_substring_match DESC, sim DESC, canonical_name ASC LIMIT $3`,
        [householdId, query, limit],
      );
      return rows.map(mapRow);
    },
  };
};

export { makeProductRepository };
