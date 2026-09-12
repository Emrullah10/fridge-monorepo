import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeZaiTextParser } from '../../../src/infrastructure/parser/zai-text.adapter.js';
import { AiQuotaError, AiBusyError, AiTimeoutError } from '@fridge/errors';

const fakeZaiResponse = (parsed, usage) => ({
  ok: true,
  status: 200,
  json: async () => ({
    choices: [{ message: { content: JSON.stringify(parsed) } }],
    ...(usage ? { usage } : {}),
  }),
});

const fakeErrorResponse = (status, statusText, errorBody = null) => ({
  ok: false,
  status,
  statusText,
  json: async () => errorBody ?? { error: { message: statusText } },
});

describe('makeZaiTextParser', () => {
  test('başarılı yanıtı ayrıştırır ve finalizeItem zincirinden geçirir', async () => {
    const fetchFn = async (url, options) => {
      assert.equal(url, 'https://api.z.ai/api/paas/v4/chat/completions');
      assert.equal(options.headers.Authorization, 'Bearer test-key');
      const body = JSON.parse(options.body);
      assert.equal(body.response_format.type, 'json_object');
      assert.equal(body.temperature, 0.1);
      assert.equal(body.max_tokens, 4096);
      assert.equal(body.max_completion_tokens, undefined, 'Z.ai max_tokens bekler, max_completion_tokens DEĞİL');
      assert.equal(body.thinking.type, 'disabled');
      assert.ok(body.messages[0].content.includes('Türk market fişini'));
      assert.ok(body.messages[1].content.includes('KRUVASAN 55G7DAYS'));

      return fakeZaiResponse({
        merchantName: 'MIGROS',
        purchasedAt: null,
        totalAmount: null,
        lineItems: [
          {
            rawText: 'KRUVASAN 55G7DAYS',
            parsedName: 'Kruvasan',
            parsedCategory: 'bakery',
            parsedQuantity: 1,
            parsedUnit: 'piece',
            parsedPrice: 12.5,
          },
        ],
      });
    };

    const parser = makeZaiTextParser({ apiKey: 'test-key', model: 'glm-4.7-flash', fetchFn });
    const result = await parser.parse({ rawText: 'KRUVASAN 55G7DAYS' });

    assert.equal(result.provider, 'zai-text');
    assert.equal(result.model, 'glm-4.7-flash');
    assert.equal(result.merchantName, 'MIGROS');
    assert.equal(result.lineItems.length, 1);
    assert.equal(result.lineItems[0].parsedBrand, '7Days');
    assert.equal(result.lineItems[0].parsedName, '7Days Kruvasan');
    assert.equal(result.lineItems[0].lineNo, 1);
  });

  test('usage onUsage callback ile bildirilir', async () => {
    const fetchFn = async () =>
      fakeZaiResponse(
        { merchantName: null, purchasedAt: null, totalAmount: null, lineItems: [] },
        { prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 },
      );

    const usageCalls = [];
    const parser = makeZaiTextParser({
      apiKey: 'test-key',
      fetchFn,
      onUsage: (entry) => usageCalls.push(entry),
    });
    await parser.parse({ rawText: 'AYRAN' });

    assert.equal(usageCalls.length, 1);
    assert.equal(usageCalls[0].feature, 'receipt');
    assert.equal(usageCalls[0].ok, true);
    assert.equal(usageCalls[0].promptTokens, 120);
    assert.equal(usageCalls[0].outputTokens, 40);
  });

  test('429 retry edilmeden AiQuotaError fırlatır (gerçek kota — error.code 1305 değil)', async () => {
    let callCount = 0;
    const fetchFn = async () => {
      callCount += 1;
      return fakeErrorResponse(429, 'Too Many Requests', {
        error: { message: 'Rate limit exceeded' },
      });
    };
    const parser = makeZaiTextParser({ apiKey: 'test-key', fetchFn });

    await assert.rejects(() => parser.parse({ rawText: 'AYRAN' }), AiQuotaError);
    assert.equal(callCount, 1, '429 retry edilmemeli');
  });

  // Z.ai'de 429 + error.code "1305" gerçek kota DEĞİL, sunucu tarafı geçici
  // yoğunluk (canlı doğrulandı, bkz. docs/ZAI_MIGRATION_PLAN.md). Bunu kota
  // sanıp retry etmemek yaygın bir entegrasyon hatası — burada retry edilip
  // sonunda başarıya ulaştığı doğrulanıyor.
  test('429 + error.code 1305 (geçici aşırı yük) retry edilir ve başarıyla sonuçlanabilir', async () => {
    let callCount = 0;
    const fetchFn = async () => {
      callCount += 1;
      if (callCount < 2) {
        return fakeErrorResponse(429, 'Too Many Requests', {
          error: { code: '1305', message: 'The service may be temporarily overloaded, please try again later' },
        });
      }
      return fakeZaiResponse({ merchantName: null, purchasedAt: null, totalAmount: null, lineItems: [] });
    };
    const parser = makeZaiTextParser({ apiKey: 'test-key', fetchFn });

    const result = await parser.parse({ rawText: 'AYRAN' });

    assert.equal(callCount, 2, '1305 bir kez retry edilmeli');
    assert.equal(result.provider, 'zai-text');
  });

  test('429 + error.code 1305 retry limiti aşılırsa AiBusyError fırlatır', async () => {
    let callCount = 0;
    const fetchFn = async () => {
      callCount += 1;
      return fakeErrorResponse(429, 'Too Many Requests', {
        error: { code: '1305', message: 'The service may be temporarily overloaded, please try again later' },
      });
    };
    const parser = makeZaiTextParser({ apiKey: 'test-key', fetchFn });

    await assert.rejects(() => parser.parse({ rawText: 'AYRAN' }), AiBusyError);
    assert.equal(callCount, 3, '1 ilk deneme + 2 retry');
  });

  test('503 iki kez retry edildikten sonra hâlâ başarısızsa AiBusyError fırlatır', async () => {
    let callCount = 0;
    const fetchFn = async () => {
      callCount += 1;
      return fakeErrorResponse(503, 'Service Unavailable');
    };
    const parser = makeZaiTextParser({ apiKey: 'test-key', fetchFn });

    await assert.rejects(() => parser.parse({ rawText: 'AYRAN' }), AiBusyError);
    assert.equal(callCount, 3, '1 ilk deneme + 2 retry');
  });

  test('timeout (AbortError) AiTimeoutError fırlatır', async () => {
    const fetchFn = async () => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      throw error;
    };
    const parser = makeZaiTextParser({ apiKey: 'test-key', fetchFn });

    await assert.rejects(() => parser.parse({ rawText: 'AYRAN' }), AiTimeoutError);
  });

  test('totalAmount model boş dönerse ham metinden yedek okunur', async () => {
    const fetchFn = async () =>
      fakeZaiResponse({
        merchantName: null,
        purchasedAt: null,
        totalAmount: null,
        lineItems: [],
      });

    const parser = makeZaiTextParser({ apiKey: 'test-key', fetchFn });
    const result = await parser.parse({ rawText: 'AYRAN\nTOPLAM: 45,90' });

    assert.equal(result.totalAmount, 45.9);
  });
});
