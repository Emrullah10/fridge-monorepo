import { ValidationError, NotFoundError } from '@fridge/errors';

const MAX_ATTEMPTS = 3;

const makeRetryReceiptScan = ({ receiptScanRepo }) => {
  // householdId opsiyonel bırakılır (geriye dönük uyumluluk için) ama
  // geçirildiğinde savunma derinliği sağlar — route zaten assertOwnedByHousehold
  // ile doğruluyor, burası yeni bir çağıranın o korumayı devralmasını sağlar.
  return async ({ scanId, householdId }) => {
    const scan = await receiptScanRepo.findById(scanId);
    if (!scan || (householdId !== undefined && scan.householdId !== householdId)) {
      throw new NotFoundError('Receipt scan not found');
    }

    if (scan.status !== 'failed') {
      throw new ValidationError('Yalnızca başarısız fişler yeniden denenebilir');
    }

    if (scan.attemptCount >= MAX_ATTEMPTS) {
      throw new ValidationError(`En fazla ${MAX_ATTEMPTS} kez yeniden denenebilir`);
    }

    return receiptScanRepo.resetToUploaded(scanId);
  };
};

export { makeRetryReceiptScan, MAX_ATTEMPTS };
