import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeZaiChefChat } from '../../../src/infrastructure/chef/zai-chef.adapter.js';
import { AiQuotaError, AiBusyError } from '@fridge/errors';

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

describe('makeZaiChefChat', () => {
  test('mutfak bağlamı ve sohbet geçmişini mesajlar olarak iletir ve cevabı parse eder', async () => {
    const fetchFn = async (url, options) => {
      assert.equal(url, 'https://api.z.ai/api/paas/v4/chat/completions');
      const body = JSON.parse(options.body);
      assert.equal(body.response_format.type, 'json_object');
      assert.equal(body.temperature, 0.6);
      assert.equal(body.max_tokens, 4096);
      assert.equal(body.thinking.type, 'disabled');
      assert.ok(body.messages.length >= 3);
      assert.equal(body.messages[0].role, 'system');
      assert.equal(body.messages[1].role, 'user');
      assert.ok(body.messages[1].content.includes('MUTFAK DURUMU:'));
      assert.equal(body.messages[2].role, 'assistant');

      return fakeZaiResponse({
        reply: 'Bu malzemelerle güzel bir menemen yapabilirsin!',
        suggestedShoppingItems: [
          { name: 'Ekmek', quantity: 1, unit: 'piece', reasonText: 'Menemen yanına' },
        ],
      });
    };

    const chef = makeZaiChefChat({ apiKey: 'test-key', fetchFn });
    const result = await chef.reply({
      kitchen: { ingredients: [{ name: 'Yumurta' }, { name: 'Domates' }], preferences: [] },
      history: [{ role: 'user', content: 'Ne pişirsem?' }],
    });

    assert.equal(result.reply, 'Bu malzemelerle güzel bir menemen yapabilirsin!');
    assert.equal(result.suggestedShoppingItems.length, 1);
    assert.equal(result.suggestedShoppingItems[0].name, 'Ekmek');
    assert.equal(result.suggestedShoppingItems[0].quantity, 1);
  });

  test('context onUsage callback ile geçirilir', async () => {
    const fetchFn = async () =>
      fakeZaiResponse(
        { reply: 'Tamam', suggestedShoppingItems: [] },
        { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
      );

    const usageCalls = [];
    const chef = makeZaiChefChat({
      apiKey: 'test-key',
      fetchFn,
      onUsage: (entry) => usageCalls.push(entry),
    });

    await chef.reply({
      kitchen: { ingredients: [] },
      history: [{ role: 'user', content: 'Merhaba' }],
      context: { userId: 'user-123', householdId: 'house-456' },
    });

    assert.equal(usageCalls.length, 1);
    assert.equal(usageCalls[0].feature, 'chef');
    assert.equal(usageCalls[0].userId, 'user-123');
    assert.equal(usageCalls[0].householdId, 'house-456');
    assert.equal(usageCalls[0].ok, true);
    assert.equal(usageCalls[0].promptTokens, 50);
  });

  test('429 durumunda AiQuotaError fırlatır', async () => {
    const fetchFn = async () => fakeErrorResponse(429, 'Too Many Requests');
    const chef = makeZaiChefChat({ apiKey: 'test-key', fetchFn });

    await assert.rejects(
      () => chef.reply({ kitchen: { ingredients: [] }, history: [] }),
      AiQuotaError,
    );
  });
});
