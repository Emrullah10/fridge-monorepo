import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeSuggestAiShoppingItems } from '../../../src/application/use-cases/shopping/suggest-ai-shopping-items.use-case.js';

const LIST = { id: 'list-1' };

describe('makeSuggestAiShoppingItems', () => {
  test('tüketim profili boşsa AI hiç çağrılmaz, low_stock önerisine düşer', async () => {
    let suggestCalled = false;
    const shoppingListRepo = {
      getOrCreateActiveList: async () => LIST,
      consumptionProfile: async () => [],
      suggestLowStock: async () => [{ productId: 'p1', name: 'Ekmek', unit: 'piece', reason: 'low_stock' }],
    };
    const shoppingSuggesterPort = { suggest: async () => { suggestCalled = true; return { suggestions: [] }; } };

    const useCase = makeSuggestAiShoppingItems({ shoppingListRepo, shoppingSuggesterPort });
    const result = await useCase({ householdId: 'h1', userId: 'u1' });

    assert.equal(suggestCalled, false);
    assert.deepEqual(result.suggestions, [{ productId: 'p1', name: 'Ekmek', unit: 'piece', reason: 'low_stock' }]);
  });

  test('modelin verilmeyen bir productId uydurması null\'a çevrilir — halüsinasyon savunması', async () => {
    const shoppingListRepo = {
      getOrCreateActiveList: async () => LIST,
      consumptionProfile: async () => [{ productId: 'p1', name: 'Süt' }],
    };
    const shoppingSuggesterPort = {
      suggest: async () => ({
        suggestions: [
          { productId: 'p1', name: 'Süt', quantity: 1, unit: 'liter', reason: 'due_soon', reasonText: 'x' },
          { productId: 'uydurma-id', name: 'Peynir', quantity: 1, unit: 'gram', reason: 'complementary', reasonText: 'y' },
        ],
      }),
    };

    const useCase = makeSuggestAiShoppingItems({ shoppingListRepo, shoppingSuggesterPort });
    const result = await useCase({ householdId: 'h1', userId: 'u1' });

    assert.equal(result.suggestions[0].productId, 'p1');
    assert.equal(result.suggestions[1].productId, null);
  });

  test('8 üstü öneri kesilir', async () => {
    const shoppingListRepo = {
      getOrCreateActiveList: async () => LIST,
      consumptionProfile: async () => [{ productId: 'p1', name: 'Süt' }],
    };
    const many = Array.from({ length: 12 }, (_, i) => ({
      productId: null, name: `Ürün ${i}`, quantity: 1, unit: 'piece', reason: 'complementary', reasonText: 'x',
    }));
    const shoppingSuggesterPort = { suggest: async () => ({ suggestions: many }) };

    const useCase = makeSuggestAiShoppingItems({ shoppingListRepo, shoppingSuggesterPort });
    const result = await useCase({ householdId: 'h1', userId: 'u1' });

    assert.equal(result.suggestions.length, 8);
  });

  test('adı boş öneriler atılır', async () => {
    const shoppingListRepo = {
      getOrCreateActiveList: async () => LIST,
      consumptionProfile: async () => [{ productId: 'p1', name: 'Süt' }],
    };
    const shoppingSuggesterPort = {
      suggest: async () => ({
        suggestions: [
          { productId: null, name: '', quantity: 1, unit: 'piece', reason: 'complementary', reasonText: 'x' },
          { productId: null, name: 'Yumurta', quantity: 1, unit: 'piece', reason: 'complementary', reasonText: 'x' },
        ],
      }),
    };

    const useCase = makeSuggestAiShoppingItems({ shoppingListRepo, shoppingSuggesterPort });
    const result = await useCase({ householdId: 'h1', userId: 'u1' });

    assert.equal(result.suggestions.length, 1);
    assert.equal(result.suggestions[0].name, 'Yumurta');
  });
});
