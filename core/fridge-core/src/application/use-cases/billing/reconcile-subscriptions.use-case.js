// Gecelik cron (plan §Faz 5) — dönemi 24 saat içinde bitecek TÜM
// active/in_grace/canceled abonelikleri bulur, her biri için sağlanan
// fetchLatestFromStore (RevenueCat/Play API çağrısı, adaptör olarak
// enjekte edilir) ile TAZE durumu çeker ve yeniden upsert eder. Kaçan
// webhook'un ağı — RC'nin kendisi de retry eder ama backend'in kapalı
// olduğu bir pencereye denk gelirse bu cron son çare.
const makeReconcileSubscriptions = ({ subscriptionRepo, fetchLatestFromStore, log }) => {
  return async () => {
    const expiringSoon = await subscriptionRepo.listExpiringSoon({ withinHours: 24 });
    let reconciled = 0;
    let failed = 0;

    for (const subscription of expiringSoon) {
      try {
        const latest = await fetchLatestFromStore({ purchaseToken: subscription.purchaseToken, userId: subscription.userId });
        if (!latest) continue; // mağazada bulunamadı — dokunma, webhook zaten gelecektir
        await subscriptionRepo.upsert({
          userId: subscription.userId,
          store: subscription.store,
          productId: latest.productId ?? subscription.productId,
          purchaseToken: subscription.purchaseToken,
          rcAppUserId: subscription.rcAppUserId,
          status: latest.status,
          autoRenewing: latest.autoRenewing,
          currentPeriodEnd: latest.currentPeriodEnd,
          canceledAt: latest.canceledAt ?? subscription.canceledAt,
          cancelReason: latest.cancelReason ?? subscription.cancelReason,
          environment: subscription.environment,
          raw: latest.raw ?? subscription.raw,
        });
        reconciled += 1;
      } catch (error) {
        failed += 1;
        log?.warn('reconcile_subscription_failed', { userId: subscription.userId, message: error.message });
      }
    }

    return { checked: expiringSoon.length, reconciled, failed };
  };
};

export { makeReconcileSubscriptions };
