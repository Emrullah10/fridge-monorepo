import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeGetEntitlements } from '../../../../src/application/use-cases/billing/get-entitlements.use-case.js';
import { buildPlanLimits, PLAN } from '../../../../src/domain/plans.js';

const NOW = new Date('2026-09-17T12:00:00Z');
const clock = { now: () => NOW };
const planLimitsByPlan = buildPlanLimits(null, 'android');
const planLimitsFor = () => planLimitsByPlan;

// Faz 0 performans turu: bu use-case artık userRepo/subscriptionRepo/
// householdMemberRepo(x2)/usageCounterRepo çağrılarını Promise.all ile
// PARALEL yapıyor (bkz. get-entitlements.use-case.js). Bu testler hem
// SONUÇ doğruluğunu (paralelleştirme sonucu bozmamalı) hem de kaç kez
// gerçek DB'ye (burada: sahte repo'lara) gidildiğini doğruluyor.
const makeFakes = (overrides = {}) => {
  const callCounts = { userRepo: 0, subscriptionRepo: 0, ownerSubs: 0, usage: 0, familySeat: 0 };

  const userRepo = {
    findById: async () => { callCounts.userRepo += 1; return { isGuest: false, trialEndsAt: null }; },
    ...overrides.userRepo,
  };
  const subscriptionRepo = {
    findByUserId: async () => { callCounts.subscriptionRepo += 1; return null; },
    ...overrides.subscriptionRepo,
  };
  const usageCounterRepo = {
    getCurrentUsageForAllFeatures: async ({ features }) => {
      callCounts.usage += 1;
      const result = {};
      for (const f of features) result[f] = { used: 0, resetsAt: null };
      return result;
    },
    ...overrides.usageCounterRepo,
  };
  const householdMemberRepo = {
    listOwnerSubscriptionsForUser: async () => { callCounts.ownerSubs += 1; return []; },
    findFamilySeatForUser: async () => { callCounts.familySeat += 1; return null; },
    listFamilySeats: async () => [],
    ...overrides.householdMemberRepo,
  };

  return { callCounts, userRepo, subscriptionRepo, usageCounterRepo, householdMemberRepo };
};

describe('makeGetEntitlements', () => {
  test('temel akış: free plan, sıfır kullanım', async () => {
    const fakes = makeFakes();
    const getEntitlements = makeGetEntitlements({ ...fakes, planLimitsFor, clock });

    const result = await getEntitlements({ userId: 'u1', platform: 'android' });

    assert.equal(result.plan, PLAN.FREE);
    assert.equal(result.quotas.receipt.used, 0);
    assert.equal(result.householdCountLimit, planLimitsByPlan.free.household.count);
  });

  test('5 bağımsız repo çağrısının HEPSİ tetiklenir (Promise.all sonucu eksik veri kalmaz)', async () => {
    const fakes = makeFakes();
    const getEntitlements = makeGetEntitlements({ ...fakes, planLimitsFor, clock });

    await getEntitlements({ userId: 'u1', platform: 'android' });

    assert.equal(fakes.callCounts.userRepo, 1);
    assert.equal(fakes.callCounts.subscriptionRepo, 1);
    assert.equal(fakes.callCounts.ownerSubs, 1);
    assert.equal(fakes.callCounts.usage, 1, 'getCurrentUsageForAllFeatures TEK çağrıda tüm özellikleri almalı');
    assert.equal(fakes.callCounts.familySeat, 1);
  });

  test('request-scoped dedup: AYNI req objesiyle eşzamanlı 2 çağrı TEK gerçek DB turu yapar', async () => {
    const fakes = makeFakes();
    const getEntitlements = makeGetEntitlements({ ...fakes, planLimitsFor, clock });

    // requireUnlockedHousehold + requireCapability aynı req'te bu fonksiyonu
    // sırayla ÇAĞIRABİLİR (middleware zinciri) — ama in-flight dedup
    // (bkz. use-case'in kendi Map'i) SENKRON başlatılan eşzamanlı çağrılar
    // için tetiklenir, bunu burada doğruluyoruz.
    const [r1, r2] = await Promise.all([
      getEntitlements({ userId: 'u1', platform: 'android' }),
      getEntitlements({ userId: 'u1', platform: 'android' }),
    ]);

    assert.equal(fakes.callCounts.userRepo, 1, 'eşzamanlı aynı userId+platform TEK DB turu üretmeli');
    assert.deepEqual(r1, r2);
  });

  test('farklı userId eşzamanlı çağrılsa bile BAĞIMSIZ DB turları yapar (yanlış kullanıcıya sızma yok)', async () => {
    const fakes = makeFakes();
    const getEntitlements = makeGetEntitlements({ ...fakes, planLimitsFor, clock });

    await Promise.all([
      getEntitlements({ userId: 'u1', platform: 'android' }),
      getEntitlements({ userId: 'u2', platform: 'android' }),
    ]);

    assert.equal(fakes.callCounts.userRepo, 2, 'farklı userId ayrı DB turu üretmeli, ASLA paylaşılmamalı');
  });

  test('sıralı (art arda await edilen) çağrılar HER SEFERİNDE yeni DB turu yapar (bayatlama yok)', async () => {
    const fakes = makeFakes();
    const getEntitlements = makeGetEntitlements({ ...fakes, planLimitsFor, clock });

    await getEntitlements({ userId: 'u1', platform: 'android' });
    await getEntitlements({ userId: 'u1', platform: 'android' });

    assert.equal(fakes.callCounts.userRepo, 2, 'ilk çağrı TAMAMLANDIKTAN sonra gelen ikinci çağrı taze veri almalı');
  });

  test('misafir sahip -> GUEST plan householdOwnerPlans\'a yansır', async () => {
    const fakes = makeFakes({
      householdMemberRepo: {
        listOwnerSubscriptionsForUser: async () => [{ householdId: 'hh-1', ownerIsGuest: true }],
        findFamilySeatForUser: async () => null,
        listFamilySeats: async () => [],
      },
    });
    const getEntitlements = makeGetEntitlements({ ...fakes, planLimitsFor, clock });

    const result = await getEntitlements({ userId: 'u1', platform: 'android' });
    assert.equal(result.households['hh-1'].ownerPlan, PLAN.GUEST);
  });
});
