import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeAddShoppingItemsFromText } from '../../../src/application/use-cases/shopping/add-shopping-items-from-text.use-case.js';

describe('makeAddShoppingItemsFromText', () => {
  test('boş metin ValidationError fırlatır', async () => {
    const useCase = makeAddShoppingItemsFromText({
      inventoryItemRepo: { listByHousehold: async () => [] },
      shoppingSuggesterPort: { fromText: async () => ({ suggestions: [] }) },
    });
    await assert.rejects(useCase({ householdId: 'h1', text: '   ' }), /boş olamaz/);
  });

  test('householdId hem context içinde hem AYRI alan olarak shoppingSuggesterPort.fromText\'e geçer — Faz 2 AI cache regresyon testi', async () => {
    // householdId, cached-ai-call.js'in cache key'ine giriyor (bkz.
    // zai-shopping.adapter.js fromText). context.householdId'ye GÜVENMEK
    // yetmez — cache anahtarı AYRI bir üst-seviye householdId parametresi
    // bekliyor, bu yüzden ikisi de ayrı ayrı doğrulanıyor.
    let capturedArgs;
    const inventoryItemRepo = { listByHousehold: async () => [{ productName: 'Süt' }] };
    const shoppingSuggesterPort = {
      fromText: async (args) => {
        capturedArgs = args;
        return { suggestions: [{ name: 'Ekmek', quantity: 1, unit: 'piece', reason: 'user_request' }] };
      },
    };

    const useCase = makeAddShoppingItemsFromText({ inventoryItemRepo, shoppingSuggesterPort });
    await useCase({ householdId: 'household-42', text: 'ekmek lazım', userId: 'u1', isGuest: false });

    assert.equal(capturedArgs.householdId, 'household-42');
    assert.equal(capturedArgs.context.householdId, 'household-42');
    assert.equal(capturedArgs.text, 'ekmek lazım');
    assert.deepEqual(capturedArgs.inventorySummary, [{ name: 'Süt' }]);
  });

  test('adı boş öneriler filtrelenir, productId her zaman null', async () => {
    const useCase = makeAddShoppingItemsFromText({
      inventoryItemRepo: { listByHousehold: async () => [] },
      shoppingSuggesterPort: {
        fromText: async () => ({
          suggestions: [
            { name: 'Ekmek', quantity: 1, unit: 'piece', reason: 'user_request' },
            { name: '  ', quantity: 1, unit: 'piece', reason: 'user_request' },
          ],
        }),
      },
    });
    const result = await useCase({ householdId: 'h1', text: 'ekmek' });
    assert.equal(result.suggestions.length, 1);
    assert.equal(result.suggestions[0].productId, null);
  });

  test('en fazla 10 öneri döner', async () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ name: `Ürün ${i}`, quantity: 1, unit: 'piece', reason: 'user_request' }));
    const useCase = makeAddShoppingItemsFromText({
      inventoryItemRepo: { listByHousehold: async () => [] },
      shoppingSuggesterPort: { fromText: async () => ({ suggestions: many }) },
    });
    const result = await useCase({ householdId: 'h1', text: 'liste' });
    assert.equal(result.suggestions.length, 10);
  });
});
