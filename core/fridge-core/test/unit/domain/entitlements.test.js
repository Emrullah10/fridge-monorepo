import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { resolveEntitlements, canUseAiFeature, isSubscriptionCurrentlyActive, isTrialActive } from '../../../src/domain/entitlements.js';
import { buildPlanLimits, PLAN } from '../../../src/domain/plans.js';

const NOW = new Date('2026-09-15T12:00:00Z');
const planLimitsByPlan = buildPlanLimits();

const days = (n) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

describe('entitlements — plan çözümü (öncelik sırası)', () => {
  test('misafir her zaman GUEST, aktif abonelik/deneme olsa bile', () => {
    const result = resolveEntitlements({
      user: { isGuest: true, trialEndsAt: days(5) },
      subscription: { status: 'active', currentPeriodEnd: days(30), store: 'play' },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.plan, PLAN.GUEST);
    assert.equal(result.source, 'guest');
  });

  test('aktif abonelik + aktif deneme aynı anda -> abonelik kazanır', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: days(5) },
      subscription: { status: 'active', currentPeriodEnd: days(30), store: 'play' },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.plan, PLAN.PREMIUM);
    assert.equal(result.source, 'play');
  });

  test('sadece aktif deneme -> TRIAL, source reverse_trial', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: days(5) },
      subscription: null,
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.plan, PLAN.TRIAL);
    assert.equal(result.source, 'reverse_trial');
  });

  test('deneme süresi geçmiş, abonelik yok -> FREE', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: days(-1) },
      subscription: null,
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.plan, PLAN.FREE);
    assert.equal(result.source, 'signup');
  });

  test('hiç deneme/abonelik yok -> FREE, source signup', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: null },
      subscription: null,
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.plan, PLAN.FREE);
  });
});

describe('entitlements — iptal edilmiş ama dönem bitmemiş abonelik (Play davranışı)', () => {
  test('status=canceled ama current_period_end gelecekte -> hâlâ PREMIUM', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: null },
      subscription: { status: 'canceled', currentPeriodEnd: days(10), store: 'play' },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.plan, PLAN.PREMIUM);
    assert.equal(result.status, 'canceled');
    assert.equal(result.periodEndsAt, days(10));
  });

  test('status=canceled ve current_period_end geçmiş -> erişim kesilir, veri/plan FREE düşer', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: null },
      subscription: { status: 'canceled', currentPeriodEnd: days(-1), store: 'play' },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.plan, PLAN.FREE);
  });

  test('status=canceled ama current_period_end hiç yok (veri tutarsızlığı) -> güvenli tarafta kal, erişim yok', () => {
    assert.equal(isSubscriptionCurrentlyActive({ status: 'canceled', currentPeriodEnd: null }, NOW), false);
  });
});

describe('entitlements — grace period ve hesap beklemede', () => {
  test('in_grace -> erişim AÇIK (Google: grace period access verir)', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: null },
      subscription: { status: 'in_grace', currentPeriodEnd: days(3), store: 'play' },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.plan, PLAN.PREMIUM);
  });

  test('on_hold -> erişim KAPALI, veri kaybı yok, FREE\'ye düşer', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: null },
      subscription: { status: 'on_hold', currentPeriodEnd: days(-5), store: 'play' },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.plan, PLAN.FREE);
    assert.equal(result.status, 'on_hold');
  });

  test('on_hold ama deneme hâlâ aktifse -> TRIAL\'a düşer, FREE\'ye değil', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: days(2) },
      subscription: { status: 'on_hold', currentPeriodEnd: days(-5), store: 'play' },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.plan, PLAN.TRIAL);
  });

  test('revoked (iade/chargeback) -> erişim anında kesilir', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: null },
      subscription: { status: 'revoked', currentPeriodEnd: days(20), store: 'play' },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.plan, PLAN.FREE);
  });

  test('paused -> erişim kapalı', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: null },
      subscription: { status: 'paused', currentPeriodEnd: days(10), store: 'play' },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.plan, PLAN.FREE);
  });
});

