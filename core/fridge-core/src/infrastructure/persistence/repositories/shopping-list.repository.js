const mapListRow = (row) => row && ({
  id: row.id,
  householdId: row.household_id,
  name: row.name,
  isArchived: row.is_archived,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

const mapItemRow = (row) => row && ({
  id: row.id,
  shoppingListId: row.shopping_list_id,
  productId: row.product_id,
  name: row.canonical_name ?? row.custom_name,
  quantity: Number(row.quantity),
  unit: row.unit,
  isChecked: row.is_checked,
  note: row.note,
  sortOrder: row.sort_order,
  source: row.source,
  addedBy: row.added_by,
  checkedBy: row.checked_by,
  checkedAt: row.checked_at,
  createdAt: row.created_at,
});

const makeShoppingListRepository = ({ rawQuery }) => {
  const findItemById = async (id) => {
    const { rows } = await rawQuery(
      `SELECT sli.*, p.canonical_name FROM shopping_list_item sli
       LEFT JOIN product p ON p.id = sli.product_id
       WHERE sli.id = $1`,
      [id],
    );
    return mapItemRow(rows[0]);
  };

  return {
    // Household başına tek "aktif" (arşivlenmemiş) liste — yoksa oluşturur.
    getOrCreateActiveList: async ({ householdId, userId }) => {
      const { rows } = await rawQuery(
        `SELECT * FROM shopping_list WHERE household_id = $1 AND is_archived = false
         ORDER BY created_at DESC LIMIT 1`,
        [householdId],
      );
      if (rows[0]) return mapListRow(rows[0]);

      const { rows: created } = await rawQuery(
        `INSERT INTO shopping_list (household_id, created_by) VALUES ($1, $2) RETURNING *`,
        [householdId, userId],
      );
      return mapListRow(created[0]);
    },

    findListById: async (id) => {
      const { rows } = await rawQuery('SELECT * FROM shopping_list WHERE id = $1', [id]);
      return mapListRow(rows[0]);
    },

    listItems: async (shoppingListId) => {
      const { rows } = await rawQuery(
        `SELECT sli.*, p.canonical_name
         FROM shopping_list_item sli
         LEFT JOIN product p ON p.id = sli.product_id
         WHERE sli.shopping_list_id = $1
         ORDER BY sli.is_checked ASC, sli.sort_order ASC, sli.created_at ASC`,
        [shoppingListId],
      );
      return rows.map(mapItemRow);
    },

    findItemById,

    // INSERT ... RETURNING * ürün adını bilmez (product tablosuna JOIN yok),
    // bu yüzden eklenen satırı findItemById ile tekrar okuyoruz — aksi halde
    // "eklendi" yanıtı name: null döner, çağıran taraf ayrı bir istek atmak
    // zorunda kalır.
    addItem: async ({ shoppingListId, productId = null, customName = null, quantity = 1, unit = 'piece', note = null, source = 'manual', addedBy }) => {
      const { rows } = await rawQuery(
        `INSERT INTO shopping_list_item (shopping_list_id, product_id, custom_name, quantity, unit, note, source, added_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [shoppingListId, productId, customName, quantity, unit, note, source, addedBy],
      );
      return findItemById(rows[0].id);
    },

    // Aynı ürün zaten listede varsa (recipe/low_stock önerileriyle
    // eklerken çift satır açmamak için) miktarı artırır.
    findItemByProduct: async ({ shoppingListId, productId }) => {
      const { rows } = await rawQuery(
        `SELECT sli.*, p.canonical_name FROM shopping_list_item sli
         LEFT JOIN product p ON p.id = sli.product_id
         WHERE sli.shopping_list_id = $1 AND sli.product_id = $2 AND sli.is_checked = false`,
        [shoppingListId, productId],
      );
      return mapItemRow(rows[0]);
    },

    incrementQuantity: async ({ id, deltaQuantity }) => {
      await rawQuery('UPDATE shopping_list_item SET quantity = quantity + $2 WHERE id = $1', [id, deltaQuantity]);
      return findItemById(id);
    },

    updateItem: async (id, { quantity, unit, note, isChecked, checkedBy }) => {
      await rawQuery(
        `UPDATE shopping_list_item SET
           quantity = COALESCE($2, quantity),
           unit = COALESCE($3, unit),
           note = CASE WHEN $4::boolean THEN $5 ELSE note END,
           is_checked = COALESCE($6, is_checked),
           checked_by = CASE WHEN $6 = true THEN $7 WHEN $6 = false THEN NULL ELSE checked_by END,
           checked_at = CASE WHEN $6 = true THEN now() WHEN $6 = false THEN NULL ELSE checked_at END
         WHERE id = $1`,
        [id, quantity ?? null, unit ?? null, note !== undefined, note ?? null, isChecked ?? null, checkedBy ?? null],
      );
      return findItemById(id);
    },

    removeItem: async (id) => {
      await rawQuery('DELETE FROM shopping_list_item WHERE id = $1', [id]);
    },

    reorder: async ({ shoppingListId, orderedIds }) => {
      for (let i = 0; i < orderedIds.length; i += 1) {
        await rawQuery(
          'UPDATE shopping_list_item SET sort_order = $3 WHERE id = $1 AND shopping_list_id = $2',
          [orderedIds[i], shoppingListId, i],
        );
      }
    },

    clearChecked: async (shoppingListId) => {
      const { rowCount } = await rawQuery(
        'DELETE FROM shopping_list_item WHERE shopping_list_id = $1 AND is_checked = true',
        [shoppingListId],
      );
      return rowCount;
    },

    listCheckedItems: async (shoppingListId) => {
      const { rows } = await rawQuery(
        `SELECT sli.*, p.canonical_name FROM shopping_list_item sli
         LEFT JOIN product p ON p.id = sli.product_id
         WHERE sli.shopping_list_id = $1 AND sli.is_checked = true`,
        [shoppingListId],
      );
      return rows.map(mapItemRow);
    },

    // "Biten/azalan ürünler": son 60 günde stock_movement hareketi görmüş
    // ama şu an stokta olmayan (ya satırı yok ya quantity=0) ürünler.
    // Zaten aktif listede olanlar hariç tutulur.
    suggestLowStock: async ({ householdId, shoppingListId }) => {
      const { rows } = await rawQuery(
        `SELECT DISTINCT p.id AS product_id, p.canonical_name, p.default_unit,
                MAX(sm.created_at) AS last_consumed_at
         FROM stock_movement sm
         JOIN inventory_item inv ON inv.id = sm.inventory_item_id
         JOIN product p ON p.id = inv.product_id
         WHERE sm.household_id = $1
           AND sm.created_at > now() - INTERVAL '60 days'
           AND sm.delta < 0
           AND NOT EXISTS (
             SELECT 1 FROM inventory_item inv2
             WHERE inv2.household_id = $1 AND inv2.product_id = p.id AND inv2.quantity > 0
           )
           AND NOT EXISTS (
             SELECT 1 FROM shopping_list_item sli
             WHERE sli.shopping_list_id = $2 AND sli.product_id = p.id AND sli.is_checked = false
           )
         GROUP BY p.id, p.canonical_name, p.default_unit
         ORDER BY last_consumed_at DESC
         LIMIT 10`,
        [householdId, shoppingListId],
      );
      return rows.map((row) => ({
        productId: row.product_id,
        name: row.canonical_name,
        unit: row.default_unit,
        lastConsumedAt: row.last_consumed_at,
        reason: 'low_stock',
      }));
    },

    // Tüketim ritmi profili: AI'ın "normalde X günde bir alıyorsun, Y gün
    // oldu" tarzı önerileri için ön elenmiş, sıkıştırılmış istatistik.
    // sm.product_id (denormalize kolon, bkz. 12-stock-movement-product.sql)
    // kullanır — inventory_item silinse bile geçmiş kaybolmaz. SQL ön
    // elemeyi yapar (en fazla 25 satır), AI yalnızca bu satırları yorumlar.
    consumptionProfile: async ({ householdId, shoppingListId }) => {
      const { rows } = await rawQuery(
        `WITH consumption AS (
           SELECT sm.product_id, p.canonical_name, p.brand, pc.key AS category_key, p.default_unit,
                  SUM(ABS(sm.delta))  AS total_consumed,
                  COUNT(*)            AS event_count,
                  MAX(sm.created_at)  AS last_at,
                  EXTRACT(EPOCH FROM (MAX(sm.created_at) - MIN(sm.created_at))) / 86400.0 AS span_days
           FROM stock_movement sm
           JOIN product p ON p.id = sm.product_id
           LEFT JOIN product_category pc ON pc.id = p.category_id
           WHERE sm.household_id = $1
             AND sm.delta < 0
             AND sm.reason IN ('consumed', 'recipe_used', 'expired')
             AND sm.created_at > now() - INTERVAL '120 days'
           GROUP BY sm.product_id, p.canonical_name, p.brand, pc.key, p.default_unit
           HAVING COUNT(*) >= 2
         ),
         current_stock AS (
           SELECT product_id, SUM(quantity) AS on_hand
           FROM inventory_item WHERE household_id = $1 AND quantity > 0
           GROUP BY product_id
         )
         SELECT c.*, COALESCE(cs.on_hand, 0) AS on_hand,
                CASE WHEN c.event_count > 1 AND c.span_days > 0
                     THEN c.span_days / (c.event_count - 1) ELSE NULL END AS avg_interval_days,
                EXTRACT(EPOCH FROM (now() - c.last_at)) / 86400.0 AS days_since_last
         FROM consumption c
         LEFT JOIN current_stock cs ON cs.product_id = c.product_id
         WHERE NOT EXISTS (
           SELECT 1 FROM shopping_list_item sli
           WHERE sli.shopping_list_id = $2 AND sli.product_id = c.product_id AND sli.is_checked = false
         )
         ORDER BY (EXTRACT(EPOCH FROM (now() - c.last_at)) / 86400.0)
                  / NULLIF(c.span_days / NULLIF(c.event_count - 1, 0), 0) DESC NULLS LAST
         LIMIT 25`,
        [householdId, shoppingListId],
      );
      return rows.map((row) => ({
        productId: row.product_id,
        name: row.canonical_name,
        brand: row.brand,
        categoryId: row.category_key,
        unit: row.default_unit,
        onHand: Number(row.on_hand),
        totalConsumed: Number(row.total_consumed),
        eventCount: Number(row.event_count),
        avgIntervalDays: row.avg_interval_days === null ? null : Number(row.avg_interval_days),
        daysSinceLast: Number(row.days_since_last),
      }));
    },
  };
};

export { makeShoppingListRepository };
