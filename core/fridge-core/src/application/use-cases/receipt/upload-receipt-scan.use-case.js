const makeUploadReceiptScan = ({ receiptScanRepo, storagePort }) => {
  return async ({ householdId, uploadedBy, imageBuffer, extension }) => {
    const { path, bytes, sha256 } = await storagePort.save({
      householdId,
      buffer: imageBuffer,
      extension,
    });

    return receiptScanRepo.create({
      householdId,
      uploadedBy,
      imagePath: path,
      imageBytes: bytes,
      imageSha256: sha256,
    });
  };
};

// Mobil ML Kit ile metni kendisi çıkardıysa görüntü olmadan da fiş açılabilir.
// initialStatus: 'processing' — bu akış route'ta senkron işlendiği için
// scan_processor worker'ının aynı fişi kuyruktan çekip çift işlememesi
// gerekir (bkz. receipt-scan.repository.js create()).
const makeUploadReceiptScanText = ({ receiptScanRepo }) => {
  return async ({ householdId, uploadedBy }) => {
    return receiptScanRepo.create({ householdId, uploadedBy, initialStatus: 'processing' });
  };
};

export { makeUploadReceiptScan, makeUploadReceiptScanText };
