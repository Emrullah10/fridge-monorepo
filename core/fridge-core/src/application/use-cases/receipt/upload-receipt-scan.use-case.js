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
const makeUploadReceiptScanText = ({ receiptScanRepo }) => {
  return async ({ householdId, uploadedBy }) => {
    return receiptScanRepo.create({ householdId, uploadedBy });
  };
};

export { makeUploadReceiptScan, makeUploadReceiptScanText };
