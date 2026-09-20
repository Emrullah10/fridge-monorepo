import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeUpdateConversation } from '../../../src/application/use-cases/assistant/update-conversation.js';

const makeFakes = ({ memberships = new Map(), entitlementsLimit = null } = {}) => {
  const conversations = new Map([
    ['conv-1', { id: 'conv-1', userId: 'user-1', householdId: null, title: null, mode: 'general' }],
  ]);
  const membershipCalls = [];

  const conversationRepo = {
    update: async (id, { title, householdId, mode }) => {
      const existing = conversations.get(id);
      if (!existing) return null;
      const updated = {
        ...existing,
        title: title !== undefined ? title : existing.title,
        householdId: householdId !== undefined ? householdId : existing.householdId,
        mode: mode !== undefined ? mode : existing.mode,
      };
      conversations.set(id, updated);
      return updated;
    },
  };

  const householdMemberRepo = {
    findMembership: async ({ householdId, userId }) => {
      membershipCalls.push({ householdId, userId });
      return memberships.get(`${householdId}:${userId}`);
    },
  };

  const resolveLockedHouseholdIds = () => new Set();
  const getEntitlements = async () => ({ householdCountLimit: entitlementsLimit });
  const listMembershipsWithJoinedAt = async () => [];

  return {
    conversations, membershipCalls,
    conversationRepo, householdMemberRepo, resolveLockedHouseholdIds, getEntitlements, listMembershipsWithJoinedAt,
  };
};

describe('updateConversation — householdId IDOR koruması (güvenlik regresyon testi)', () => {
  test('üye olunan bir householdId\'ye bağlama başarılı olur', async () => {
    const fakes = makeFakes({ memberships: new Map([['hh-1:user-1', { role: 'owner' }]]) });
    const updateConversation = makeUpdateConversation(fakes);

    const result = await updateConversation({ conversationId: 'conv-1', userId: 'user-1', householdId: 'hh-1' });
    assert.equal(result.householdId, 'hh-1');
    assert.equal(fakes.membershipCalls.length, 1);
  });

  test('üye OLUNMAYAN bir householdId\'ye bağlama NotFoundError fırlatır — kayıt güncellenmez', async () => {
    const fakes = makeFakes({ memberships: new Map() }); // hiçbir üyelik yok
    const updateConversation = makeUpdateConversation(fakes);

    await assert.rejects(
      () => updateConversation({ conversationId: 'conv-1', userId: 'user-1', householdId: 'hh-2' }),
      (error) => error.code === 'NOT_FOUND',
    );

    // Kayıt DEĞİŞMEMİŞ olmalı — doğrulama repo.update()'ten ÖNCE çalışır.
    assert.equal(fakes.conversations.get('conv-1').householdId, null);
  });

  test('householdId gönderilmezse (undefined) üyelik kontrolü hiç çalışmaz — title/mode güncellemesi gereksiz sorguya girmez', async () => {
    const fakes = makeFakes();
    const updateConversation = makeUpdateConversation(fakes);

    const result = await updateConversation({ conversationId: 'conv-1', userId: 'user-1', title: 'Yeni Başlık' });
    assert.equal(result.title, 'Yeni Başlık');
    assert.equal(fakes.membershipCalls.length, 0, 'householdId undefined iken membership sorgusu atılmamalı');
  });

  test('householdId null gönderilirse (alansız hale getirme) üyelik kontrolüne gerek yok', async () => {
    const fakes = makeFakes();
    const updateConversation = makeUpdateConversation(fakes);

    // Önce bir household bağla, sonra null'a çek.
    fakes.conversations.set('conv-1', { id: 'conv-1', userId: 'user-1', householdId: 'hh-1', title: null, mode: 'general' });

    const result = await updateConversation({ conversationId: 'conv-1', userId: 'user-1', householdId: null });
    assert.equal(result.householdId, null);
    assert.equal(fakes.membershipCalls.length, 0, 'null householdId için assertHouseholdUsableForConversation early-return yapmalı');
  });

  test('olmayan conversationId NotFoundError fırlatır', async () => {
    const fakes = makeFakes();
    const updateConversation = makeUpdateConversation(fakes);

    await assert.rejects(
      () => updateConversation({ conversationId: 'ghost-conv', userId: 'user-1', title: 'X' }),
      (error) => error.code === 'NOT_FOUND',
    );
  });
});
