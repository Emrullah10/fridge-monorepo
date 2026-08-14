import { ValidationError } from '@fridge/errors';
import { ReceiptNotReadyError } from '../../../domain/errors/index.js';

// Onaylanan her satır için tek transaction içinde envanteri upsert eder ve
// stock_movement kaydı açar. Yarısı işlenip yarısı işlenmemiş bir fiş
// envanteri sessizce bozacağı için transaction zorunlu.
const makeConfirmReceiptScan = ({
  datasource,
  receiptScanRepo,
  receiptLineItemRepo,
  makeInventoryItemRepo,
  makeStockMovementRepo,
}) => {
  return async ({ scanId, actorUserId, storageLocationId, itemSelections }) => {
    const scan = await receiptScanRepo.findById(scanId);
    if (scan.status !== 'review_pending') {
      throw new ReceiptNotReadyError(scan.status);
    }

    const lineItems = await receiptLineItemRepo.listByScanId(scanId);
    const selectedIds = new Set(itemSelections.map((s) => s.lineItemId));
    const toConfirm = lineItems.filter((item) => selectedIds.has(item.id));

    if (toConfirm.length === 0) {
      throw new ValidationError('No line items selected for confirmation');
    }

    await datasource.withTransaction(async ({ query }) => {
      const inventoryItemRepo = makeInventoryItemRepo({ rawQuery: query });
      const stockMovementRepo = makeStockMovementRepo({ rawQuery: query });

      for (const lineItem of toConfirm) {
        const selection = itemSelections.find((s) => s.lineItemId === lineItem.id);
        const productId = selection.matchedProductId ?? lineItem.matchedProductId;
        if (!productId) {
          throw new ValidationError(`Line item ${lineItem.id} has no matched product`);
        }

        const inventoryItem = await inventoryItemRepo.upsertQuantity({
          householdId: scan.householdId,
          storageLocationId: selection.storageLocationId ?? storageLocationId,
          productId,
          unit: lineItem.parsedUnit,
          expiresAt: selection.expiresAt ?? null,
          deltaQuantity: lineItem.parsedQuantity,
        });

        await stockMovementRepo.create({
          householdId: scan.householdId,
          inventoryItemId: inventoryItem.id,
          delta: lineItem.parsedQuantity,
          reason: 'receipt',
          actorUserId,
          receiptLineItemId: lineItem.id,
        });

        await query(
          `UPDATE receipt_line_item SET status = 'confirmed', resolved_inventory_item_id = $2, updated_at = now()
           WHERE id = $1`,
          [lineItem.id, inventoryItem.id],
        );
      }

      await query(`UPDATE receipt_scan SET status = 'completed', updated_at = now() WHERE id = $1`, [scanId]);
    });

    return receiptScanRepo.findById(scanId);
  };
};

export { makeConfirmReceiptScan };
