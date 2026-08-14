import { ValidationError, NotFoundError } from '@fridge/errors';

const MAX_ATTEMPTS = 3;

const makeRetryReceiptScan = ({ receiptScanRepo }) => {
  return async ({ scanId }) => {
    const scan = await receiptScanRepo.findById(scanId);
    if (!scan) {
      throw new NotFoundError('Receipt scan not found');
    }

    if (scan.status !== 'failed') {
      throw new ValidationError('Only failed scans can be retried');
    }

    if (scan.attemptCount >= MAX_ATTEMPTS) {
      throw new ValidationError(`Max retry attempts (${MAX_ATTEMPTS}) reached`);
    }

    return receiptScanRepo.resetToUploaded(scanId);
  };
};

export { makeRetryReceiptScan, MAX_ATTEMPTS };
