import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeSaveGuideAsRecipe } from '../../../src/application/use-cases/assistant/save-guide-as-recipe.js';

const guideMessage = (overrides = {}) => ({
  id: 'msg-1',
  conversationId: 'c1',
  role: 'assistant',
  content: 'İşte kılavuzun',
  meta: {
    guide: {
      kind: 'task',
      title: 'Musluk tamiri',
      servings: null,
      prepMinutes: null,
      cookMinutes: null,
      materials: [{ name: 'Conta', quantity: 1, unit: 'piece' }, { name: 'M8 cıvata', quantity: 4, unit: 'piece' }],
      steps: [{ order: 1, text: 'Suyu kapat' }, { order: 2, text: 'Contayı değiştir' }],
    },
  },
  ...overrides,
});

const baseConversation = (overrides = {}) => ({ id: 'c1', userId: 'u1', householdId: 'h1', mode: 'repair', title: null, ...overrides });

const baseFakes = () => {
  const createdRecipes = [];
  const addedIngredients = [];

  const conversationRepo = {
    findMessageById: async () => guideMessage(),
    findById: async () => baseConversation(),
  };
  const householdMemberRepo = {
    findMembership: async () => ({ role: 'member' }),
  };
  const datasource = {
    withTransaction: async (fn) => fn({ query: async () => ({ rows: [] }) }),
  };
  const makeProductRepo = () => ({
    // Hiçbir malzeme eşleşmiyor -> customName ile kaydedilmeli, create ASLA
    // çağrılmamalı (katalog kirlenmesin, generate-ai-recipes.use-case.js:87-90 deseni).
    search: async () => [],
  });
  const makeRecipeRepo = () => ({
    create: async (data) => {
      const recipe = { id: 'recipe-1', ...data };
      createdRecipes.push(recipe);
      return recipe;
    },
    addIngredient: async (data) => {
      addedIngredients.push(data);
    },
  });

  return {
    createdRecipes,
    addedIngredients,
    deps: { conversationRepo, householdMemberRepo, datasource, makeProductRepo, makeRecipeRepo },
  };
};

describe('makeSaveGuideAsRecipe', () => {
  test('guide yoksa ValidationError', async () => {
    const { deps } = baseFakes();
    deps.conversationRepo.findMessageById = async () => guideMessage({ meta: {} });
    const useCase = makeSaveGuideAsRecipe(deps);
    await assert.rejects(() => useCase({ messageId: 'msg-1', userId: 'u1' }), { name: 'ValidationError' });
  });

  test('başkasının conversation\'ı -> NotFoundError', async () => {
    const { deps } = baseFakes();
    deps.conversationRepo.findById = async () => baseConversation({ userId: 'baska-kullanici' });
    const useCase = makeSaveGuideAsRecipe(deps);
    await assert.rejects(() => useCase({ messageId: 'msg-1', userId: 'u1' }), { name: 'NotFoundError' });
  });

  test('mesaj bulunamazsa NotFoundError', async () => {
    const { deps } = baseFakes();
    deps.conversationRepo.findMessageById = async () => null;
    const useCase = makeSaveGuideAsRecipe(deps);
    await assert.rejects(() => useCase({ messageId: 'yok', userId: 'u1' }), { name: 'NotFoundError' });
  });

  test("kind:'task' ile create edilir", async () => {
    const { createdRecipes, deps } = baseFakes();
    const useCase = makeSaveGuideAsRecipe(deps);
    await useCase({ messageId: 'msg-1', userId: 'u1' });

    assert.equal(createdRecipes.length, 1);
    assert.equal(createdRecipes[0].kind, 'task');
    assert.equal(createdRecipes[0].title, 'Musluk tamiri');
    assert.equal(createdRecipes[0].generatedBy, 'ai');
  });

  test('eşleşmeyen malzeme customName ile kaydedilir, productRepo.create ÇAĞRILMAZ', async () => {
    const { addedIngredients, deps } = baseFakes();
    // productRepo'ya create KOYULMADI — çağrılırsa test patlar (send-chef-message.test.js:90 deseni).
    const useCase = makeSaveGuideAsRecipe(deps);
    await useCase({ messageId: 'msg-1', userId: 'u1' });

    assert.equal(addedIngredients.length, 2);
    assert.equal(addedIngredients[0].productId, null);
    assert.equal(addedIngredients[0].customName, 'Conta');
    assert.equal(addedIngredients[1].customName, 'M8 cıvata');
  });

  test('householdId yoksa (alansız sohbet) ve verilmezse ValidationError', async () => {
    const { deps } = baseFakes();
    deps.conversationRepo.findById = async () => baseConversation({ householdId: null });
    const useCase = makeSaveGuideAsRecipe(deps);
    await assert.rejects(() => useCase({ messageId: 'msg-1', userId: 'u1' }), { name: 'ValidationError' });
  });

  test('alansız sohbette householdId body ile verilirse ve üyelik varsa çalışır', async () => {
    const { createdRecipes, deps } = baseFakes();
    deps.conversationRepo.findById = async () => baseConversation({ householdId: null });
    const useCase = makeSaveGuideAsRecipe(deps);
    await useCase({ messageId: 'msg-1', userId: 'u1', householdId: 'h2' });

    assert.equal(createdRecipes[0].householdId, 'h2');
  });
});
