import { PLAN } from '../../../domain/plans.js';

// GET /api/plans — oturum açılmadan bile çağrılabilen plan kataloğu.
// get-entitlements.use-case.js'in aksine belirli bir kullanıcıya değil,
// TÜM planlara bakar — paywall/tanıtım kartlarının "Ücretsiz vs Premium"
// karşılaştırmasını sabit sayı yazmadan (mimari ilke: mobilde limit sabiti
// tutulmaz) çizebilmesi için. I/O yok, planLimitsFor/productTiers zaten
// boot'ta hesaplanmış — bu use-case sadece şekillendirir (hexagonal kısıt).
//
// trial kasıtlı olarak DÖNMÜYOR: limitleri premium'la birebir aynı
// (bkz. plans.js BASE_LIMITS), karşılaştırma tablosunda üçüncü bir kolon
// açmak gürültüden başka bir şey katmaz.
const makeGetPlanCatalog = ({ planLimitsFor, productTiersByProductId }) => {
  return ({ platform = 'android' } = {}) => {
    const limitsByPlan = planLimitsFor(platform);
    const familySeats = Object.values(productTiersByProductId).find((tier) => tier.seats)?.seats ?? null;

    return {
      platform,
      plans: {
        guest: limitsByPlan[PLAN.GUEST],
        free: limitsByPlan[PLAN.FREE],
        premium: limitsByPlan[PLAN.PREMIUM],
      },
      familySeats,
    };
  };
};

export { makeGetPlanCatalog };
