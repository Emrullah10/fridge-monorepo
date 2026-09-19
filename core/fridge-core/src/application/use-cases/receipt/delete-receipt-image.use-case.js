import { NotFoundError } from '@fridge/errors';

const makeDeleteReceiptImage = ({ receiptScanRepo, storagePort }) => {
  // householdId opsiyonel (geriye dönük uyumluluk) — geçirildiğinde
  // savunma derinliği: route zaten assertOwnedByHousehold ile doğruluyor,
  // burası yeni bir çağıranın o korumayı devralmasını sağlar.
  return async ({ scanId, householdId }) => {
    const scan = await receiptScanRepo.findById(scanId);
    if (!scan || (householdId !== undefined && scan.householdId !== householdId)) {
      throw new NotFoundError('Receipt scan not found');
    }
    if (scan.imagePath) {
      await storagePort.remove({ path: scan.imagePath });
      await receiptScanRepo.markImageDeleted(scanId);
    }
    return receiptScanRepo.findById(scanId);
  };
};

export { makeDeleteReceiptImage };
