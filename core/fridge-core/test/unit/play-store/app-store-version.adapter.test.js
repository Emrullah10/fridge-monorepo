import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { makeAppStoreVersionAdapter } from '../../../src/infrastructure/app-store/app-store-version.adapter.js';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

describe('makeAppStoreVersionAdapter', () => {
  test('normal yanıtta version alanını döner', async () => {
    global.fetch = async (url) => {
      assert.match(url, /bundleId=com\.fridge\.fridgeMobil/);
      return {
        ok: true,
        json: async () => ({ resultCount: 1, results: [{ version: '1.0.5' }] }),
      };
    };
    const adapter = makeAppStoreVersionAdapter({ bundleId: 'com.fridge.fridgeMobil' });
    assert.equal(await adapter.fetchLatestVersion(), '1.0.5');
  });

  test('resultCount 0 ise null döner (henüz yayında değil)', async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ resultCount: 0, results: [] }),
    });
    const adapter = makeAppStoreVersionAdapter({ bundleId: 'com.fridge.fridgeMobil' });
    assert.equal(await adapter.fetchLatestVersion(), null);
  });

  test('ağ hatasında fırlatır — cachedPlayVersion yakalayıp son değeri korur', async () => {
    global.fetch = async () => {
      throw new Error('network down');
    };
    const adapter = makeAppStoreVersionAdapter({ bundleId: 'com.fridge.fridgeMobil' });
    await assert.rejects(() => adapter.fetchLatestVersion(), /network down/);
  });

  test('HTTP hata kodunda fırlatır', async () => {
    global.fetch = async () => ({ ok: false, status: 503 });
    const adapter = makeAppStoreVersionAdapter({ bundleId: 'com.fridge.fridgeMobil' });
    await assert.rejects(() => adapter.fetchLatestVersion(), /itunes_lookup_http_503/);
  });
});
