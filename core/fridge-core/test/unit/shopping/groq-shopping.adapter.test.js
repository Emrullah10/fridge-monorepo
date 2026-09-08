import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeGroqShoppingSuggester } from '../../../src/infrastructure/shopping/groq-shopping.adapter.js';
import { AiQuotaError, AiBusyError } from '@fridge/errors';

const fakeGroqResponse = (parsed, usage) => ({
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

describe('makeGroqShoppingSuggester', () => {
  test('suggest ritim bazlı öneri üretir', async () => {
    const fetchFn = async (url, options) => {
      assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
      const body = JSON.parse(options.body);
      assert.equal(body.response_format.type, 'json_object');
      assert.equal(body.temperature, 0.3);

      return fakeGroqResponse({
        suggestions: [
          { name: 'Süt', quantity: 2, unit: 'piece', reasonText: 'Tüketim ritmine göre bitmek üzere' },
        ],
      });
    };

    const suggester = makeGroqShoppingSuggester({ apiKey: 'test-key', fetchFn });
    const result = await suggester.suggest({
      profile: [{ name: 'Süt', currentQuantity: 0, consumptionCount: 5 }],
    });

    assert.equal(result.suggestions.length, 1);
    assert.equal(result.suggestions[0].name, 'Süt');
  });

  test('fromText serbest metinden öneri üretir', async () => {
    const fetchFn = async () =>
      fakeGroqResponse({
        suggestions: [
          { name: 'Elma', quantity: 1, unit: 'kg', reasonText: 'Kullanıcı isteği' },
        ],
      });

    const suggester = makeGroqShoppingSuggester({ apiKey: 'test-key', fetchFn });
    const result = await suggester.fromText({
      text: 'Bir kilo elma al',
      inventorySummary: [{ name: 'Armut' }],
    });

    assert.equal(result.suggestions.length, 1);
    assert.equal(result.suggestions[0].name, 'Elma');
  });

  test('context onUsage callback ile geçirilir', async () => {
    const fetchFn = async () =>
      fakeGroqResponse(
        { suggestions: [] },
        { prompt_tokens: 60, completion_tokens: 30, total_tokens: 90 },
      );

    const usageCalls = [];
    const suggester = makeGroqShoppingSuggester({
      apiKey: 'test-key',
      fetchFn,
      onUsage: (entry) => usageCalls.push(entry),
    });

    await suggester.suggest({
      profile: [],
      context: { userId: 'u-shopping', householdId: 'h-shopping' },
    });

    assert.equal(usageCalls.length, 1);
    assert.equal(usageCalls[0].feature, 'shopping');
    assert.equal(usageCalls[0].userId, 'u-shopping');
  });

  test('429 durumunda AiQuotaError fırlatır', async () => {
    const fetchFn = async () => fakeErrorResponse(429, 'Too Many Requests');
    const suggester = makeGroqShoppingSuggester({ apiKey: 'test-key', fetchFn });

    await assert.rejects(() => suggester.suggest({ profile: [] }), AiQuotaError);
  });
});
