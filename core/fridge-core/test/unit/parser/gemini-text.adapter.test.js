import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeGeminiTextParser, toGeminiSchema } from '../../../src/infrastructure/parser/gemini-text.adapter.js';
import { RESPONSE_SCHEMA } from '../../../src/infrastructure/parser/line-item-finalizer.js';
import { AiQuotaError, AiBusyError, AiTimeoutError } from '@fridge/errors';

const fakeGeminiResponse = (parsed, usageMetadata) => ({
  ok: true,
  json: async () => ({
    candidates: [{ content: { parts: [{ text: JSON.stringify(parsed) }] } }],
    ...(usageMetadata ? { usageMetadata } : {}),
  }),
});

const fakeErrorResponse = (status, statusText, errorBody = null) => ({
  ok: false,
  status,
  statusText,
  json: async () => errorBody ?? { error: { message: statusText } },
});

describe('makeGeminiTextParser', () => {
  test('başarılı yanıtı ayrıştırır ve finalizeItem zincirinden geçirir', async () => {
    const fetchFn = async (url, options) => {
      assert.match(url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:generateContent\?key=test-key$/);
      const body = JSON.parse(options.body);
      assert.equal(body.generationConfig.responseMimeType, 'application/json');
      assert.equal(body.generationConfig.temperature, 0.1);
      assert.ok(body.systemInstruction.parts[0].text.includes('Türk market fişini'));
      assert.equal(body.contents[0].parts[0].text, 'KRUVASAN 55G7DAYS');

      return fakeGeminiResponse({
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

    const parser = makeGeminiTextParser({ apiKey: 'test-key', model: 'gemini-2.5-flash', fetchFn });
    const result = await parser.parse({ rawText: 'KRUVASAN 55G7DAYS' });

    assert.equal(result.provider, 'gemini-text');
    assert.equal(result.model, 'gemini-2.5-flash');
    assert.equal(result.merchantName, 'MIGROS');
    assert.equal(result.lineItems.length, 1);
    // Marka çözümü sözlükten geliyor (finalizeItem), Gemini'nin şemasında
    // parsedBrand hiç yok — ollama adaptöründeki davranışla aynı.
    assert.equal(result.lineItems[0].parsedBrand, '7Days');
    assert.equal(result.lineItems[0].parsedName, '7Days Kruvasan');
    assert.equal(result.lineItems[0].lineNo, 1);
  });

  test('usageMetadata onUsage callback ile bildirilir', async () => {
    const fetchFn = async () =>
      fakeGeminiResponse(
        { merchantName: null, purchasedAt: null, totalAmount: null, lineItems: [] },
        { promptTokenCount: 120, candidatesTokenCount: 40, totalTokenCount: 160 },
      );

    const usageCalls = [];
    const parser = makeGeminiTextParser({
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
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

  test('429 (RESOURCE_EXHAUSTED) retry edilmeden AiQuotaError fırlatır', async () => {
    let callCount = 0;
    const fetchFn = async () => {
      callCount += 1;
      return fakeErrorResponse(429, 'Too Many Requests', {
        error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' },
      });
    };
    const parser = makeGeminiTextParser({ apiKey: 'test-key', model: 'gemini-2.5-flash', fetchFn });

    await assert.rejects(() => parser.parse({ rawText: 'AYRAN' }), AiQuotaError);
    assert.equal(callCount, 1, '429 retry edilmemeli');
  });

  test('503 iki kez retry edildikten sonra hâlâ başarısızsa AiBusyError fırlatır', async () => {
    let callCount = 0;
    const fetchFn = async () => {
      callCount += 1;
      return fakeErrorResponse(503, 'Service Unavailable');
    };
    const parser = makeGeminiTextParser({ apiKey: 'test-key', model: 'gemini-2.5-flash', fetchFn });

    await assert.rejects(() => parser.parse({ rawText: 'AYRAN' }), AiBusyError);
    assert.equal(callCount, 3, '1 ilk deneme + 2 retry');
  });

  test('503 ilk denemede geçici, ikinci denemede başarılı olursa sonucu döner', async () => {
    let callCount = 0;
    const fetchFn = async () => {
      callCount += 1;
      if (callCount === 1) return fakeErrorResponse(503, 'Service Unavailable');
      return fakeGeminiResponse({ merchantName: null, purchasedAt: null, totalAmount: null, lineItems: [] });
    };
    const parser = makeGeminiTextParser({ apiKey: 'test-key', model: 'gemini-2.5-flash', fetchFn });

    const result = await parser.parse({ rawText: 'AYRAN' });
    assert.equal(result.provider, 'gemini-text');
    assert.equal(callCount, 2);
  });

  test('timeout (AbortError) AiTimeoutError fırlatır', async () => {
    // gemini-client.js'in gerçek 30sn'lik AbortController süresini burada
    // beklemek istemediğimiz için fetchFn doğrudan AbortError fırlatıyor —
    // gerçek fetch'in signal abort edildiğinde davrandığı gibi.
    const fetchFn = async () => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      throw error;
    };
    const parser = makeGeminiTextParser({ apiKey: 'test-key', model: 'gemini-2.5-flash', fetchFn });

    await assert.rejects(() => parser.parse({ rawText: 'AYRAN' }), AiTimeoutError);
  });

  test('totalAmount model boş dönerse ham metinden yedek okunur', async () => {
    const fetchFn = async () =>
      fakeGeminiResponse({
        merchantName: null,
        purchasedAt: null,
        totalAmount: null,
        lineItems: [],
      });

    const parser = makeGeminiTextParser({ apiKey: 'test-key', model: 'gemini-2.5-flash', fetchFn });
    const result = await parser.parse({ rawText: 'AYRAN\nTOPLAM: 45,90' });

    assert.equal(result.totalAmount, 45.9);
  });
});

describe('toGeminiSchema', () => {
  test('nullable union tipleri Gemini formatına çevirir', () => {
    const schema = toGeminiSchema(RESPONSE_SCHEMA);
    assert.equal(schema.type, 'OBJECT');
    assert.equal(schema.properties.merchantName.type, 'STRING');
    assert.equal(schema.properties.merchantName.nullable, true);
    assert.equal(schema.properties.lineItems.type, 'ARRAY');
    assert.equal(schema.properties.lineItems.items.type, 'OBJECT');
  });

  test('enum içindeki null değeri filtreler (Gemini enum null kabul etmiyor)', () => {
    const schema = toGeminiSchema(RESPONSE_SCHEMA);
    const categoryEnum = schema.properties.lineItems.items.properties.parsedCategory.enum;
    assert.ok(!categoryEnum.includes(null));
    assert.equal(schema.properties.lineItems.items.properties.parsedCategory.nullable, true);
  });
});
