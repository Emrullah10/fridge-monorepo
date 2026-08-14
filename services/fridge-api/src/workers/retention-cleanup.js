import { log } from '@fridge/helper';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const runRetentionCleanup = async ({ container }) => {
  const { useCases } = container;
  const households = await container.datasource.query('SELECT id FROM household');
  for (const row of households.rows) {
    try {
      const result = await useCases.cleanupExpiredReceiptImages({ householdId: row.id });
      if (result.deletedCount > 0) {
        log.info('retention_cleanup_household', { householdId: row.id, deletedCount: result.deletedCount });
      }
    } catch (error) {
      log.error('retention_cleanup_failed', { householdId: row.id, message: error.message });
    }
  }
};

const startRetentionCleanupWorker = ({ container }) => {
  const tick = () => runRetentionCleanup({ container });
  tick();
  const timer = setInterval(tick, ONE_DAY_MS);
  return { stop: () => clearInterval(timer) };
};

export { startRetentionCleanupWorker, runRetentionCleanup };
