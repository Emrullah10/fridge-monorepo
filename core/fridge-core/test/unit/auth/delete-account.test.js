import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

import { makeDeleteAccount } from '../../../src/application/use-cases/auth/delete-account.use-case.js';

const makeFakes = ({ users = new Map(), households = new Map(), members = new Map(), invites = [] } = {}) => {
  const deletedUserIds = [];
  const deletedHouseholdIds = [];
  const ownershipTransfers = [];
  const deletedInvitesByUser = [];

  const datasource = {
    withTransaction: async (fn) => fn({ query: 'fake-tx-query' }),
  };

  const userRepo = {
    findById: async (id) => users.get(id),
  };

  const makeUserRepo = () => ({
    deleteById: async (id) => deletedUserIds.push(id),
  });

  const makeHouseholdRepo = () => ({
    findByCreatedBy: async (userId) => [...households.values()].filter((h) => h.createdBy === userId),
    transferOwnership: async (id, newOwnerUserId) => ownershipTransfers.push({ id, newOwnerUserId }),
    deleteById: async (id) => deletedHouseholdIds.push(id),
  });

  const makeHouseholdMemberRepo = () => ({
    listMembers: async (householdId) => members.get(householdId) ?? [],
  });

  const makeHouseholdInviteRepo = () => ({
    deleteByInvitedBy: async (userId) => deletedInvitesByUser.push(userId),
  });

  return {
    datasource,
    userRepo,
    makeUserRepo,
    makeHouseholdRepo,
    makeHouseholdMemberRepo,
    makeHouseholdInviteRepo,
    deletedUserIds,
    deletedHouseholdIds,
    ownershipTransfers,
    deletedInvitesByUser,
  };
};

describe('makeDeleteAccount', () => {
  test('yanlış şifreyle silme reddedilir, hiçbir şey silinmez', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const users = new Map([['user-1', { id: 'user-1', passwordHash }]]);
    const fakes = makeFakes({ users });
    const deleteAccount = makeDeleteAccount(fakes);

    await assert.rejects(() => deleteAccount({ userId: 'user-1', password: 'wrong-password' }));
    assert.deepEqual(fakes.deletedUserIds, []);
  });

  test('tek üyeli household tamamen silinir', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const users = new Map([['user-1', { id: 'user-1', passwordHash }]]);
    const households = new Map([['hh-1', { id: 'hh-1', createdBy: 'user-1' }]]);
    const members = new Map([['hh-1', [{ userId: 'user-1', joinedAt: '2026-01-01' }]]]);
    const fakes = makeFakes({ users, households, members });
    const deleteAccount = makeDeleteAccount(fakes);

    await deleteAccount({ userId: 'user-1', password: 'correct-password' });

    assert.deepEqual(fakes.deletedHouseholdIds, ['hh-1']);
    assert.deepEqual(fakes.ownershipTransfers, []);
    assert.deepEqual(fakes.deletedUserIds, ['user-1']);
    assert.deepEqual(fakes.deletedInvitesByUser, ['user-1']);
  });

  test('paylaşımlı household sahipliği en eski diğer üyeye devredilir', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const users = new Map([['user-1', { id: 'user-1', passwordHash }]]);
    const households = new Map([['hh-1', { id: 'hh-1', createdBy: 'user-1' }]]);
    const members = new Map([['hh-1', [
      { userId: 'user-1', joinedAt: '2026-01-01' },
      { userId: 'user-3', joinedAt: '2026-03-01' },
      { userId: 'user-2', joinedAt: '2026-02-01' },
    ]]]);
    const fakes = makeFakes({ users, households, members });
    const deleteAccount = makeDeleteAccount(fakes);

    await deleteAccount({ userId: 'user-1', password: 'correct-password' });

    assert.deepEqual(fakes.deletedHouseholdIds, []);
    assert.deepEqual(fakes.ownershipTransfers, [{ id: 'hh-1', newOwnerUserId: 'user-2' }]);
    assert.deepEqual(fakes.deletedUserIds, ['user-1']);
  });
});