describe('entitlements — alan sahibi çarpanı (Karma paylaşım modeli)', () => {
  test('ücretsiz kullanıcı, sahibi premium olan alanın üyesi -> AI kotası 2 katı', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: null },
      subscription: null,
      householdOwnerPlans: { 'household-1': PLAN.PREMIUM },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.plan, PLAN.FREE);
    assert.equal(result.quotas.receipt.limit, planLimitsByPlan[PLAN.FREE].ai.receipt * 2);
    assert.equal(result.quotas.receipt.boosted, true);
  });

  test('ücretsiz kullanıcı, iki ayrı premium alanın üyesi -> çarpan TOPLANMAZ, yine 2x', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: null },
      subscription: null,
      householdOwnerPlans: { 'household-1': PLAN.PREMIUM, 'household-2': PLAN.PREMIUM },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.quotas.chef.limit, planLimitsByPlan[PLAN.FREE].ai.chef * 2);
  });

  test('ücretsiz kullanıcı, sahibi ücretsiz olan alanın üyesi -> çarpan yok', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: null },
      subscription: null,
      householdOwnerPlans: { 'household-1': PLAN.FREE },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.quotas.recipe.limit, planLimitsByPlan[PLAN.FREE].ai.recipe);
    assert.equal(result.quotas.recipe.boosted, false);
  });

  test('premium/deneme kullanıcı zaten en yüksek tavanda -> çarpan hiç uygulanmaz', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: days(5) },
      subscription: null,
      householdOwnerPlans: { 'household-1': PLAN.PREMIUM },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.quotas.shopping.boosted, false);
  });

  test('yapısal limitler (bölüm/üye) alanın SAHİBİNİN planından gelir, üyenin kendi planından değil', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: null },
      subscription: null,
      householdOwnerPlans: { 'household-1': PLAN.PREMIUM },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.households['household-1'].maxLocations, null); // sınırsız
    assert.equal(result.households['household-1'].maxMembers, 10);
  });
});

describe('entitlements — canUseAiFeature kapı fonksiyonu', () => {
  test('misafir her zaman SIGNUP_REQUIRED', () => {
    const entitlements = resolveEntitlements({
      user: { isGuest: true, trialEndsAt: null },
      subscription: null,
      planLimitsByPlan,
      now: NOW,
    });
    const { allowed, reason } = canUseAiFeature(entitlements, 'receipt');
    assert.equal(allowed, false);
    assert.equal(reason, 'SIGNUP_REQUIRED');
  });

  test('kota dolmuş -> PLAN_LIMIT_REACHED', () => {
    const entitlements = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: null },
      subscription: null,
      usageByFeature: { recipe: { used: 15, resetsAt: '2026-10-01' } },
      planLimitsByPlan,
      now: NOW,
    });
    const { allowed, reason } = canUseAiFeature(entitlements, 'recipe');
    assert.equal(allowed, false);
    assert.equal(reason, 'PLAN_LIMIT_REACHED');
  });

  test('kota dolmamış -> izin verilir', () => {
    const entitlements = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: null },
      subscription: null,
      usageByFeature: { recipe: { used: 3, resetsAt: '2026-10-01' } },
      planLimitsByPlan,
      now: NOW,
    });
    const { allowed } = canUseAiFeature(entitlements, 'recipe');
    assert.equal(allowed, true);
  });

  test('sınırsız kota (limit=null) -> hiçbir zaman dolmaz', () => {
    // TRIAL/PREMIUM'un AI limitleri sayısal bir tavan taşıyor (suistimal
    // tavanı, bkz. plans.js) — gerçek limit=null durumu ör. PREMIUM'un
    // location.perHousehold'unda. canUseAiFeature'ın null-limit dalını,
    // özel bir plan-limit override'ıyla izole test ediyoruz.
    const unlimitedPlanLimits = {
      ...planLimitsByPlan,
      [PLAN.TRIAL]: { ...planLimitsByPlan[PLAN.TRIAL], ai: { ...planLimitsByPlan[PLAN.TRIAL].ai, recipe: null } },
    };
    const entitlements = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: days(5) },
      subscription: null,
      usageByFeature: { recipe: { used: 99999, resetsAt: '2026-10-01' } },
      planLimitsByPlan: unlimitedPlanLimits,
      now: NOW,
    });
    const { allowed } = canUseAiFeature(entitlements, 'recipe');
    assert.equal(allowed, true);
  });
});

describe('entitlements — ay ortasında deneme bitişi', () => {
  test('deneme tam ortada bitse bile o ayın ücretsiz kotası TAM verilir, oransal kesilmez', () => {
    // isTrialActive false olduğu an FREE'nin BASE_LIMITS'i uygulanır — burada
    // "oranlama" diye bir kavram yok, bu testin amacı bunu netleştirmek.
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: days(-0.0001) }, // az önce bitti
      subscription: null,
      usageByFeature: { receipt: { used: 0, resetsAt: null } },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.plan, PLAN.FREE);
    assert.equal(result.quotas.receipt.limit, planLimitsByPlan[PLAN.FREE].ai.receipt);
  });
});

