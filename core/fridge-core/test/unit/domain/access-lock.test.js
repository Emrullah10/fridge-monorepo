import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { resolveLockedHouseholdIds, resolveLockedLocationIds, resolveInsightsWindow } from '../../../src/domain/access-lock.js';

describe('resolveLockedHouseholdIds — en eski açık kalır', () => {
  const memberships = [
    { householdId: 'h3', joinedAt: '2026-01-03T00:00:00Z' },
    { householdId: 'h1', joinedAt: '2026-01-01T00:00:00Z' },
    { householdId: 'h2', joinedAt: '2026-01-02T00:00:00Z' },
  ];

  test('limit null -> hiçbiri kilitli değil', () => {
    assert.deepEqual(resolveLockedHouseholdIds({ memberships, limit: null }), new Set());
  });

  test('limit undefined -> hiçbiri kilitli değil', () => {
    assert.deepEqual(resolveLockedHouseholdIds({ memberships, limit: undefined }), new Set());
  });

  test('limit 2 -> en eski 2 açık (h1, h2), en yeni (h3) kilitli', () => {
    const locked = resolveLockedHouseholdIds({ memberships, limit: 2 });
    assert.deepEqual(locked, new Set(['h3']));
  });

  test('limit 0 -> hepsi kilitli', () => {
    const locked = resolveLockedHouseholdIds({ memberships, limit: 0 });
    assert.deepEqual(locked, new Set(['h1', 'h2', 'h3']));
  });

  test('limit üyelik sayısından büyük -> hiçbiri kilitli değil', () => {
    const locked = resolveLockedHouseholdIds({ memberships, limit: 10 });
    assert.deepEqual(locked, new Set());
  });

  test('sıralama joinedAt ile stabil, giriş sırasından bağımsız', () => {
    const shuffled = [...memberships].reverse();
    assert.deepEqual(
      resolveLockedHouseholdIds({ memberships: shuffled, limit: 1 }),
      resolveLockedHouseholdIds({ memberships, limit: 1 }),
    );
  });
});

describe('resolveLockedLocationIds — alan içi en eski açık kalır', () => {
  const locations = [
    { id: 'l2', createdAt: '2026-01-02T00:00:00Z' },
    { id: 'l1', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'l3', createdAt: '2026-01-03T00:00:00Z' },
  ];

  test('limit null -> sınırsız', () => {
    assert.deepEqual(resolveLockedLocationIds({ locations, limit: null }), new Set());
  });

  test('limit 1 -> sadece en eski (l1) açık', () => {
    assert.deepEqual(resolveLockedLocationIds({ locations, limit: 1 }), new Set(['l2', 'l3']));
  });
});

describe('resolveInsightsWindow — pencere kırpma', () => {
  const NOW = new Date('2026-09-15T12:00:00Z');

  test('windowDays null -> requestedFrom aynen döner, truncated false', () => {
    const result = resolveInsightsWindow({ windowDays: null, requestedFrom: '2020-01-01', now: NOW });
    assert.equal(result.from, '2020-01-01');
    assert.equal(result.truncated, false);
  });

  test('requestedFrom yok, windowDays 30 -> now-30gün, truncated false (istek yoktu, kırpma değil varsayılan)', () => {
    const result = resolveInsightsWindow({ windowDays: 30, requestedFrom: undefined, now: NOW });
    const expected = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(result.from, expected);
    assert.equal(result.truncated, false);
  });

  test('requestedFrom pencereden eski -> kırpılır, truncated true', () => {
    const result = resolveInsightsWindow({ windowDays: 30, requestedFrom: '2026-01-01T00:00:00Z', now: NOW });
    const expected = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(result.from, expected);
    assert.equal(result.truncated, true);
  });

  test('requestedFrom pencere içinde -> aynen döner, truncated false', () => {
    const requestedFrom = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const result = resolveInsightsWindow({ windowDays: 30, requestedFrom, now: NOW });
    assert.equal(result.from, requestedFrom);
    assert.equal(result.truncated, false);
  });
});
