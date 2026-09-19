import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeSendAssistantMessage } from '../../../src/application/use-cases/assistant/send-assistant-message.js';
import { makeBuildAreaContext } from '../../../src/application/use-cases/assistant/build-area-context.js';

const clock = { now: () => new Date('2026-08-27T12:00:00Z') };

const baseHousehold = { id: 'h1', name: 'Ev', kind: 'home', features: { food: true } };

const baseDeps = ({ household = baseHousehold } = {}) => {
  const appended = [];
  const conversationRepo = {
    appendMessage: async (m) => {
      appended.push(m);
      return { id: `msg-${appended.length}`, ...m, createdAt: clock.now() };
    },
    listRecentMessages: async () => appended.filter((m) => m.role).map((m) => ({ role: m.role, content: m.content })),
    setTitleIfMissing: async (id, title) => ({ id, title, updatedAt: clock.now() }),
    touch: async () => {},
  };

  const inventoryItemRepo = {
    listByHousehold: async () => [
      { productName: 'Süt', productBrand: 'Sütaş', quantity: 2, unit: 'liter', categoryId: 'dairy', expiresAt: '2026-08-29' },
      { productName: 'Biten Ürün', productBrand: null, quantity: 0, unit: 'piece', categoryId: null, expiresAt: null },
    ],
    listExpiringBefore: async () => [
      { productName: 'Süt', expiresAt: '2026-08-29' },
    ],
  };
  const shoppingListRepo = {
    getOrCreateActiveList: async () => ({ id: 'list-1' }),
    listItems: async () => [{ name: 'Ekmek' }],
  };
  const recipeCookLogRepo = {
    listByHousehold: async () => [{ recipeTitle: 'Menemen', cookedAt: '2026-08-25' }],
  };
  const householdMemberRepo = {
    listDietProfiles: async () => [],
  };
  const householdRepo = {
    findById: async () => household,
  };

  const buildAreaContext = makeBuildAreaContext({
    householdRepo,
    inventoryItemRepo,
    shoppingListRepo,
    recipeCookLogRepo,
    householdMemberRepo,
    clock,
  });

  const assistantChatPort = {
    reply: async ({ history, area }) => {
      baseDeps._lastCall = { history, area };
      return { reply: 'Sütü değerlendirmek için sütlaç yapabilirsin.', suggestedShoppingItems: [], conversationTitle: null, modeMismatch: null, guide: null };
    },
  };

  return {
    appended,
    inventoryItemRepo,
    recipeCookLogRepo,
    householdMemberRepo,
    deps: { clock, conversationRepo, buildAreaContext, assistantChatPort },
  };
};

const baseConversation = (overrides = {}) => ({ id: 'c1', userId: 'u1', householdId: 'h1', mode: 'food', title: 'Var olan başlık', ...overrides });

