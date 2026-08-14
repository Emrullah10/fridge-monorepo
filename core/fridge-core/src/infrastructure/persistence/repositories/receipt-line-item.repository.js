const mapRow = (row) => row && ({
  id: row.id,
  receiptScanId: row.receipt_scan_id,
  householdId: row.household_id,
  lineNo: row.line_no,
  rawText: row.raw_text,
  parsedName: row.parsed_name,
  parsedQuantity: row.parsed_quantity === null ? null : Number(row.parsed_quantity),
  parsedUnit: row.parsed_unit,
  parsedPrice: row.parsed_price === null ? null : Number(row.parsed_price),
  matchedProductId: row.matched_product_id,
  confidence: row.confidence === null ? null : Number(row.confidence),
  matchMethod: row.match_method,
  status: row.status,
  resolvedInventoryItemId: row.resolved_inventory_item_id,
});

const makeReceiptLineItemRepository = ({ rawQuery }) => {
  return {
    createMany: async (items) => {
      const created = [];
      for (const item of items) {
        const { rows } = await rawQuery(
          `INSERT INTO receipt_line_item
             (receipt_scan_id, household_id, line_no, raw_text, parsed_name, parsed_quantity,
              parsed_unit, parsed_price, matched_product_id, confidence, match_method)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            item.receiptScanId, item.householdId, item.lineNo, item.rawText, item.parsedName,
            item.parsedQuantity, item.parsedUnit, item.parsedPrice, item.matchedProductId,
            item.confidence, item.matchMethod,
          ],
        );
        created.push(mapRow(rows[0]));
      }
      return created;
    },

    listByScanId: async (receiptScanId) => {
      const { rows } = await rawQuery(
        `SELECT * FROM receipt_line_item WHERE receipt_scan_id = $1 ORDER BY line_no`,
        [receiptScanId],
      );
      return rows.map(mapRow);
    },

    findById: async (id) => {
      const { rows } = await rawQuery('SELECT * FROM receipt_line_item WHERE id = $1', [id]);
      return mapRow(rows[0]);
    },

    update: async (id, { parsedName, parsedQuantity, parsedUnit, matchedProductId, status, matchMethod }) => {
      const { rows } = await rawQuery(
        `UPDATE receipt_line_item SET
           parsed_name = COALESCE($2, parsed_name),
           parsed_quantity = COALESCE($3, parsed_quantity),
           parsed_unit = COALESCE($4, parsed_unit),
           matched_product_id = COALESCE($5, matched_product_id),
           status = COALESCE($6, status),
           match_method = COALESCE($7, match_method),
           updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id, parsedName, parsedQuantity, parsedUnit, matchedProductId, status, matchMethod],
      );
      return mapRow(rows[0]);
    },

    markResolved: async (id, inventoryItemId) => {
      await rawQuery(
        `UPDATE receipt_line_item SET status = 'confirmed', resolved_inventory_item_id = $2, updated_at = now()
         WHERE id = $1`,
        [id, inventoryItemId],
      );
    },
  };
};

export { makeReceiptLineItemRepository };
