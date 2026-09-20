import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeCreateConversation } from '../../../src/application/use-cases/assistant/create-conversation.js';

const makeFakes = ({ memberships = new Map(), entitlementsLimit = null } = {}) => {
  const created = [];
  const conversationRepo = {
    create: async (input) => {
      const conversation = { id: 'new-conv', ...input };
      created.push(conversation);
      return conversation;
    },
  };
  const householdMemberRepo = {
    findMembership: async ({ householdId, userId }) => memberships.get(`${householdId}:${userId}`),
  };
  const resolveLockedHouseholdIds = () => new Set();
  const getEntitlements = async () => ({ householdCountLimit: entitlementsLimit });
  const listMembershipsWithJoinedAt = async () => [];

  return { created, conversationRepo, householdMemberRepo, resolveLockedHouseholdIds, getEntitlements, listMembershipsWithJoinedAt };
};

describe('createConversation — assertHouseholdUsableForConversation refactörü sonrası davranış korunuyor', () => {
  test('householdId olmadan (genel sohbet) doğrudan yaratılır', async () => {
    const fakes = makeFakes();
    const createConversation = makeCreateConversation(fakes);

    const result = await createConversation({ userId: 'user-1' });
    assert.equal(result.householdId, null);
    assert.equal(result.mode, 'general');
  });

  test('üye olunan householdId ile yaratılır', async () => {
    const fakes = makeFakes({ memberships: new Map([['hh-1:user-1', { role: 'owner' }]]) });
    const createConversation = makeCreateConversation(fakes);

    const result = await createConversation({ userId: 'user-1', householdId: 'hh-1', mode: 'food' });
    assert.equal(result.householdId, 'hh-1');
    assert.equal(result.mode, 'food');
  });

  test('üye OLUNMAYAN householdId ile NotFoundError fırlatır', async () => {
    const fakes = makeFakes();
    const createConversation = makeCreateConversation(fakes);

    await assert.rejects(
      () => createConversation({ userId: 'user-1', householdId: 'hh-ghost' }),
      (error) => error.code === 'NOT_FOUND',
    );
    assert.equal(fakes.created.length, 0);
  });

  test('geçersiz mode "general"e düşer', async () => {
    const fakes = makeFakes();
    const createConversation = makeCreateConversation(fakes);

    const result = await createConversation({ userId: 'user-1', mode: 'not-a-real-mode' });
    assert.equal(result.mode, 'general');
  });
});
