const mapRow = (row) => row && ({
  id: row.id,
  householdId: row.household_id,
  storageLocationId: row.storage_location_id,
  productId: row.product_id,
  quantity: Number(row.quantity),
  unit: row.unit,
  expiresAt: row.expires_at,
  openedAt: row.opened_at,
  note: row.note,
  // canonical_name sadece ürün adıyla birlikte listeleyen sorgularda dolu olur.
  ...(row.canonical_name !== undefined ? { productName: row.canonical_name } : {}),
});

const makeInventoryItemRepository = ({ rawQuery }) => {
  return {
    findById: async (id) => {
      const { rows } = await rawQuery('SELECT * FROM inventory_item WHERE id = $1', [id]);
      return mapRow(rows[0]);
    },

    listByHousehold: async (householdId, { storageLocationId } = {}) => {
      const conditions = ['inv.household_id = $1'];
      const params = [householdId];
      if (storageLocationId) {
        conditions.push(`inv.storage_location_id = $${params.length + 1}`);
        params.push(storageLocationId);
      }
      const { rows } = await rawQuery(
        `SELECT inv.*, p.canonical_name
         FROM inventory_item inv
         JOIN product p ON p.id = inv.product_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY inv.created_at DESC`,
        params,
      );
      return rows.map(mapRow);
    },

    listExpiringBefore: async (householdId, beforeDate) => {
      const { rows } = await rawQuery(
        `SELECT inv.*, p.canonical_name
         FROM inventory_item inv
         JOIN product p ON p.id = inv.product_id
         WHERE inv.household_id = $1 AND inv.expires_at IS NOT NULL AND inv.expires_at <= $2
         ORDER BY inv.expires_at ASC`,
        [householdId, beforeDate],
      );
      return rows.map(mapRow);
    },

    // Aynı ürün + lokasyon + birim + son kullanma tarihi varsa miktarı artırır,
    // yoksa yeni satır açar. Planın 03-inventory-schema.sql UNIQUE kısıtına dayanır.
    upsertQuantity: async ({ householdId, storageLocationId, productId, unit, expiresAt = null, deltaQuantity }) => {
      const { rows } = await rawQuery(
        `INSERT INTO inventory_item (household_id, storage_location_id, product_id, unit, expires_at, quantity)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (household_id, storage_location_id, product_id, unit, (COALESCE(expires_at, '0001-01-01')))
         DO UPDATE SET quantity = inventory_item.quantity + EXCLUDED.quantity, updated_at = now()
         RETURNING *`,
        [householdId, storageLocationId, productId, unit, expiresAt, deltaQuantity],
      );
      return mapRow(rows[0]);
    },

    adjustQuantity: async ({ id, deltaQuantity }) => {
      const { rows } = await rawQuery(
        `UPDATE inventory_item SET quantity = quantity + $2, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id, deltaQuantity],
      );
      return mapRow(rows[0]);
    },

    delete: async (id) => {
      await rawQuery('DELETE FROM inventory_item WHERE id = $1', [id]);
    },
  };
};

export { makeInventoryItemRepository };
