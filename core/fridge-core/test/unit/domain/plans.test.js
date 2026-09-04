import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildPlanLimits, PLAN, AI_FEATURES, PLAN_TIER, buildProductTiers, resolveProductTier } from '../../../src/domain/plans.js';

describe('plans — buildPlanLimits (varsayılan)', () => {
  test('4 plan da tanımlı ve dört AI özelliği eksiksiz', () => {
    const limits = buildPlanLimits();
    for (const plan of Object.values(PLAN)) {
      assert.ok(limits[plan], `${plan} eksik`);
      for (const feature of AI_FEATURES) {
        assert.ok(feature in limits[plan].ai, `${plan}.ai.${feature} eksik`);
      }
    }
  });

  test('GUEST planında tüm AI özellikleri 0 (demo mod, Gemini hiç çağrılmaz)', () => {
    const limits = buildPlanLimits();
    for (const feature of AI_FEATURES) {
      assert.equal(limits[PLAN.GUEST].ai[feature], 0);
    }
  });

  test('FREE < TRIAL/PREMIUM kota sıralaması korunuyor', () => {
    const limits = buildPlanLimits();
    for (const feature of AI_FEATURES) {
      assert.ok(limits[PLAN.FREE].ai[feature] < limits[PLAN.TRIAL].ai[feature]);
    }
  });
});

describe('plans — PLAN_LIMITS_JSON override (deep merge)', () => {
  test('tek bir alan ezilebilir, geri kalan ağaç dokunulmadan kalır', () => {
    const overridden = buildPlanLimits(JSON.stringify({ free: { ai: { receipt: 5 } } }));
    assert.equal(overridden[PLAN.FREE].ai.receipt, 5);
    assert.equal(overridden[PLAN.FREE].ai.recipe, buildPlanLimits()[PLAN.FREE].ai.recipe); // dokunulmadı
    assert.equal(overridden[PLAN.PREMIUM].ai.receipt, buildPlanLimits()[PLAN.PREMIUM].ai.receipt); // dokunulmadı
  });

  test('bozuk JSON sessizce yok sayılır, boot çökmez', () => {
    const result = buildPlanLimits('{not valid json');
    assert.deepEqual(result[PLAN.FREE], buildPlanLimits()[PLAN.FREE]);
  });

  test('null/undefined override -> saf varsayılan', () => {
    assert.deepEqual(buildPlanLimits(null), buildPlanLimits());
    assert.deepEqual(buildPlanLimits(undefined), buildPlanLimits());
  });

  test('household.count gibi iç içe olmayan bir alan da tek başına ezilebilir', () => {
    const overridden = buildPlanLimits(JSON.stringify({ premium: { household: { count: 50 } } }));
    assert.equal(overridden[PLAN.PREMIUM].household.count, 50);
    assert.equal(overridden[PLAN.PREMIUM].location.perHousehold, buildPlanLimits()[PLAN.PREMIUM].location.perHousehold);
  });
});

describe('plans — platform bazlı limitler (ios/android)', () => {
  test('platform verilmezse android varsayılan, mevcut davranış değişmez', () => {
    assert.deepEqual(buildPlanLimits(), buildPlanLimits(null, 'android'));
  });

  test('ios PLATFORM_LIMITS_JSON ile ezilebilir, android etkilenmez', () => {
    const platformJson = JSON.stringify({ ios: { free: { ai: { receipt: 3 } } } });
    const iosLimits = buildPlanLimits(null, 'ios', platformJson);
    const androidLimits = buildPlanLimits(null, 'android', platformJson);
    assert.equal(iosLimits[PLAN.FREE].ai.receipt, 3);
    assert.equal(androidLimits[PLAN.FREE].ai.receipt, buildPlanLimits()[PLAN.FREE].ai.receipt);
  });

  test('bilinmeyen platform android\'e düşer', () => {
    assert.deepEqual(buildPlanLimits(null, 'windows'), buildPlanLimits(null, 'android'));
  });
});

describe('plans — aile paketi ürün→kademe haritası', () => {
  test('bireysel ürünler INDIVIDUAL, seats null', () => {
    const tiers = buildProductTiers();
    assert.equal(tiers.fridge_premium_monthly.tier, PLAN_TIER.INDIVIDUAL);
    assert.equal(tiers.fridge_premium_monthly.seats, null);
  });

  test('aile ürünleri FAMILY, seats 5', () => {
    const tiers = buildProductTiers();
    assert.equal(tiers.fridge_premium_family_monthly.tier, PLAN_TIER.FAMILY);
    assert.equal(tiers.fridge_premium_family_monthly.seats, 5);
    assert.equal(tiers.fridge_premium_family_annual.seats, 5);
  });

  test('PRODUCT_TIERS_JSON ile tek bir ürünün koltuk sayısı ezilebilir', () => {
    const tiers = buildProductTiers(JSON.stringify({ fridge_premium_family_monthly: { seats: 6 } }));
    assert.equal(tiers.fridge_premium_family_monthly.seats, 6);
    assert.equal(tiers.fridge_premium_family_annual.seats, 5); // dokunulmadı
  });

  test('bozuk JSON sessizce yok sayılır', () => {
    const tiers = buildProductTiers('{not valid');
    assert.deepEqual(tiers, buildProductTiers());
  });

  test('resolveProductTier: bilinmeyen product_id INDIVIDUAL/null döner (güvenli taraf)', () => {
    const tiers = buildProductTiers();
    const result = resolveProductTier('unknown_sku_xyz', tiers);
    assert.deepEqual(result, { tier: PLAN_TIER.INDIVIDUAL, seats: null });
  });

  test('resolveProductTier: bilinen product_id doğru kademeyi döner', () => {
    const tiers = buildProductTiers();
    const result = resolveProductTier('fridge_premium_family_annual', tiers);
    assert.equal(result.tier, PLAN_TIER.FAMILY);
    assert.equal(result.seats, 5);
  });
});
