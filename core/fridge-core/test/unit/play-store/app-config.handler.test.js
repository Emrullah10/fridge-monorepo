import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';

import { buildAppConfigHandler } from '../../../../../services/fridge-api/src/app-config.handler.js';

const makeFakeRes = () => {
  const res = { body: null };
  res.json = mock.fn((payload) => {
    res.body = payload;
    return res;
  });
  return res;
};

const makeFakeContainer = () => ({
  cachedPlayVersion: { getLatestVersion: mock.fn(async () => '1.0.5') },
  cachedAppStoreVersion: { getLatestVersion: mock.fn(async () => '1.0.6') },
  config: {
    appMinSupportedVersion: '1.0.0',
    appStoreUrl: 'https://play.google.com/store/apps/details?id=com.fridge.fridge_mobil',
    appMinSupportedVersionIos: '1.0.1',
    appStoreUrlIos: 'https://apps.apple.com/app/id123',
  },
});

describe('buildAppConfigHandler', () => {
  test('platform param yokken Android/Play kaynağını kullanır', async () => {
    const container = makeFakeContainer();
    const handler = buildAppConfigHandler(container);
    const res = makeFakeRes();

    await handler({ query: {} }, res);

    assert.equal(container.cachedPlayVersion.getLatestVersion.mock.callCount(), 1);
    assert.equal(container.cachedAppStoreVersion.getLatestVersion.mock.callCount(), 0);
    assert.deepEqual(res.body, {
      latestVersion: '1.0.5',
      minSupportedVersion: '1.0.0',
      storeUrl: 'https://play.google.com/store/apps/details?id=com.fridge.fridge_mobil',
    });
  });

  test('platform=ios iken App Store/iTunes kaynağını kullanır', async () => {
    const container = makeFakeContainer();
    const handler = buildAppConfigHandler(container);
    const res = makeFakeRes();

    await handler({ query: { platform: 'ios' } }, res);

    assert.equal(container.cachedAppStoreVersion.getLatestVersion.mock.callCount(), 1);
    assert.equal(container.cachedPlayVersion.getLatestVersion.mock.callCount(), 0);
    assert.deepEqual(res.body, {
      latestVersion: '1.0.6',
      minSupportedVersion: '1.0.1',
      storeUrl: 'https://apps.apple.com/app/id123',
    });
  });

  test('yanıt şeması platform ne olursa olsun aynı 3 alan', async () => {
    const container = makeFakeContainer();
    const handler = buildAppConfigHandler(container);
    const resAndroid = makeFakeRes();
    const resIos = makeFakeRes();

    await handler({ query: {} }, resAndroid);
    await handler({ query: { platform: 'ios' } }, resIos);

    assert.deepEqual(Object.keys(resAndroid.body).sort(), Object.keys(resIos.body).sort());
  });
});
