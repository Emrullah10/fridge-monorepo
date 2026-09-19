import { resolveEntitlements, isSubscriptionCurrentlyActive } from '../../../domain/entitlements.js';
import { PLAN, AI_FEATURES } from '../../../domain/plans.js';

// GET /api/me/entitlements — mobilin tek doğruluk kaynağı. Repo'lardan
// gelen ham veriyi entitlements.js'in beklediği şekle indirger, karar
// mantığının TAMAMI domain'de kalır (bu use-case sadece I/O + şekillendirme
// yapar, hexagonal kısıt).
// planLimitsFor(platform): container.js'te boot'ta önceden hesaplanmış
// android/ios tablolarından birini döner (bkz. plans.js buildPlanLimits
// platform parametresi, plan §Faz D). platform verilmezse 'android' —
// çağıranın X-Client-Platform başlığını unuttuğu yerlerde sessizce en
// cömert (mevcut) davranışa düşer, asla daha KISIK bir limite değil.
const makeGetEntitlements = ({ userRepo, subscriptionRepo, usageCounterRepo, householdMemberRepo, planLimitsFor, clock }) => {
  // Faz 0 performans turu: aynı istekte requireUnlockedHousehold +
  // requireCapability (ve bazen route'un kendisi) bu fonksiyonu userId+
  // platform için EŞZAMANLI 2-3 kez çağırıyor. Aşağıdaki Map, aynı anda
  // bekleyen çağrılara AYNI promise'i döndürür — ikinci/üçüncü çağrı ayrı
  // bir DB turu açmaz, ilkinin sonucunu bekler. `finally` ile Map'ten silmek
  // ŞART: aksi halde ilk çağrı bittikten SONRA gelen (farklı bir isteğe ait)
  // bir sonraki çağrı da bu eski sonucu paylaşırdı — bu, entitlements'ın
  // asla bayat sunulmaması gereken kuralını (bkz. plan §Faz 0/4, usageByFeature
  // kota kararını doğrudan etkiliyor) bozardı. Yani bu bir CACHE değil, yalnızca
  // "aynı anda aynı şeyi soran çağrıları tek DB turuna indirgeyen" bir
  // dedup — event-loop turunun ötesine asla veri taşımaz.
  const inFlight = new Map();

  const fetchEntitlements = async ({ userId, platform = 'android' }) => {
    const planLimitsByPlan = planLimitsFor(platform);
    const now = clock.now();

    // Faz 0 performans turu: bu 4 sorgu birbirinden BAĞIMSIZ (farklı
    // repo'lar, ortak bir ÖNCEKİ sonuca ihtiyaç duymuyorlar) — eskiden seri
    // await edilip 4 ayrı DB round-trip'i oluyordu, requireUnlockedHousehold
    // + requireCapability aynı istekte bu fonksiyonu 2 kez çağırdığı için
    // etkisi ikiye katlanıyordu (tek AI isteğinde ~8 seri round-trip).
    // usageByFeature ayrıca kendi içinde AI_FEATURES kadar (4) seri sorguydu,
    // artık TEK SQL turu (getCurrentUsageForAllFeatures, bkz. usage-counter.
    // repository.js) — o da bu Promise.all'a giriyor.
    const [user, subscription, ownerRows, usageByFeature, familySeatRow] = await Promise.all([
      userRepo.findById(userId),
      subscriptionRepo.findByUserId(userId),
      householdMemberRepo.listOwnerSubscriptionsForUser(userId),
      usageCounterRepo.getCurrentUsageForAllFeatures({ userId, features: AI_FEATURES }),
      // Aile koltuğu — kullanıcının bağlı olduğu aile sponsoru varsa, kendi
      // aktif aboneliği yoksa koltuk PLAN.PREMIUM'a taşır (bkz. entitlements.js
      // resolvePlan sıralaması). rank<=seats ve sponsor aboneliği erişim veren
      // durumdaysa "active" — canlı karar burada verilir, repo ham veri döner
      // (household-member.repository.js findFamilySeatForUser aynı ilke).
      householdMemberRepo.findFamilySeatForUser(userId),
    ]);

    // Kullanıcının üye olduğu her alan için sahibinin GERÇEK planını çöz —
    // sırayla: misafir sahip -> GUEST (kendi 3-bölüm sınırı korunur, "free"
    // limitlerine sızmasın, bkz. buglog); aktif abonelik -> PREMIUM (2x
    // çarpan + yapısal limit açılımı burada tetiklenir); deneme YOK SAYILIR
    // (bir alanın "premium" sayılması için sahibinin GERÇEK ödeme yapıyor
    // olması yeterli görülür — ters deneme çarpanı tetiklemez, aksi halde
    // her yeni kayıt olan kullanıcı geçici olarak kendi alanına 2x çarpan
    // uygulardı ve deneme bitince kafa karıştırıcı bir düşüş olurdu); hiçbiri
    // değilse -> FREE.
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

    const familySeat = familySeatRow
      ? {
          active:
            familySeatRow.rank !== null &&
            familySeatRow.rank <= familySeatRow.seats &&
            isSubscriptionCurrentlyActive(
              { status: familySeatRow.sponsorStatus, currentPeriodEnd: familySeatRow.sponsorCurrentPeriodEnd },
              now,
            ),
          sponsorUserId: familySeatRow.sponsorUserId,
          sponsorName: familySeatRow.sponsorName,
          householdId: familySeatRow.householdId,
        }
      : null;

    // Roster: SADECE kullanıcının kendisi bir aile aboneliğinin sahibiyse
    // dolu döner — abonelik ekranında "Aile üyeleri 3/5" göstermek için.
    // subscription'a bağımlı olduğu için üstteki Promise.all'a giremiyor.
    let familyRoster = null;
    if (subscription?.planTier === 'family' && isSubscriptionCurrentlyActive(subscription, now)) {
      const seatRows = await householdMemberRepo.listFamilySeats({ ownerUserId: userId, seats: subscription.seats });
      familyRoster = { seats: subscription.seats, used: seatRows.filter((s) => s.active).length, members: seatRows };
    }

    return resolveEntitlements({
      user: { isGuest: user.isGuest, trialEndsAt: user.trialEndsAt },
      subscription,
      householdOwnerPlans,
      usageByFeature,
      planLimitsByPlan,
      now,
      familySeat,
      familyRoster,
    });
  };

  return ({ userId, platform = 'android' }) => {
    const key = `${userId}:${platform}`;
    const pending = inFlight.get(key);
    if (pending) return pending;

    const promise = fetchEntitlements({ userId, platform }).finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  };
};

export { makeGetEntitlements };
