const mapRow = (row) => row && ({
  id: row.id,
  householdId: row.household_id,
  canonicalName: row.canonical_name,
  categoryId: row.category_id,
  defaultUnit: row.default_unit,
  isGlobal: row.is_global,
  source: row.source,
});

const makeProductRepository = ({ rawQuery }) => {
  return {
    findById: async (id) => {
      const { rows } = await rawQuery('SELECT * FROM product WHERE id = $1', [id]);
      return mapRow(rows[0]);
    },

    create: async ({ householdId = null, canonicalName, categoryId = null, defaultUnit, isGlobal = false, source = 'user' }) => {
      const { rows } = await rawQuery(
        `INSERT INTO product (household_id, canonical_name, category_id, default_unit, is_global, source)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [householdId, canonicalName, categoryId, defaultUnit, isGlobal, source],
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