describe('makeSendAssistantMessage', () => {
  test('boş mesaj reddedilir', async () => {
    const { deps } = baseDeps();
    const useCase = makeSendAssistantMessage(deps);
    await assert.rejects(() => useCase({ conversation: baseConversation(), userId: 'u1', message: '   ' }));
  });

  test('kullanıcı mesajı ve asistan cevabı sırayla kaydedilir', async () => {
    const { appended, deps } = baseDeps();
    const useCase = makeSendAssistantMessage(deps);
    const result = await useCase({ conversation: baseConversation(), userId: 'u1', message: 'Ne pişirebilirim?' });

    assert.equal(appended[0].role, 'user');
    assert.equal(appended[0].content, 'Ne pişirebilirim?');
    assert.equal(appended[1].role, 'assistant');
    assert.equal(result.message.role, 'assistant');
  });

  test('alan bağlamı miktarı 0 olan ürünü hariç tutar, SKT yaklaşanı taşır', async () => {
    const { deps } = baseDeps();
    let captured;
    deps.assistantChatPort.reply = async ({ area }) => {
      captured = area;
      return { reply: 'ok', suggestedShoppingItems: [] };
    };
    const useCase = makeSendAssistantMessage(deps);
    await useCase({ conversation: baseConversation(), userId: 'u1', message: 'test' });

    assert.equal(captured.inventory.length, 1, 'miktarı 0 olan ürün bağlama girmemeli');
    assert.equal(captured.inventory[0].name, 'Süt');
    assert.equal(captured.expiringSoon.length, 1);
    assert.equal(captured.expiringSoon[0].daysLeft, 2);
    assert.deepEqual(captured.shoppingList, [{ name: 'Ekmek' }]);
    assert.equal(captured.recentlyCooked[0].title, 'Menemen');
  });

  test('suggestedShoppingItems döndürülür ama listeye YAZILMAZ', async () => {
    const { appended, deps } = baseDeps();
    deps.assistantChatPort.reply = async () => ({
      reply: 'Sütlaç için pirinç lazım.',
      suggestedShoppingItems: [{ name: 'Pirinç', quantity: 500, unit: 'gram', reasonText: 'sütlaç için' }],
    });
    const useCase = makeSendAssistantMessage(deps);
    const result = await useCase({ conversation: baseConversation(), userId: 'u1', message: 'sütlaç' });

    assert.equal(result.suggestedShoppingItems.length, 1);
    assert.equal(result.suggestedShoppingItems[0].name, 'Pirinç');
    assert.equal(appended.length, 2);
  });

  test('householdId:null -> inventoryItemRepo hiç çağrılmaz, area:null gider', async () => {
    const { deps, inventoryItemRepo } = baseDeps();
    inventoryItemRepo.listByHousehold = async () => { throw new Error('çağrılmamalıydı'); };
    let captured;
    deps.assistantChatPort.reply = async ({ area }) => {
      captured = area;
      return { reply: 'Merhaba! Nasıl yardımcı olabilirim?', suggestedShoppingItems: [] };
    };
    const useCase = makeSendAssistantMessage(deps);
    await useCase({ conversation: baseConversation({ householdId: null }), userId: 'u1', message: 'selam' });

    assert.equal(captured, null);
  });

  test('foodEnabled:false -> recipeCookLogRepo ve listDietProfiles çağrılmaz', async () => {
    const { deps, recipeCookLogRepo, householdMemberRepo } = baseDeps({ household: { id: 'h1', name: 'Atölye', kind: 'workshop', features: { food: false } } });
    recipeCookLogRepo.listByHousehold = async () => { throw new Error('çağrılmamalıydı'); };
    householdMemberRepo.listDietProfiles = async () => { throw new Error('çağrılmamalıydı'); };
    let captured;
    deps.assistantChatPort.reply = async ({ area, foodEnabled }) => {
      captured = { area, foodEnabled };
      return { reply: 'ok', suggestedShoppingItems: [] };
    };
    const useCase = makeSendAssistantMessage(deps);
    await useCase({ conversation: baseConversation({ mode: 'repair' }), userId: 'u1', message: 'matkap ucu lazım' });

    assert.equal(captured.foodEnabled, false);
    assert.deepEqual(captured.area.recentlyCooked, []);
    assert.equal(captured.area.diet, null);
  });

  test('title null iken setTitle çağrılır, doluyken çağrılmaz', async () => {
    const { deps } = baseDeps();
    let setTitleCalled = false;
    deps.conversationRepo.setTitleIfMissing = async (id, title) => {
      setTitleCalled = true;
      return { id, title };
    };
    deps.assistantChatPort.reply = async () => ({ reply: 'ok', suggestedShoppingItems: [], conversationTitle: 'Süt tarifleri' });

    const useCase = makeSendAssistantMessage(deps);
    await useCase({ conversation: baseConversation({ title: null }), userId: 'u1', message: 'test' });
    assert.equal(setTitleCalled, true);

    setTitleCalled = false;
    await useCase({ conversation: baseConversation({ title: 'Zaten var' }), userId: 'u1', message: 'test' });
    assert.equal(setTitleCalled, false);
  });

  test('modeMismatch/guide meta alanına yazılır', async () => {
    const { appended, deps } = baseDeps();
    deps.assistantChatPort.reply = async () => ({
      reply: 'Bu bir tamir sorusu gibi görünüyor.',
      suggestedShoppingItems: [],
      modeMismatch: 'repair',
      guide: { kind: 'task', title: 'Musluk tamiri', materials: [], steps: [{ order: 1, text: 'Suyu kapat' }] },
    });
    const useCase = makeSendAssistantMessage(deps);
    const result = await useCase({ conversation: baseConversation(), userId: 'u1', message: 'musluk damlıyor' });

    assert.equal(result.modeMismatch, 'repair');
    assert.equal(result.guide.kind, 'task');
    assert.equal(appended[1].meta.modeMismatch, 'repair');
    assert.equal(appended[1].meta.guide.title, 'Musluk tamiri');
  });
});
