const mapRow = (row) => row && ({
  id: row.id,
  key: row.key,
  parentId: row.parent_id,
  nameTr: row.name_tr,
  nameEn: row.name_en,
});

// Kategori sayısı sabit ve az (17, bkz. db-schemas/seed.js), sık okunuyor
// (her fiş satırı için) — process bellek içinde bir kere önbelleğe alıp
// tekrar sorgulamamak mantıklı.
const makeProductCategoryRepository = ({ rawQuery }) => {
  let cache = null;

  const listAll = async () => {
    if (!cache) {
      const { rows } = await rawQuery('SELECT * FROM product_category', []);
      cache = rows.map(mapRow);
    }
    return cache;
  };

  return {
    listAll,

    // AI'ın döndürdüğü kategori anahtarını (örn. "dairy.yogurt") id'ye
    // çevirir. Bulunamazsa null — çağıran taraf ürünü kategorisiz oluşturur.
    findByKey: async (key) => {
      if (!key) return null;
      const categories = await listAll();
      return categories.find((c) => c.key === key) ?? null;
    },
  };
};

export { makeProductCategoryRepository };
