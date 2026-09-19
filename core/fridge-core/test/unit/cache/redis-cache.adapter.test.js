import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { makeRedisCache } from '../../../src/infrastructure/cache/redis-cache.adapter.js';

// ioredis'i mock'lamak yerine (gerçek client'ın iç detaylarına bağımlı
// kalırdık) constructor'ı enjekte edilebilir yaptık — fetchFn enjeksiyon
// deseniyle AYNI ilke (bkz. zai-text.adapter.test.js). Bu sahte client
// EventEmitter'dan türüyor ki adaptörün `client.on('ready'/'error'/'end')`
// aboneliği gerçek ioredis'teki gibi çalışsın.
const makeFakeRedisCtor = ({ store = new Map(), failCommands = false } = {}) => {
  class FakeRedis extends EventEmitter {
    constructor() {
      super();
      this.store = store;
      // Gerçek ioredis constructor senkron döner, 'ready' olayı ASENKRON
      // gelir (TCP handshake sonrası) — testte de bu sırayı taklit ediyoruz,
      // aksi halde adaptörün "henüz healthy değilken çağrılan komutlar"
      // dalını test edemeyiz.
      queueMicrotask(() => this.emit('ready'));
    }

    async get(key) {
      if (failCommands) throw new Error('ECONNREFUSED');
      return this.store.has(key) ? this.store.get(key) : null;
    }

    async set(key, value) {
      if (failCommands) throw new Error('ECONNREFUSED');
      this.store.set(key, value);
      return 'OK';
    }

    async del(key) {
      if (failCommands) throw new Error('ECONNREFUSED');
      this.store.delete(key);
      return 1;
    }

    multi() {
      const ops = [];
      const chain = {
        incr: (key) => { ops.push(['incr', key]); return chain; },
        expire: (key) => { ops.push(['expire', key]); return chain; },
        exec: async () => {
          if (failCommands) throw new Error('ECONNREFUSED');
          const [, incrKey] = ops[0];
          const current = Number(this.store.get(incrKey) ?? 0) + 1;
          this.store.set(incrKey, String(current));
          // ioredis MULTI sonucu: [[err, result], [err, result], ...]
          return [[null, current], [null, 1]];
        },
      };
      return chain;
    }

    async quit() {
      this.emit('end');
      return 'OK';
    }

    disconnect() {
      this.emit('end');
    }
  }
  return FakeRedis;
};

const waitTick = () => new Promise((resolve) => queueMicrotask(resolve));

