import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeZaiAssistantChat } from '../../../src/infrastructure/assistant/zai-assistant.adapter.js';
import { AiQuotaError } from '@fridge/errors';

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

describe('makeZaiAssistantChat', () => {
  test('alan bağlamı ve sohbet geçmişini mesajlar olarak iletir ve cevabı parse eder', async () => {
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
      assert.ok(body.messages[1].content.includes('ALAN DURUMU:'));
      assert.equal(body.messages[2].role, 'assistant');

      return fakeZaiResponse({
        reply: 'Bu malzemelerle güzel bir menemen yapabilirsin!',
        suggestedShoppingItems: [
          { name: 'Ekmek', quantity: 1, unit: 'piece', reasonText: 'Menemen yanına' },
        ],
        conversationTitle: 'Menemen tarifi',
        modeMismatch: null,
        guide: null,
      });
    };

    const assistant = makeZaiAssistantChat({ apiKey: 'test-key', fetchFn });
    const result = await assistant.reply({
      area: { inventory: [{ name: 'Yumurta' }, { name: 'Domates' }] },
      history: [{ role: 'user', content: 'Ne pişirsem?' }],
      mode: 'food',
      foodEnabled: true,
    });

    assert.equal(result.reply, 'Bu malzemelerle güzel bir menemen yapabilirsin!');
    assert.equal(result.suggestedShoppingItems.length, 1);
    assert.equal(result.suggestedShoppingItems[0].name, 'Ekmek');
    assert.equal(result.conversationTitle, 'Menemen tarifi');
    assert.equal(result.modeMismatch, null);
    assert.equal(result.guide, null);
  });

  test('area:null -> sahte bağlam çifti eklenmez (mesaj sayısı system+history)', async () => {
    const fetchFn = async (url, options) => {
      const body = JSON.parse(options.body);
      // system + 1 history mesajı = 2, "ALAN DURUMU:" içeren bağlam mesajı yok
      assert.equal(body.messages.length, 2);
      assert.equal(body.messages[0].role, 'system');
      assert.equal(body.messages[1].role, 'user');
      assert.equal(body.messages[1].content, 'Merhaba');
      return fakeZaiResponse({ reply: 'Merhaba, nasıl yardımcı olabilirim?', suggestedShoppingItems: [] });
    };

    const assistant = makeZaiAssistantChat({ apiKey: 'test-key', fetchFn });
    const result = await assistant.reply({
      area: null,
      history: [{ role: 'user', content: 'Merhaba' }],
      mode: 'general',
      foodEnabled: true,
    });

    assert.equal(result.reply, 'Merhaba, nasıl yardımcı olabilirim?');
  });

  test('conversationTitle/modeMismatch/guide alanları yoksa null döner', async () => {
    const fetchFn = async () => fakeZaiResponse({ reply: 'Tamam', suggestedShoppingItems: [] });
    const assistant = makeZaiAssistantChat({ apiKey: 'test-key', fetchFn });
    const result = await assistant.reply({ area: null, history: [{ role: 'user', content: 'test' }] });

    assert.equal(result.conversationTitle, null);
    assert.equal(result.modeMismatch, null);
    assert.equal(result.guide, null);
  });

  test('context onUsage callback ile geçirilir, feature "chef" olarak KORUNUR', async () => {
    const fetchFn = async () =>
      fakeZaiResponse(
        { reply: 'Tamam', suggestedShoppingItems: [] },
        { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
      );

    const usageCalls = [];
    const assistant = makeZaiAssistantChat({
      apiKey: 'test-key',
      fetchFn,
      onUsage: (entry) => usageCalls.push(entry),
    });

    await assistant.reply({
      area: null,
      history: [{ role: 'user', content: 'Merhaba' }],
      context: { userId: 'user-123', householdId: 'house-456' },
    });

    assert.equal(usageCalls.length, 1);
    // §A5: feature anahtarı 'chef' tarihsel, ürün adı "AI Asistan" ama
    // ai_usage_log.feature/usage_counter.feature DEĞİŞMEZ.
    assert.equal(usageCalls[0].feature, 'chef');
    assert.equal(usageCalls[0].userId, 'user-123');
    assert.equal(usageCalls[0].householdId, 'house-456');
    assert.equal(usageCalls[0].ok, true);
    assert.equal(usageCalls[0].promptTokens, 50);
  });

  test('429 durumunda AiQuotaError fırlatır', async () => {
    const fetchFn = async () => fakeErrorResponse(429, 'Too Many Requests');
    const assistant = makeZaiAssistantChat({ apiKey: 'test-key', fetchFn });

    await assert.rejects(
      () => assistant.reply({ area: null, history: [] }),
      AiQuotaError,
    );
  });
});
