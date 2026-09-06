import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeGetPlanCatalog } from '../../../../src/application/use-cases/billing/get-plan-catalog.use-case.js';
import { buildPlanLimits, buildProductTiers, PLAN } from '../../../../src/domain/plans.js';

const makeCatalogUseCase = ({ planLimitsJson = null, productTiersJson = null } = {}) => {
  const limitsByPlatform = {
    android: buildPlanLimits(planLimitsJson, 'android'),
    ios: buildPlanLimits(planLimitsJson, 'ios'),
  };
  const planLimitsFor = (platform) => limitsByPlatform[platform] ?? limitsByPlatform.android;
  const productTiersByProductId = buildProductTiers(productTiersJson);
  return makeGetPlanCatalog({ planLimitsFor, productTiersByProductId });
};

describe('getPlanCatalog', () => {
  test('guest/free/premium döner, trial dönmez', () => {
    const getPlanCatalog = makeCatalogUseCase();
    const catalog = getPlanCatalog({ platform: 'android' });
    assert.ok(catalog.plans.guest);
    assert.ok(catalog.plans.free);
    assert.ok(catalog.plans.premium);
    assert.equal(catalog.plans.trial, undefined);
  });

  test('platform verilmezse android varsayılan', () => {
    const getPlanCatalog = makeCatalogUseCase();
    const catalog = getPlanCatalog();
    assert.equal(catalog.platform, 'android');
  });

  test('familySeats aile ürününden çözülür (varsayılan 5)', () => {
    const getPlanCatalog = makeCatalogUseCase();
    const catalog = getPlanCatalog({ platform: 'android' });
    assert.equal(catalog.familySeats, 5);
  });

  test('PLAN_LIMITS_JSON override katalogda görünür', () => {
    const getPlanCatalog = makeCatalogUseCase({
      planLimitsJson: JSON.stringify({ free: { ai: { receipt: 3 } } }),
    });
    const catalog = getPlanCatalog({ platform: 'android' });
    assert.equal(catalog.plans.free.ai.receipt, 3);
    // Diğer alanlar dokunulmadan kalır.
    assert.equal(catalog.plans.premium.ai.receipt, buildPlanLimits()[PLAN.PREMIUM].ai.receipt);
  });

  test('PRODUCT_TIERS_JSON ile koltuk sayısı katalogda değişir', () => {
    const getPlanCatalog = makeCatalogUseCase({
      productTiersJson: JSON.stringify({ fridge_premium_family_monthly: { seats: 6 } }),
    });
    const catalog = getPlanCatalog({ platform: 'android' });
    assert.equal(catalog.familySeats, 6);
  });

  test('ios platformu istenirse ios limit tablosu döner', () => {
    const getPlanCatalog = makeCatalogUseCase();
    const catalog = getPlanCatalog({ platform: 'ios' });
    assert.equal(catalog.platform, 'ios');
    assert.deepEqual(catalog.plans.free, buildPlanLimits(null, 'ios')[PLAN.FREE]);
  });
});
