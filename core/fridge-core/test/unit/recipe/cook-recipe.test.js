import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeCookRecipe } from '../../../src/application/use-cases/recipe/cook-recipe.use-case.js';

const makeFakes = () => {
  const recipes = new Map([
    ['recipe-1', {
      id: 'recipe-1',
      householdId: 'hh-1',
      title: 'Test Tarif',
    }],
  ]);
  const ingredientsByRecipe = new Map([
    ['recipe-1', [{ productId: 'product-1', quantity: 2, unit: 'piece' }]],
  ]);
  const items = new Map([
    ['item-1', { id: 'item-1', householdId: 'hh-1', productId: 'product-1', unit: 'piece', quantity: 5 }],
  ]);
  const movementsCreated = [];
  const cookLogsCreated = [];

  const recipeRepo = {
    findById: async (id) => recipes.get(id),
    listIngredients: async (recipeId) => ingredientsByRecipe.get(recipeId) ?? [],
  };

  const datasource = {
    withTransaction: async (fn) => fn({ query: async () => ({ rows: [] }) }),
  };

  const makeInventoryItemRepo = () => ({
    listByHousehold: async (householdId) => [...items.values()].filter((item) => item.householdId === householdId),
    adjustQuantity: async ({ id, deltaQuantity }) => {
      const item = items.get(id);
      item.quantity += deltaQuantity;
      return item;
    },
  });

  const makeStockMovementRepo = () => ({
    create: async (input) => {
      movementsCreated.push(input);
      return input;
    },
  });

  const makeRecipeCookLogRepo = () => ({
    create: async (input) => {
      cookLogsCreated.push(input);
      return input;
    },
  });

  return {
    recipes, items, movementsCreated, cookLogsCreated,
    recipeRepo, datasource, makeInventoryItemRepo, makeStockMovementRepo, makeRecipeCookLogRepo,
  };
};

describe('cookRecipe — household izolasyonu (IDOR regresyon testi)', () => {
  test('doğru householdId ile pişirme başarılı olur, stok düşer', async () => {
    const fakes = makeFakes();
    const cookRecipe = makeCookRecipe(fakes);

    const result = await cookRecipe({ recipeId: 'recipe-1', householdId: 'hh-1', cookedBy: 'user-1' });

    assert.equal(result.consumed.length, 1);
    assert.equal(result.consumed[0].quantity, 2);
    assert.equal(fakes.items.get('item-1').quantity, 3);
    assert.equal(fakes.movementsCreated.length, 1);
    assert.equal(fakes.cookLogsCreated.length, 1);
  });

  test('yanlış householdId ile NotFoundError fırlatır — başka evin tarifi pişirilemez', async () => {
    const fakes = makeFakes();
    const cookRecipe = makeCookRecipe(fakes);

    await assert.rejects(
      () => cookRecipe({ recipeId: 'recipe-1', householdId: 'hh-2', cookedBy: 'attacker' }),
      (error) => error.code === 'NOT_FOUND',
    );

    // Malzeme listesi sızdırılmamalı, stok değişmemeli, log yazılmamalı.
    assert.equal(fakes.items.get('item-1').quantity, 5);
    assert.equal(fakes.movementsCreated.length, 0);
    assert.equal(fakes.cookLogsCreated.length, 0);
  });

  test('olmayan recipeId ile NotFoundError fırlatır', async () => {
    const fakes = makeFakes();
    const cookRecipe = makeCookRecipe(fakes);

    await assert.rejects(
      () => cookRecipe({ recipeId: 'ghost-recipe', householdId: 'hh-1', cookedBy: 'user-1' }),
      (error) => error.code === 'NOT_FOUND',
    );
  });
});
