const mapRow = (row) => row && ({
  id: row.id,
  householdId: row.household_id,
  inventoryItemId: row.inventory_item_id,
  delta: Number(row.delta),
  reason: row.reason,
  actorUserId: row.actor_user_id,
  receiptLineItemId: row.receipt_line_item_id,
  createdAt: row.created_at,
});

const makeStockMovementRepository = ({ rawQuery }) => {
  return {
    create: async ({ householdId, inventoryItemId, delta, reason, actorUserId = null, receiptLineItemId = null }) => {
      const { rows } = await rawQuery(
        `INSERT INTO stock_movement (household_id, inventory_item_id, delta, reason, actor_user_id, receipt_line_item_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [householdId, inventoryItemId, delta, reason, actorUserId, receiptLineItemId],
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
