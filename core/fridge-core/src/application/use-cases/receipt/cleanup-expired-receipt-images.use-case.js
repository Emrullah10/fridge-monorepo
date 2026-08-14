// Günlük cron tarafından çağrılır. receipt_scan ve satır kalemleri (envanter
// geçmişi) hiç silinmez — sadece görüntü household ayarına göre silinir.
const makeCleanupExpiredReceiptImages = ({ householdRepo, receiptScanRepo, storagePort, clock }) => {
  return async ({ householdId }) => {
    const household = await householdRepo.findById(householdId);
    if (household.receiptImageRetentionDays === null) {
      return { deletedCount: 0 };
    }

    const cutoffDate = new Date(
      clock.now().getTime() - household.receiptImageRetentionDays * 24 * 60 * 60 * 1000,
    );

    const scans = await receiptScanRepo.listImagesOlderThan({ householdId, cutoffDate });

    let deletedCount = 0;
    for (const scan of scans) {
      await storagePort.remove({ path: scan.imagePath });
      await receiptScanRepo.markImageDeleted(scan.id);
      deletedCount += 1;
    }

    return { deletedCount };
  };
};

export { makeCleanupExpiredReceiptImages };
