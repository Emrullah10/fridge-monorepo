import { log } from '@fridge/helper';

// receipt_scan tablosunun kendisi kuyruk. FOR UPDATE SKIP LOCKED sayesinde
// birden fazla instance çalışsa bile aynı fişi iki kez işlemez.
const startScanProcessor = ({ container, intervalMs }) => {
  const { repos, useCases } = container;

  const tick = async () => {
    try {
      const claimed = await repos.receiptScanRepo.claimNextUploaded();
      if (!claimed) return;

      log.info('scan_processing_started', { scanId: claimed.id });
      await useCases.processReceiptScan({ scanId: claimed.id });
      log.info('scan_processing_finished', { scanId: claimed.id });
    } catch (error) {
      log.error('scan_processor_tick_failed', { message: error.message });
    }
  };

  const timer = setInterval(tick, intervalMs);
  return { stop: () => clearInterval(timer) };
};

export { startScanProcessor };
