// Düşüş (downgrade) sonrası kilit — plan §Faz C. household.count limitinin
// ÜSTÜNDE kalan alanlar (en eskiler açık, bkz. access-lock.js) alt uçlarına
// (envanter/alışveriş/tarif/şef/analiz) erişimi 402 HOUSEHOLD_LOCKED ile
// keser. Veri SİLİNMEZ — sadece erişim kapanır (Play politikası + iade
// riski). resolveLockedIds enjekte edilir — middlewares paketi domain'e
// doğrudan bağımlı olmasın diye (requireCapability/requireHouseholdFeature
// ile aynı hexagonal yön).
const requireUnlockedHousehold = ({ getEntitlements, listMembershipsWithJoinedAt, resolveLockedIds, householdIdParam = 'householdId' }) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const householdId = req.params[householdIdParam];
      const entitlements = await getEntitlements({ userId, platform: req.clientPlatform });
      const limit = entitlements.householdCountLimit;

      if (limit === null || limit === undefined) return next(); // sınırsız

      const memberships = await listMembershipsWithJoinedAt(userId);
      const lockedIds = resolveLockedIds({ memberships, limit });

      if (lockedIds.has(householdId)) {
        return res.status(402).json({
          error: { code: 'HOUSEHOLD_LOCKED', message: 'Bu alan plan sınırın dışında kaldı, verilerin silinmedi. Premium ile tekrar açabilirsin.' },
          plan: entitlements.plan,
          householdId,
          upgradeAvailable: entitlements.plan !== 'premium',
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};

export { requireUnlockedHousehold };
