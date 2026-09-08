import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeGroqRecipeGenerator } from '../../../src/infrastructure/recipe/groq-recipe.adapter.js';
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

describe('makeGroqRecipeGenerator', () => {
  test('malzemelerden tarif üretir ve doğru formatta döner', async () => {
    const fetchFn = async (url, options) => {
      assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
      const body = JSON.parse(options.body);
      assert.equal(body.response_format.type, 'json_object');
      assert.equal(body.temperature, 0.7);

      return fakeGroqResponse({
        recipes: [
          {
            title: 'Fırında Tavuk',
            description: 'Pratik ve lezzetli',
            servings: 4,
            prepMinutes: 15,
            cookMinutes: 40,
            difficulty: 'easy',
            steps: [{ order: 1, text: 'Tavukları yıkayın', minutes: 5 }],
            ingredients: ['Tavuk', 'Patates'],
            missingIngredients: ['Kekik'],
            tags: ['akşam yemeği'],
          },
        ],
      });
    };

    const generator = makeGroqRecipeGenerator({ apiKey: 'test-key', fetchFn });
    const result = await generator.generate({
      ingredients: [{ name: 'Tavuk' }, { name: 'Patates' }],
      beverages: [],
      preferences: [],
    });

    assert.equal(result.recipes.length, 1);
    assert.equal(result.recipes[0].title, 'Fırında Tavuk');
    assert.equal(result.recipes[0].steps[0].order, 1);
    assert.equal(result.recipes[0].steps[0].text, 'Tavukları yıkayın');
  });

  test('context onUsage callback ile geçirilir', async () => {
    const fetchFn = async () =>
      fakeGroqResponse(
        { recipes: [] },
        { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      );

    const usageCalls = [];
    const generator = makeGroqRecipeGenerator({
      apiKey: 'test-key',
      fetchFn,
      onUsage: (entry) => usageCalls.push(entry),
    });

    await generator.generate({
      ingredients: [],
      preferences: [],
      context: { userId: 'u-1', householdId: 'h-1' },
    });

    assert.equal(usageCalls.length, 1);
    assert.equal(usageCalls[0].feature, 'recipe');
    assert.equal(usageCalls[0].userId, 'u-1');
  });

  test('429 durumunda AiQuotaError fırlatır', async () => {
    const fetchFn = async () => fakeErrorResponse(429, 'Too Many Requests');
    const generator = makeGroqRecipeGenerator({ apiKey: 'test-key', fetchFn });

    await assert.rejects(
      () => generator.generate({ ingredients: [], preferences: [] }),
      AiQuotaError,
    );
  });
});
