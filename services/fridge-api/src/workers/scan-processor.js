import { log } from '@fridge/helper';

// processing'de bu süreden uzun kalan fiş "takılı" sayılır. Hem foto
// yükleme (worker işler, saniyeler sürer) hem /scan-text (route senkron
// işler, o da saniyeler sürer) için bu süre fazlasıyla yeterli — normal
// işlemeyi stale sanıp erken reclaim etmemek için kasıtlı olarak büyük.
const STALE_PROCESSING_MS = 5 * 60 * 1000;
const STALE_CHECK_EVERY_N_TICKS = 12; // ~1 dakikada bir (intervalMs=5000 varsayımıyla)

// receipt_scan tablosunun kendisi kuyruk. FOR UPDATE SKIP LOCKED sayesinde
// birden fazla instance çalışsa bile aynı fişi iki kez işlemez.
const startScanProcessor = ({ container, intervalMs }) => {
  const { repos, useCases } = container;
  let stopped = false;
  let timer = null;
  let tickCount = 0;

  const tick = async () => {
    try {
      tickCount += 1;
      if (tickCount % STALE_CHECK_EVERY_N_TICKS === 0) {
        const reclaimed = await repos.receiptScanRepo.reclaimStaleProcessing({ staleAfterMs: STALE_PROCESSING_MS });
        if (reclaimed > 0) log.warn('scan_stale_reclaimed', { count: reclaimed });
      }

      const claimed = await repos.receiptScanRepo.claimNextUploaded();
      if (!claimed) return;

      log.info('scan_processing_started', { scanId: claimed.id });
      await useCases.processReceiptScan({ scanId: claimed.id });
      log.info('scan_processing_finished', { scanId: claimed.id });
    } catch (error) {
      log.error('scan_processor_tick_failed', { message: error.message });
    }
  };

  // setInterval yerine self-scheduling setTimeout: bir tick'in işi
  // intervalMs'den uzun sürerse (Ollama/Tesseract yavaşsa) önceki tick
  // bitmeden yenisi başlamaz — kuyrukta çok fiş varsa sınırsız paralel
  // işlem doğup belleği patlatma riski böyle önlenir.
  const scheduleNext = () => {
    if (stopped) return;
    timer = setTimeout(async () => {
      await tick();
      scheduleNext();
    }, intervalMs);
  };

  scheduleNext();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
};

export { startScanProcessor };
