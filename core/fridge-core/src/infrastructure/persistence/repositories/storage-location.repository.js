const mapRow = (row) => row && ({
  id: row.id,
  householdId: row.household_id,
  name: row.name,
  kind: row.kind,
  icon: row.icon,
  sortOrder: row.sort_order,
});

const makeStorageLocationRepository = ({ rawQuery }) => {
  return {
    create: async ({ householdId, name, kind, icon = null, sortOrder = 0 }) => {
      const { rows } = await rawQuery(
        `INSERT INTO storage_location (household_id, name, kind, icon, sort_order)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [householdId, name, kind, icon, sortOrder],
      );
      return mapRow(rows[0]);
    },

    listByHousehold: async (householdId) => {
      const { rows } = await rawQuery(
        `SELECT * FROM storage_location WHERE household_id = $1 ORDER BY sort_order`,
        [householdId],
      );
      return rows.map(mapRow);
    },

    findById: async (id) => {
      const { rows } = await rawQuery('SELECT * FROM storage_location WHERE id = $1', [id]);
      return mapRow(rows[0]);
    },

    // Kısmi güncelleme: her alan için "gönderildi mi" bayrağı (`$n::boolean`)
    // ile "dokunma" ile "null'a çek" ayırt edilir — düz COALESCE bunu yapamaz
    // (icon: null "ikonu temizle" demek, icon: undefined "dokunma" demek).
    update: async (id, { name, kind, icon, sortOrder }) => {
      const { rows } = await rawQuery(
        `UPDATE storage_location SET
           name = COALESCE($2, name),
           kind = COALESCE($3, kind),
           icon = CASE WHEN $4::boolean THEN $5 ELSE icon END,
           sort_order = COALESCE($6, sort_order)
         WHERE id = $1 RETURNING *`,
        [id, name ?? null, kind ?? null, icon !== undefined, icon ?? null, sortOrder ?? null],
      );
      return mapRow(rows[0]);
    },

    delete: async (id) => {
      await rawQuery('DELETE FROM storage_location WHERE id = $1', [id]);
    },

    countInventoryItems: async (id) => {
      const { rows } = await rawQuery(
        'SELECT count(*)::int AS count FROM inventory_item WHERE storage_location_id = $1',
        [id],
      );
      return rows[0].count;
    },

    countByHousehold: async (householdId) => {
      const { rows } = await rawQuery(
        'SELECT count(*)::int AS count FROM storage_location WHERE household_id = $1',
        [householdId],
      );
      return rows[0].count;
    },

    // Bir bölümdeki tüm envanteri başka bir bölüme taşır. Plain UPDATE
    // yetmez: hedefte aynı ürün/birim/SKT kombinasyonu zaten varsa
    // uq_inventory_item_identity çakışır. DELETE...RETURNING + INSERT...
    // ON CONFLICT DO UPDATE ile miktarlar birleştirilir.
    moveAllToLocation: async ({ fromId, toId }) => {
      await rawQuery(
        `WITH moved AS (
           DELETE FROM inventory_item
            WHERE storage_location_id = $1
           RETURNING household_id, product_id, unit, expires_at, quantity, opened_at, note
         )
         INSERT INTO inventory_item (household_id, storage_location_id, product_id, unit, expires_at, quantity, opened_at, note)
         SELECT household_id, $2, product_id, unit, expires_at, quantity, opened_at, note FROM moved
         ON CONFLICT (household_id, storage_location_id, product_id, unit, (COALESCE(expires_at, '0001-01-01')))
         DO UPDATE SET quantity = inventory_item.quantity + EXCLUDED.quantity, updated_at = now()`,
        [fromId, toId],
      );
    },
  };
};

export { makeStorageLocationRepository };
