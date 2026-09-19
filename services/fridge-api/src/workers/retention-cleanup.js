import { log } from '@fridge/helper';

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

  // user_session revoke edilen/süresi geçmiş satırları hiç silmiyordu —
  // sürekli büyüyen bir tablo (bkz. plan §Faz 0, idx_user_session_active_
  // refresh_hash migration'ıyla aynı bulgu). Household'lardan bağımsız,
  // household döngüsünün DIŞINDA tek seferlik — bir kullanıcının birden
  // fazla household'ı olabilir, tekrar tekrar silmeye gerek yok.
  try {
    const deletedSessions = await container.repos.sessionRepo.deleteExpiredAndRevoked({ olderThanDays: 30 });
    if (deletedSessions > 0) {
      log.info('retention_cleanup_sessions', { deletedCount: deletedSessions });
    }
  } catch (error) {
    log.error('retention_cleanup_sessions_failed', { message: error.message });
  }
};

const startRetentionCleanupWorker = ({ container, intervalMs }) => {
  const tick = () => runRetentionCleanup({ container });
  tick();
  const timer = setInterval(tick, intervalMs);
  return { stop: () => clearInterval(timer) };
};

export { startRetentionCleanupWorker, runRetentionCleanup };
