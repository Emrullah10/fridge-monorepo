import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';

import { callAiModelCached } from '../../../src/infrastructure/ai/cached-ai-call.js';
import { makeMemoryCache } from '../../../src/infrastructure/cache/memory-cache.adapter.js';

// memory-cache.adapter.js AYNI ZAMANDA test double'ıdır (bkz. plan §Test
// stratejisi) — ayrı bir fake yazmak yerine üretimdeki fallback adaptörü
// test ediyoruz, böylece hem test double hem gerçek fallback yolu aynı
// kodla doğrulanır.

const fakeZaiResponse = (content, usage = { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }], usage }),
});

const baseParams = () => ({
  baseUrl: 'https://api.z.ai/api/paas/v4/chat/completions',
  providerLabel: 'zai',
  apiKey: 'test-key',
  model: 'glm-4.6',
  feature: 'receipt',
  systemPrompt: 'sistem',
  userPrompt: 'kullanıcı',
  temperature: 0.1,
  timeoutMs: 5000,
});

describe('callAiModelCached', () => {
  test('cacheable:false ise cache hiç kullanılmaz, her çağrı fetchFn tetikler', async () => {
    const cache = makeMemoryCache();
    let callCount = 0;
    const fetchFn = mock.fn(async () => { callCount += 1; return fakeZaiResponse({ x: callCount }); });

    await callAiModelCached({ ...baseParams(), fetchFn, cache, cacheable: false, householdId: 'h1', ttlSeconds: 60 });
    await callAiModelCached({ ...baseParams(), fetchFn, cache, cacheable: false, householdId: 'h1', ttlSeconds: 60 });

    assert.equal(fetchFn.mock.callCount(), 2, 'cacheable:false iken her çağrı gerçek isteğe gitmeli');
  });

  test('cache verilmezse (undefined) cacheable:true olsa bile normal davranır, PATLAMAZ', async () => {
    const fetchFn = mock.fn(async () => fakeZaiResponse({ ok: true }));
    const result = await callAiModelCached({ ...baseParams(), fetchFn, cache: undefined, cacheable: true, householdId: 'h1', ttlSeconds: 60 });
    assert.equal(fetchFn.mock.callCount(), 1);
    assert.deepEqual(JSON.parse(result.choices[0].message.content), { ok: true });
  });

  test('aynı prompt+householdId ile ikinci çağrı fetchFn TETİKLEMEZ (cache hit)', async () => {
    const cache = makeMemoryCache();
    const fetchFn = mock.fn(async () => fakeZaiResponse({ x: 1 }));

    const r1 = await callAiModelCached({ ...baseParams(), fetchFn, cache, cacheable: true, householdId: 'h1', ttlSeconds: 60 });
    const r2 = await callAiModelCached({ ...baseParams(), fetchFn, cache, cacheable: true, householdId: 'h1', ttlSeconds: 60 });

    assert.equal(fetchFn.mock.callCount(), 1, 'ikinci çağrı cache hit olmalı, fetchFn tekrar tetiklenmemeli');
    assert.deepEqual(r1, r2);
  });

  test('farklı householdId farklı cache key üretir (izolasyon)', async () => {
    const cache = makeMemoryCache();
    let callCount = 0;
    const fetchFn = mock.fn(async () => { callCount += 1; return fakeZaiResponse({ n: callCount }); });

    const r1 = await callAiModelCached({ ...baseParams(), fetchFn, cache, cacheable: true, householdId: 'household-A', ttlSeconds: 60 });
    const r2 = await callAiModelCached({ ...baseParams(), fetchFn, cache, cacheable: true, householdId: 'household-B', ttlSeconds: 60 });

    assert.equal(fetchFn.mock.callCount(), 2, 'farklı household farklı fetchFn çağrısı üretmeli');
    assert.notDeepEqual(JSON.parse(r1.choices[0].message.content), JSON.parse(r2.choices[0].message.content));
  });

  test('farklı prompt farklı cache key üretir', async () => {
    const cache = makeMemoryCache();
    const fetchFn = mock.fn(async () => fakeZaiResponse({ ok: true }));

    await callAiModelCached({ ...baseParams(), userPrompt: 'fiş A', fetchFn, cache, cacheable: true, householdId: 'h1', ttlSeconds: 60 });
    await callAiModelCached({ ...baseParams(), userPrompt: 'fiş B', fetchFn, cache, cacheable: true, householdId: 'h1', ttlSeconds: 60 });

    assert.equal(fetchFn.mock.callCount(), 2);
  });

  test('cache hit: onUsage errorCode=CACHE_HIT + totalTokens=0 ile çağrılır (maliyet ölçümü regresyon testi)', async () => {
    const cache = makeMemoryCache();
    const fetchFn = mock.fn(async () => fakeZaiResponse({ ok: true }, { prompt_tokens: 500, completion_tokens: 200, total_tokens: 700 }));
    const onUsageCalls = [];
    const onUsage = (entry) => onUsageCalls.push(entry);

    // 1. çağrı: gerçek istek, gerçek token sayımı
    await callAiModelCached({ ...baseParams(), fetchFn, onUsage, cache, cacheable: true, householdId: 'h1', ttlSeconds: 60 });
    // 2. çağrı: cache hit
    await callAiModelCached({ ...baseParams(), fetchFn, onUsage, cache, cacheable: true, householdId: 'h1', ttlSeconds: 60 });

    assert.equal(onUsageCalls.length, 2);
    assert.equal(onUsageCalls[0].errorCode, undefined, 'ilk çağrı normal başarı, errorCode olmamalı');
    assert.equal(onUsageCalls[0].totalTokens, 700, 'ilk çağrı gerçek token sayısını taşımalı');

    assert.equal(onUsageCalls[1].errorCode, 'CACHE_HIT', 'ikinci çağrı CACHE_HIT olarak işaretlenmeli');
    assert.equal(onUsageCalls[1].ok, true);
    assert.equal(onUsageCalls[1].totalTokens, 0, 'cache hit PARA harcamadı, totalTokens=0 olmalı');
    assert.equal(onUsageCalls[1].promptTokens, 0);
    assert.equal(onUsageCalls[1].outputTokens, 0);
  });

  test('AI hata fırlatırsa cache\'e YAZILMAZ, sonraki çağrı yine fetchFn tetikler', async () => {
    const cache = makeMemoryCache();
    // 400 (retry edilmeyen kalıcı hata — ai-client.js sadece 429/500/502/503'ü
    // retry ediyor) — ilk çağrının KESİN reject olmasını garanti eder,
    // MAX_RETRIES=2 nedeniyle 500 kullanmak testi yavaşlatır/kırılganlaştırırdı.
    const failingCall = mock.fn(async () => ({
      ok: false, status: 400, statusText: 'Bad Request', json: async () => ({ error: { message: 'boom' } }),
    }));

    await assert.rejects(
      callAiModelCached({ ...baseParams(), fetchFn: failingCall, cache, cacheable: true, householdId: 'h1', ttlSeconds: 60 }),
    );
    assert.equal(failingCall.mock.callCount(), 1, '400 retry edilmemeli');

    // İkinci çağrı: cache'e hiçbir şey yazılmadığı için (hata cache'lenmedi)
    // yeni bir fetchFn'e ulaşmalı, önceki hatayı "hatırlamamalı".
    const succeedingCall = mock.fn(async () => fakeZaiResponse({ recovered: true }));
    const result = await callAiModelCached({ ...baseParams(), fetchFn: succeedingCall, cache, cacheable: true, householdId: 'h1', ttlSeconds: 60 });
    assert.equal(succeedingCall.mock.callCount(), 1, 'önceki hata cache\'lenmediği için tekrar gerçek isteğe gitmeli');
    assert.deepEqual(JSON.parse(result.choices[0].message.content), { recovered: true });
  });

  test('in-flight dedup: eşzamanlı iki çağrı fetchFn\'i BİR KEZ tetikler', async () => {
    const cache = makeMemoryCache();
    let callCount = 0;
    let resolveFetch;
    const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });
    const fetchFn = mock.fn(async () => {
      callCount += 1;
      await fetchPromise; // ilk çağrı bilerek beklemede tutulur
      return fakeZaiResponse({ shared: true });
    });

    // İkisini de SENKRON başlat (await'siz) — ikinci çağrı ilkinin
    // promise'ini in-flight Map'ten bulup paylaşmalı.
    const p1 = callAiModelCached({ ...baseParams(), fetchFn, cache, cacheable: true, householdId: 'h1', ttlSeconds: 60 });
    const p2 = callAiModelCached({ ...baseParams(), fetchFn, cache, cacheable: true, householdId: 'h1', ttlSeconds: 60 });

    resolveFetch();
    const [r1, r2] = await Promise.all([p1, p2]);

    assert.equal(callCount, 1, 'eşzamanlı aynı istek TEK fetchFn çağrısı üretmeli');
    assert.deepEqual(r1, r2);
  });
});
