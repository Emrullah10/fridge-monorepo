import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeMemoryCache } from '../../../src/infrastructure/cache/memory-cache.adapter.js';

// Bu adaptör AYNI ZAMANDA test double'ıdır — REDIS_URL yokken container.js
// bunu kurar (bkz. plan §Redis Faz 1). Burada test edilen davranış, hem
// gerçek fallback yolunu hem de cache-port sözleşmesini doğrular.
describe('makeMemoryCache', () => {
  test('isHealthy her zaman true — asla düşmez', () => {
    const cache = makeMemoryCache();
    assert.equal(cache.isHealthy(), true);
  });

  test('set + get: yazılan değer okunur', async () => {
    const cache = makeMemoryCache();
    await cache.set('k1', { a: 1 }, { ttlSeconds: 60 });
    const val = await cache.get('k1');
    assert.deepEqual(val, { a: 1 });
  });

  test('olmayan anahtar için get null döner', async () => {
    const cache = makeMemoryCache();
    const val = await cache.get('yok');
    assert.equal(val, null);
  });

  test('TTL süresi dolunca get null döner', async () => {
    const cache = makeMemoryCache();
    await cache.set('k1', { a: 1 }, { ttlSeconds: -1 }); // hemen süresi geçmiş
    const val = await cache.get('k1');
    assert.equal(val, null);
  });

  test('del sonrası get null döner', async () => {
    const cache = makeMemoryCache();
    await cache.set('k1', { a: 1 }, { ttlSeconds: 60 });
    await cache.del('k1');
    const val = await cache.get('k1');
    assert.equal(val, null);
  });

  test('incrWithExpire: art arda çağrılar sayacı artırır', async () => {
    const cache = makeMemoryCache();
    const r1 = await cache.incrWithExpire('rl:user1', 60);
    const r2 = await cache.incrWithExpire('rl:user1', 60);
    const r3 = await cache.incrWithExpire('rl:user1', 60);
    assert.deepEqual(r1, { count: 1 });
    assert.deepEqual(r2, { count: 2 });
    assert.deepEqual(r3, { count: 3 });
  });

  test('incrWithExpire: farklı anahtarlar bağımsız sayaçlar tutar', async () => {
    const cache = makeMemoryCache();
    const a = await cache.incrWithExpire('rl:userA', 60);
    const b = await cache.incrWithExpire('rl:userB', 60);
    assert.deepEqual(a, { count: 1 });
    assert.deepEqual(b, { count: 1 });
  });

  test('incrWithExpire: TTL süresi dolunca sayaç sıfırdan başlar (sabit pencere)', async () => {
    const cache = makeMemoryCache();
    await cache.incrWithExpire('rl:user1', -1); // hemen süresi geçmiş pencere
    const r = await cache.incrWithExpire('rl:user1', 60);
    assert.deepEqual(r, { count: 1 }); // önceki pencereden devralmadı
  });

  test('close çağrısı hata fırlatmaz (no-op)', async () => {
    const cache = makeMemoryCache();
    await assert.doesNotReject(cache.close());
  });
});
