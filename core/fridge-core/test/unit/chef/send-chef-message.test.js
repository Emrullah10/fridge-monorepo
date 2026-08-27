import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeSendChefMessage } from '../../../src/application/use-cases/chef/send-chef-message.use-case.js';

const clock = { now: () => new Date('2026-08-27T12:00:00Z') };

const baseDeps = () => {
  const appended = [];
  return {
    appended,
    deps: {
      clock,
      chefChatRepo: {
        append: async (m) => {
          appended.push(m);
          return { id: `msg-${appended.length}`, ...m, createdAt: clock.now() };
        },
        listRecent: async () => appended.filter((m) => m.role).map((m) => ({ role: m.role, content: m.content })),
      },
      inventoryItemRepo: {
        listByHousehold: async () => [
          { productName: 'Süt', productBrand: 'Sütaş', quantity: 2, unit: 'liter', categoryId: 'dairy', expiresAt: '2026-08-29' },
          { productName: 'Biten Ürün', productBrand: null, quantity: 0, unit: 'piece', categoryId: null, expiresAt: null },
        ],
        listExpiringBefore: async () => [
          { productName: 'Süt', expiresAt: '2026-08-29' },
        ],
      },
      shoppingListRepo: {
        getOrCreateActiveList: async () => ({ id: 'list-1' }),
        listItems: async () => [{ name: 'Ekmek' }],
      },
      recipeCookLogRepo: {
        listByHousehold: async () => [{ recipeTitle: 'Menemen', cookedAt: '2026-08-25' }],
      },
      chefChatPort: {
        reply: async ({ history, kitchen }) => {
          baseDeps._lastCall = { history, kitchen };
          return { reply: 'Sütü değerlendirmek için sütlaç yapabilirsin.', suggestedShoppingItems: [] };
        },
      },
    },
  };
};

describe('makeSendChefMessage', () => {
  test('boş mesaj reddedilir', async () => {
    const { deps } = baseDeps();
    const useCase = makeSendChefMessage(deps);
    await assert.rejects(() => useCase({ householdId: 'h1', userId: 'u1', message: '   ' }));
  });

  test('kullanıcı mesajı ve asistan cevabı sırayla kaydedilir', async () => {
    const { appended, deps } = baseDeps();
    const useCase = makeSendChefMessage(deps);
    const result = await useCase({ householdId: 'h1', userId: 'u1', message: 'Ne pişirebilirim?' });

    assert.equal(appended[0].role, 'user');
    assert.equal(appended[0].content, 'Ne pişirebilirim?');
    assert.equal(appended[1].role, 'assistant');
    assert.equal(appended[1].userId, null);
    assert.equal(result.message.role, 'assistant');
  });

  test('mutfak bağlamı miktarı 0 olan ürünü hariç tutar, SKT yaklaşanı taşır', async () => {
    const { deps } = baseDeps();
    let captured;
    deps.chefChatPort.reply = async ({ kitchen }) => {
      captured = kitchen;
      return { reply: 'ok', suggestedShoppingItems: [] };
    };
    const useCase = makeSendChefMessage(deps);
    await useCase({ householdId: 'h1', userId: 'u1', message: 'test' });

    assert.equal(captured.inventory.length, 1, 'miktarı 0 olan ürün bağlama girmemeli');
    assert.equal(captured.inventory[0].name, 'Süt');
    assert.equal(captured.expiringSoon.length, 1);
    assert.equal(captured.expiringSoon[0].daysLeft, 2);
    assert.deepEqual(captured.shoppingList, [{ name: 'Ekmek' }]);
    assert.equal(captured.recentlyCooked[0].title, 'Menemen');
  });

  test('suggestedShoppingItems döndürülür ama listeye YAZILMAZ', async () => {
    const { appended, deps } = baseDeps();
    deps.chefChatPort.reply = async () => ({
      reply: 'Sütlaç için pirinç lazım.',
      suggestedShoppingItems: [{ name: 'Pirinç', quantity: 500, unit: 'gram', reasonText: 'sütlaç için' }],
    });
    // shoppingListRepo'da addItem YOK — çağrılırsa test patlar.
    const useCase = makeSendChefMessage(deps);
    const result = await useCase({ householdId: 'h1', userId: 'u1', message: 'sütlaç' });

    assert.equal(result.suggestedShoppingItems.length, 1);
    assert.equal(result.suggestedShoppingItems[0].name, 'Pirinç');
    // sadece 2 mesaj kaydedildi (user + assistant), liste dokunulmadı
    assert.equal(appended.length, 2);
  });
});