describe('isTrialActive / isSubscriptionCurrentlyActive — sınır durumları', () => {
  test('trialEndsAt null -> false', () => {
    assert.equal(isTrialActive({ trialEndsAt: null }, NOW), false);
  });
  test('subscription null -> false', () => {
    assert.equal(isSubscriptionCurrentlyActive(null, NOW), false);
  });
  test('status=pending -> erişim yok (henüz onaylanmadı)', () => {
    assert.equal(isSubscriptionCurrentlyActive({ status: 'pending', currentPeriodEnd: days(30) }, NOW), false);
  });
});

describe('aile koltuğu — resolvePlan sıralaması ve resolveEntitlements çıktısı', () => {
  test('aktif koltuk -> PREMIUM, source family', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: null },
      subscription: null,
      familySeat: { active: true, sponsorUserId: 'sponsor-1', sponsorName: 'Ayşe', householdId: 'h1' },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.plan, PLAN.PREMIUM);
    assert.equal(result.source, 'family');
    assert.deepEqual(result.familySeat, { sponsorUserId: 'sponsor-1', sponsorName: 'Ayşe', householdId: 'h1' });
  });

  test('koltuk taşması (rank > seats) -> familySeat.active=false çağırana bırakılır, resolvePlan FREE\'ye düşer', () => {
    // Bu senaryo pratikte get-entitlements.use-case.js'te hesaplanır (rank<=seats
    // orada kontrol edilir) — burada sadece familySeat.active=false geldiğinde
    // domain'in doğru davrandığını doğruluyoruz.
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: null },
      subscription: null,
      familySeat: { active: false, sponsorUserId: 'sponsor-1', sponsorName: 'Ayşe', householdId: 'h1' },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.plan, PLAN.FREE);
    assert.equal(result.familySeat, null);
  });

  test('kendi aktif aboneliği aile koltuğunu yener', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: null },
      subscription: { status: 'active', currentPeriodEnd: days(30), store: 'play' },
      familySeat: { active: true, sponsorUserId: 'sponsor-1', sponsorName: 'Ayşe', householdId: 'h1' },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.plan, PLAN.PREMIUM);
    assert.equal(result.source, 'play'); // family değil — kendi aboneliği kazandı
  });

  test('aile koltuğu kendi denemesini yener (kafa karıştırıcı düşüş olmasın)', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: days(5) },
      subscription: null,
      familySeat: { active: true, sponsorUserId: 'sponsor-1', sponsorName: 'Ayşe', householdId: 'h1' },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.plan, PLAN.PREMIUM);
    assert.equal(result.source, 'family');
  });

  test('misafir aile koltuğunda olsa bile GUEST kalır', () => {
    const result = resolveEntitlements({
      user: { isGuest: true, trialEndsAt: null },
      subscription: null,
      familySeat: { active: true, sponsorUserId: 'sponsor-1', sponsorName: 'Ayşe', householdId: 'h1' },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.plan, PLAN.GUEST);
  });

  test('familySeat verilmezse (null) mevcut davranış değişmez', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: null },
      subscription: null,
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.plan, PLAN.FREE);
    assert.equal(result.familySeat, null);
  });

  test('familyRoster sadece geçirildiğinde çıktıda görünür', () => {
    const roster = { seats: 5, used: 3, members: [{ userId: 'u1', active: true }] };
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: null },
      subscription: { status: 'active', currentPeriodEnd: days(30), store: 'play' },
      familyRoster: roster,
      planLimitsByPlan,
      now: NOW,
    });
    assert.deepEqual(result.family, roster);
  });

  test('koltuklu üye 2x çarpandan etkilenmez (zaten PREMIUM, tam kota)', () => {
    const result = resolveEntitlements({
      user: { isGuest: false, trialEndsAt: null },
      subscription: null,
      familySeat: { active: true, sponsorUserId: 'sponsor-1', sponsorName: 'Ayşe', householdId: 'h1' },
      usageByFeature: { receipt: { used: 0, resetsAt: null } },
      planLimitsByPlan,
      now: NOW,
    });
    assert.equal(result.quotas.receipt.limit, planLimitsByPlan[PLAN.PREMIUM].ai.receipt);
    assert.equal(result.quotas.receipt.boosted, false);
  });
});
