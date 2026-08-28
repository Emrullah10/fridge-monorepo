import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeUpgradeGuestUser } from '../../../src/application/use-cases/auth/upgrade-guest-user.use-case.js';

const makeFakes = ({ users = new Map() } = {}) => {
  const upgraded = [];
  const userRepo = {
    findByEmail: async (email) => [...users.values()].find((u) => u.email === email),
    upgradeGuestToRegistered: async (id, input) => {
      upgraded.push({ id, ...input });
      return { id, isGuest: false, ...input };
    },
  };
  return { userRepo, upgraded };
};

describe('makeUpgradeGuestUser', () => {
  test('misafir hesabı yükseltir, aynı user id korunur (id UPDATE edilir, taşıma yapılmaz)', async () => {
    const fakes = makeFakes();
    const upgradeGuestUser = makeUpgradeGuestUser(fakes);

    const result = await upgradeGuestUser({
      userId: 'guest-1',
      isGuest: true,
      email: 'real@test.local',
      password: 'testpass123',
      displayName: 'Gerçek İsim',
    });

    assert.equal(result.id, 'guest-1');
    assert.equal(result.isGuest, false);
    assert.equal(fakes.upgraded.length, 1);
    assert.equal(fakes.upgraded[0].id, 'guest-1');
  });

  test('zaten kalıcı bir hesap yükseltilmeye çalışılırsa reddedilir', async () => {
    const fakes = makeFakes();
    const upgradeGuestUser = makeUpgradeGuestUser(fakes);

    await assert.rejects(
      () => upgradeGuestUser({ userId: 'user-1', isGuest: false, email: 'x@test.local', password: 'testpass123', displayName: 'X' }),
    );
    assert.equal(fakes.upgraded.length, 0);
  });

  test('email başka bir kullanıcıya aitse reddedilir (kendi sentetik email hariç)', async () => {
    const users = new Map([['other-user', { id: 'other-user', email: 'taken@test.local' }]]);
    const fakes = makeFakes({ users });
    const upgradeGuestUser = makeUpgradeGuestUser(fakes);

    await assert.rejects(
      () => upgradeGuestUser({ userId: 'guest-1', isGuest: true, email: 'taken@test.local', password: 'testpass123', displayName: 'X' }),
    );
    assert.equal(fakes.upgraded.length, 0);
  });
});