describe('makeRedisCache', () => {
  test('ready olayından SONRA isHealthy true olur', async () => {
    const cache = makeRedisCache({ url: 'redis://fake', RedisCtor: makeFakeRedisCtor() });
    await waitTick();
    assert.equal(cache.isHealthy(), true);
  });

  test('set + get: JSON serialize/deserialize doğru çalışır', async () => {
    const cache = makeRedisCache({ url: 'redis://fake', RedisCtor: makeFakeRedisCtor() });
    await waitTick();
    await cache.set('k1', { a: 1, b: [1, 2, 3] }, { ttlSeconds: 60 });
    const val = await cache.get('k1');
    assert.deepEqual(val, { a: 1, b: [1, 2, 3] });
  });

  test('olmayan anahtar için get null döner', async () => {
    const cache = makeRedisCache({ url: 'redis://fake', RedisCtor: makeFakeRedisCtor() });
    await waitTick();
    const val = await cache.get('yok');
    assert.equal(val, null);
  });

  test('incrWithExpire: art arda çağrılar sayacı artırır', async () => {
    const cache = makeRedisCache({ url: 'redis://fake', RedisCtor: makeFakeRedisCtor() });
    await waitTick();
    const r1 = await cache.incrWithExpire('rl:user1', 60);
    const r2 = await cache.incrWithExpire('rl:user1', 60);
    assert.deepEqual(r1, { count: 1 });
    assert.deepEqual(r2, { count: 2 });
  });

  // --- FAIL-SOFT: en kritik test grubu ---

  test('henüz ready gelmeden (healthy=false) get null döner, PATLAMAZ', async () => {
    const cache = makeRedisCache({ url: 'redis://fake', RedisCtor: makeFakeRedisCtor() });
    // waitTick YOK — 'ready' olayı henüz gelmedi
    const val = await cache.get('herhangi-bir-key');
    assert.equal(val, null);
  });

  test('henüz ready gelmeden set/incrWithExpire PATLAMAZ', async () => {
    const cache = makeRedisCache({ url: 'redis://fake', RedisCtor: makeFakeRedisCtor() });
    // İkisini de 'ready' olayı gelmeden (ilk `await`'ten ÖNCE, senkron)
    // başlatıyoruz — tek bir `await` bile microtask kuyruğunu bir tur
    // döndürüp queueMicrotask'taki 'ready' emit'ini tetikler, healthy=true
    // olur ve test artık "henüz ready gelmeden" senaryosunu ölçmez olur.
    const setPromise = cache.set('k', 'v', { ttlSeconds: 10 });
    const incrPromise = cache.incrWithExpire('rl:k', 10);

    await assert.doesNotReject(setPromise);
    const incrResult = await incrPromise;
    assert.equal(incrResult, null);
  });

  test('komutlar hata fırlatırsa get null döner, PATLAMAZ', async () => {
    const cache = makeRedisCache({ url: 'redis://fake', RedisCtor: makeFakeRedisCtor({ failCommands: true }) });
    await waitTick();
    const val = await cache.get('k1');
    assert.equal(val, null);
  });

  test('komutlar hata fırlatırsa set/del PATLAMAZ (sessizce yutar)', async () => {
    const cache = makeRedisCache({ url: 'redis://fake', RedisCtor: makeFakeRedisCtor({ failCommands: true }) });
    await waitTick();
    await assert.doesNotReject(cache.set('k', 'v', { ttlSeconds: 10 }));
    await assert.doesNotReject(cache.del('k'));
  });

  test('komutlar hata fırlatırsa incrWithExpire null döner, PATLAMAZ', async () => {
    const cache = makeRedisCache({ url: 'redis://fake', RedisCtor: makeFakeRedisCtor({ failCommands: true }) });
    await waitTick();
    const result = await cache.incrWithExpire('rl:k', 10);
    assert.equal(result, null);
  });

  test('error olayı sonrası isHealthy false olur (devre kesici tetiklenir)', async () => {
    // Oluşturulan instance'a dışarıdan erişmek için ctor'un kendisine bir
    // referans yazıyoruz — adaptör `new RedisCtor(...)` çağırdığında bu
    // instance'ı yakalayıp testte 'error' olayını elle tetikleyebiliyoruz.
    let capturedInstance;
    class CapturingRedis extends (makeFakeRedisCtor()) {
      constructor(...args) {
        super(...args);
        capturedInstance = this;
      }
    }
    const cache = makeRedisCache({ url: 'redis://fake', RedisCtor: CapturingRedis });
    await waitTick();
    assert.equal(cache.isHealthy(), true);

    capturedInstance.emit('error', new Error('ECONNRESET'));
    assert.equal(cache.isHealthy(), false);

    // Devre kesici gerçekten devrede mi: healthy=false iken get PATLAMAMALI.
    const val = await cache.get('herhangi');
    assert.equal(val, null);
  });

  test('close() bağlantı sağlıklıyken quit() çağırır, PATLAMAZ', async () => {
    const cache = makeRedisCache({ url: 'redis://fake', RedisCtor: makeFakeRedisCtor() });
    await waitTick();
    await assert.doesNotReject(cache.close());
  });

  test('close() quit() hata fırlatırsa disconnect()a düşer, PATLAMAZ', async () => {
    class ThrowingQuitRedis extends EventEmitter {
      constructor() {
        super();
        queueMicrotask(() => this.emit('ready'));
      }
      async quit() { throw new Error('Stream isn\'t writeable'); }
      disconnect() { this.emit('end'); }
    }
    const cache = makeRedisCache({ url: 'redis://fake', RedisCtor: ThrowingQuitRedis });
    await waitTick();
    await assert.doesNotReject(cache.close());
  });
});
