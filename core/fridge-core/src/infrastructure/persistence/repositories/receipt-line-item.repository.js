import { suggestStorageKind } from '../../../domain/storage-suggestion.js';

const mapRow = (row) => row && ({
  id: row.id,
  receiptScanId: row.receipt_scan_id,
  householdId: row.household_id,
  lineNo: row.line_no,
  rawText: row.raw_text,
  parsedName: row.parsed_name,
  parsedBrand: row.parsed_brand,
  parsedQuantity: row.parsed_quantity === null ? null : Number(row.parsed_quantity),
  parsedUnit: row.parsed_unit,
  parsedPrice: row.parsed_price === null ? null : Number(row.parsed_price),
  matchedProductId: row.matched_product_id,
  confidence: row.confidence === null ? null : Number(row.confidence),
  matchMethod: row.match_method,
  status: row.status,
  resolvedInventoryItemId: row.resolved_inventory_item_id,
});

// listByScanId'nin JOIN'li satırları için: eşleşen ürünün kategorisine
// bakıp bölüm önerisi (fridge/freezer/pantry) ekler. Kolon değil — okuma
// anında hesaplanır, böylece kullanıcı ürünün kategorisini düzeltirse
// öneri de anında güncel olur.
const mapRowWithSuggestion = (row) => {
  const item = mapRow(row);
  if (!item) return item;
  return {
    ...item,
    suggestedStorageKind: suggestStorageKind({ categoryKey: row.category_key, productName: item.parsedName }),
  };
};

const makeReceiptLineItemRepository = ({ rawQuery }) => {
  return {
    createMany: async (items) => {
      const created = [];
      for (const item of items) {
        const { rows } = await rawQuery(
          `INSERT INTO receipt_line_item
             (receipt_scan_id, household_id, line_no, raw_text, parsed_name, parsed_brand,
              parsed_quantity, parsed_unit, parsed_price, matched_product_id, confidence, match_method)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
          [
            item.receiptScanId, item.householdId, item.lineNo, item.rawText, item.parsedName,
            item.parsedBrand ?? null, item.parsedQuantity, item.parsedUnit, item.parsedPrice,
            item.matchedProductId, item.confidence, item.matchMethod,
          ],
        );
        created.push(mapRow(rows[0]));
      }
      return created;
    },

    listByScanId: async (receiptScanId) => {
      const { rows } = await rawQuery(
        `SELECT rli.*, pc.key AS category_key
         FROM receipt_line_item rli
         LEFT JOIN product p ON p.id = rli.matched_product_id
         LEFT JOIN product_category pc ON pc.id = p.category_id
         WHERE rli.receipt_scan_id = $1
         ORDER BY rli.line_no`,
        [receiptScanId],
      );
      return rows.map(mapRowWithSuggestion);
    },

    findById: async (id) => {
      const { rows } = await rawQuery('SELECT * FROM receipt_line_item WHERE id = $1', [id]);
      return mapRow(rows[0]);
    },

    update: async (id, { parsedName, parsedBrand, parsedQuantity, parsedUnit, matchedProductId, status, matchMethod }) => {
      const { rows } = await rawQuery(
        `UPDATE receipt_line_item SET
           parsed_name = COALESCE($2, parsed_name),
           parsed_brand = COALESCE($3, parsed_brand),
           parsed_quantity = COALESCE($4, parsed_quantity),
           parsed_unit = COALESCE($5, parsed_unit),
           matched_product_id = COALESCE($6, matched_product_id),
           status = COALESCE($7, status),
           match_method = COALESCE($8, match_method),
           updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id, parsedName, parsedBrand, parsedQuantity, parsedUnit, matchedProductId, status, matchMethod],
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
