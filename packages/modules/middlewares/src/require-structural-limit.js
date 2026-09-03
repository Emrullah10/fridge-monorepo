// AI dışı yapısal limitler için ortak kapı: alan sayısı, alan başına bölüm/
// üye sayısı, envanter satırı toplamı (bkz. plan §Faz 3 limit tablosu).
// requireCapability'den farklı olarak burada "rezervasyon" yok — sayım her
// zaman canlı COUNT(*) ile yapılır (envanter/bölüm/üye silinebilir/eklenebilir,
// AI kotası gibi aylık biriken bir sayaç değil).
//
// misafir bazı özelliklerde (davet) limitValue=0 görüp doğrudan
// SIGNUP_REQUIRED alır — plan.household.member.perHousehold=0 bunu zaten
// domain seviyesinde ifade ediyor, burada ayrı bir dal AÇMIYORUZ (limit=0
// ise currentCount>=0 her zaman true, aynı 402 yolundan geçer).
const requireStructuralLimit = (limitKey, { getEntitlements, countCurrent, householdIdParam = 'householdId' }) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const entitlements = await getEntitlements({ userId });

      // Alan-bazlı limitler (location/member) alanın SAHİBİNİN planından
      // gelir — entitlements.households[householdId] (bkz. entitlements.js
      // resolveHouseholdLimits). Kullanıcı-bazlı limitler (household.count,
      // inventory.itemsTotal) entitlements'ın kendisine gömülü
      // (householdCountLimit/inventoryItemsLimit alanları) — plans.js
      // burada tekrar okunmaz, tek doğruluk kaynağı entitlements.js kalır.
      const limitValue = resolveLimitValue(limitKey, { entitlements, householdId: req.params[householdIdParam] });

      if (limitValue === null) return next(); // sınırsız

      const currentCount = await countCurrent(req);
      if (currentCount >= limitValue) {
        return res.status(402).json({
          error: { code: 'PLAN_LIMIT_REACHED', message: describeLimitReached(limitKey) },
          plan: entitlements.plan,
          feature: limitKey,
          limit: limitValue,
          used: currentCount,
          upgradeAvailable: entitlements.plan !== 'premium',
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};

const resolveLimitValue = (limitKey, { entitlements, householdId }) => {
  switch (limitKey) {
    case 'household.count':
      return entitlements.householdCountLimit ?? null;
    case 'location.perHousehold':
      return entitlements.households[householdId]?.maxLocations ?? null;
    case 'member.perHousehold':
      return entitlements.households[householdId]?.maxMembers ?? null;
    case 'inventory.itemsTotal':
      return entitlements.inventoryItemsLimit ?? null;
    default:
      return null;
  }
};

const describeLimitReached = (limitKey) => {
  switch (limitKey) {
    case 'household.count':
      return 'Açabileceğin alan sayısına ulaştın.';
    case 'location.perHousehold':
      return 'Bu alanda bölüm sayısı sınırına ulaşıldı.';
    case 'member.perHousehold':
      return 'Bu alanda üye sayısı sınırına ulaşıldı.';
    case 'inventory.itemsTotal':
      return 'Misafir olarak ekleyebileceğin ürün sayısına ulaştın.';
    default:
      return 'Bu işlem için plan sınırına ulaşıldı.';
  }
};

export { requireStructuralLimit };
