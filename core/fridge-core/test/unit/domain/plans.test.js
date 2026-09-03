import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildPlanLimits, PLAN, AI_FEATURES } from '../../../src/domain/plans.js';

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
