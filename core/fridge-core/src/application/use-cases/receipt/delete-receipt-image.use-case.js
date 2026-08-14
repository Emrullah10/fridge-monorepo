import { NotFoundError } from '@fridge/errors';

const makeDeleteReceiptImage = ({ receiptScanRepo, storagePort }) => {
  return async ({ scanId }) => {
    const scan = await receiptScanRepo.findById(scanId);
    if (!scan) {
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
