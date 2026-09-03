import { resolveEntitlements, isSubscriptionCurrentlyActive } from '../../../domain/entitlements.js';
import { PLAN, AI_FEATURES } from '../../../domain/plans.js';

// GET /api/me/entitlements — mobilin tek doğruluk kaynağı. Repo'lardan
// gelen ham veriyi entitlements.js'in beklediği şekle indirger, karar
// mantığının TAMAMI domain'de kalır (bu use-case sadece I/O + şekillendirme
// yapar, hexagonal kısıt).
const makeGetEntitlements = ({ userRepo, subscriptionRepo, usageCounterRepo, householdMemberRepo, planLimitsByPlan, clock }) => {
  return async ({ userId }) => {
    const user = await userRepo.findById(userId);
    const subscription = await subscriptionRepo.findByUserId(userId);
    const now = clock.now();

    // Kullanıcının üye olduğu her alan için sahibinin GERÇEK planını çöz —
    // sırayla: misafir sahip -> GUEST (kendi 3-bölüm sınırı korunur, "free"
    // limitlerine sızmasın, bkz. buglog); aktif abonelik -> PREMIUM (2x
    // çarpan + yapısal limit açılımı burada tetiklenir); deneme YOK SAYILIR
    // (bir alanın "premium" sayılması için sahibinin GERÇEK ödeme yapıyor
    // olması yeterli görülür — ters deneme çarpanı tetiklemez, aksi halde
    // her yeni kayıt olan kullanıcı geçici olarak kendi alanına 2x çarpan
    // uygulardı ve deneme bitince kafa karıştırıcı bir düşüş olurdu); hiçbiri
    // değilse -> FREE.
    const ownerRows = await householdMemberRepo.listOwnerSubscriptionsForUser(userId);
    const householdOwnerPlans = {};
    for (const row of ownerRows) {
      if (row.ownerIsGuest) {
        householdOwnerPlans[row.householdId] = PLAN.GUEST;
        continue;
      }
      const ownerIsPremium = isSubscriptionCurrentlyActive(
        { status: row.ownerSubscriptionStatus, currentPeriodEnd: row.ownerCurrentPeriodEnd },
        now,
      );
      householdOwnerPlans[row.householdId] = ownerIsPremium ? PLAN.PREMIUM : PLAN.FREE;
    }

    const usageByFeature = {};
    for (const feature of AI_FEATURES) {
      usageByFeature[feature] = await usageCounterRepo.getCurrentUsage({ userId, feature });
    }

    return resolveEntitlements({
      user: { isGuest: user.isGuest, trialEndsAt: user.trialEndsAt },
      subscription,
      householdOwnerPlans,
      usageByFeature,
      planLimitsByPlan,
      now,
    });
  };
};

export { makeGetEntitlements };
