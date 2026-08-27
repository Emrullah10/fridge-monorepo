const mapRow = (row) => row && ({
  id: row.id,
  householdId: row.household_id,
  inventoryItemId: row.inventory_item_id,
  productId: row.product_id,
  delta: Number(row.delta),
  reason: row.reason,
  actorUserId: row.actor_user_id,
  receiptLineItemId: row.receipt_line_item_id,
  unitPrice: row.unit_price === null || row.unit_price === undefined ? null : Number(row.unit_price),
  createdAt: row.created_at,
});

const makeStockMovementRepository = ({ rawQuery }) => {
  return {
    // unitPrice verilmezse (çoğu çağıran vermiyor) kalemin o anki fiyatı
    // subquery ile snapshot'lanır — product_id ile aynı desen. Kalem sonradan
    // silinse bile bu satırdaki fiyat durur (FK ON DELETE SET NULL).
    create: async ({ householdId, inventoryItemId, delta, reason, actorUserId = null, receiptLineItemId = null, unitPrice = undefined }) => {
      const { rows } = await rawQuery(
        `INSERT INTO stock_movement (household_id, inventory_item_id, product_id, delta, reason, actor_user_id, receipt_line_item_id, unit_price)
         VALUES ($1, $2, (SELECT product_id FROM inventory_item WHERE id = $2), $3, $4, $5, $6,
                 COALESCE($7::numeric, (SELECT unit_price FROM inventory_item WHERE id = $2)))
         RETURNING *`,
        [householdId, inventoryItemId, delta, reason, actorUserId, receiptLineItemId, unitPrice ?? null],
      );
      return mapRow(rows[0]);
    },

    listByInventoryItem: async (inventoryItemId) => {
      const { rows } = await rawQuery(
        `SELECT * FROM stock_movement WHERE inventory_item_id = $1 ORDER BY created_at DESC`,
        [inventoryItemId],
      );
      return rows.map(mapRow);
    },
  };
};

export { makeStockMovementRepository };
