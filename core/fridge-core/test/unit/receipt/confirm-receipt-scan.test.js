import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeConfirmReceiptScan } from '../../../src/application/use-cases/receipt/confirm-receipt-scan.use-case.js';

const makeFakes = ({ scanStatus = 'review_pending', lockedStatus = scanStatus, lineItems } = {}) => {
  const queries = [];
  const upserts = [];
  const items = lineItems ?? [
    { id: 'l1', parsedQuantity: 2, parsedUnit: 'piece', parsedPrice: 10, matchedProductId: 'p1', status: 'pending' },
    { id: 'l2', parsedQuantity: 1, parsedUnit: 'piece', parsedPrice: 5, matchedProductId: 'p2', status: 'confirmed' },
  ];

  const query = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes('FOR UPDATE')) return { rows: [{ status: lockedStatus }] };
    return { rows: [] };
  };

  return {
    queries,
    upserts,
    deps: {
      datasource: { withTransaction: async (fn) => fn({ query }) },
      receiptScanRepo: { findById: async () => ({ id: 's1', householdId: 'hh', status: scanStatus }) },
      receiptLineItemRepo: { listByScanId: async () => items },
      makeInventoryItemRepo: () => ({
        upsertQuantity: async (input) => {
          upserts.push(input);
          return { id: `inv-${input.productId}` };
        },
      }),
      makeStockMovementRepo: () => ({ create: async () => ({}) }),
    },
  };
};

const input = {
  scanId: 's1',
  householdId: 'hh',
  actorUserId: 'u1',
  storageLocationId: 'loc',
  itemSelections: [{ lineItemId: 'l1' }, { lineItemId: 'l2' }],
};

describe('makeConfirmReceiptScan', () => {
  test('review_pending fişi onaylar ve zaten onaylı satırı atlar', async () => {
    const { deps, upserts } = makeFakes();
    await makeConfirmReceiptScan(deps)(input);
    assert.deepEqual(upserts.map((u) => u.productId), ['p1']);
  });

  test('completed fiş RECEIPT_ALREADY_CONFIRMED döner', async () => {
    const { deps } = makeFakes({ scanStatus: 'completed' });
    await assert.rejects(makeConfirmReceiptScan(deps)(input), { code: 'RECEIPT_ALREADY_CONFIRMED' });
  });

  test('eşzamanlı onayda transaction içindeki kilitli durum completed ise stok eklenmez', async () => {
    const { deps, upserts } = makeFakes({ lockedStatus: 'completed' });
    await assert.rejects(makeConfirmReceiptScan(deps)(input), { code: 'RECEIPT_ALREADY_CONFIRMED' });
    assert.equal(upserts.length, 0);
  });

  test('işlenmekte olan fiş RECEIPT_NOT_READY döner', async () => {
    const { deps } = makeFakes({ scanStatus: 'processing' });
    await assert.rejects(makeConfirmReceiptScan(deps)(input), { code: 'RECEIPT_NOT_READY' });
  });
});
