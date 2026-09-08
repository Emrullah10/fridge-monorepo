import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';

import { makeCachedPlayVersion } from '../../../src/infrastructure/play-store/cached-play-version.js';

describe('makeCachedPlayVersion', () => {
  test('TTL içinde adaptörü tekrar çağırmaz, cache döner', async () => {
    const fetchLatestVersion = mock.fn(async () => '1.0.5');
    const cached = makeCachedPlayVersion({ adapter: { fetchLatestVersion }, fallbackVersion: '1.0.0', ttlMs: 1000 });

    assert.equal(await cached.getLatestVersion(), '1.0.5');
    assert.equal(await cached.getLatestVersion(), '1.0.5');
    assert.equal(fetchLatestVersion.mock.callCount(), 1);
  });

  test('TTL doldu, yeni değer varsa günceller', async () => {
    const fetchLatestVersion = mock.fn(async () => '1.0.6');
    const cached = makeCachedPlayVersion({ adapter: { fetchLatestVersion }, fallbackVersion: '1.0.0', ttlMs: -1 });

    assert.equal(await cached.getLatestVersion(), '1.0.6');
    assert.equal(await cached.getLatestVersion(), '1.0.6');
    assert.equal(fetchLatestVersion.mock.callCount(), 2);
  });

  test('adaptör hata fırlatırsa son bilinen değeri korur, fetchedAt ilerlemez', async () => {
    let shouldFail = false;
    const fetchLatestVersion = mock.fn(async () => {
      if (shouldFail) throw new Error('play down');
      return '1.0.6';
    });
    const cached = makeCachedPlayVersion({ adapter: { fetchLatestVersion }, fallbackVersion: '1.0.0', ttlMs: -1 });

    assert.equal(await cached.getLatestVersion(), '1.0.6');
    shouldFail = true;
    // hata olsa da son bilinen değer (1.0.6) dönmeye devam eder
    assert.equal(await cached.getLatestVersion(), '1.0.6');
    assert.equal(fetchLatestVersion.mock.callCount(), 2);
  });

  test('adaptör null dönerse fallback/son değer korunur', async () => {
    const fetchLatestVersion = mock.fn(async () => null);
    const cached = makeCachedPlayVersion({ adapter: { fetchLatestVersion }, fallbackVersion: '1.0.0', ttlMs: -1 });
    assert.equal(await cached.getLatestVersion(), '1.0.0');
  });

  test('varsayılan TTL 6 saat', async () => {
    const fetchLatestVersion = mock.fn(async () => '1.0.5');
    const cached = makeCachedPlayVersion({ adapter: { fetchLatestVersion }, fallbackVersion: '1.0.0' });
    await cached.getLatestVersion();
    await cached.getLatestVersion();
    assert.equal(fetchLatestVersion.mock.callCount(), 1);
  });
});
