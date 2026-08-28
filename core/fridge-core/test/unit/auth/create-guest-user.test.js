import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeCreateGuestUser } from '../../../src/application/use-cases/auth/create-guest-user.use-case.js';

const makeFakes = () => {
  const users = new Map();
  const sessionsCreated = [];
  const householdsCreated = [];
  const touchedIds = [];

  const userRepo = {
    findByGuestDeviceId: async (deviceId) => [...users.values()].find((u) => u.guestDeviceId === deviceId),
    create: async (input) => {
      const user = { id: `user-${users.size + 1}`, ...input };
      users.set(user.id, user);
      return user;
    },
    touchLastSeen: async (id) => touchedIds.push(id),
  };

  const sessionRepo = {
    create: async (input) => sessionsCreated.push(input),
  };

  const tokenService = {
    signAccessToken: ({ userId }) => `access-${userId}`,
    signRefreshToken: ({ userId }) => `refresh-${userId}`,
    hashRefreshToken: (token) => `hashed-${token}`,
    refreshTokenExpiryDate: () => new Date('2030-01-01'),
  };

  const createHousehold = async (input) => {
    householdsCreated.push(input);
    return { id: `household-${householdsCreated.length}`, ...input };
  };

  return { users, userRepo, sessionRepo, tokenService, createHousehold, sessionsCreated, householdsCreated, touchedIds };
};

describe('makeCreateGuestUser', () => {
  test('yeni cihaz için misafir hesap açar, sentetik email/şifreyle NOT NULL kısıtına uyar', async () => {
    const fakes = makeFakes();
    const createGuestUser = makeCreateGuestUser(fakes);

    const result = await createGuestUser({ deviceId: 'device-1' });

    assert.equal(result.user.isGuest, true);
    assert.match(result.user.email, /^guest\+.+@guest\.local$/);
    assert.equal(result.accessToken, `access-${result.user.id}`);
    assert.equal(fakes.sessionsCreated.length, 1);
  });

  test('misafire otomatik bir alan açılır — boş listeyle karşılanmaz', async () => {
    const fakes = makeFakes();
    const createGuestUser = makeCreateGuestUser(fakes);

    await createGuestUser({ deviceId: 'device-1' });

    assert.equal(fakes.householdsCreated.length, 1);
    assert.equal(fakes.householdsCreated[0].name, 'Evim');
    assert.equal(fakes.householdsCreated[0].kind, 'home');
  });

  test('aynı deviceId ikinci kez çağrılırsa MEVCUT misafir döner, yeni hesap/alan yaratılmaz', async () => {
    const fakes = makeFakes();
    const createGuestUser = makeCreateGuestUser(fakes);

    const first = await createGuestUser({ deviceId: 'device-1' });
    const second = await createGuestUser({ deviceId: 'device-1' });

    assert.equal(second.user.id, first.user.id);
    assert.equal(fakes.householdsCreated.length, 1, 'ikinci çağrıda yeni alan açılmamalı');
    assert.equal(fakes.users.size, 1, 'ikinci çağrıda yeni kullanıcı yaratılmamalı');
    assert.deepEqual(fakes.touchedIds, [first.user.id]);
  });

  test('farklı deviceId ayrı bir misafir hesabı açar', async () => {
    const fakes = makeFakes();
    const createGuestUser = makeCreateGuestUser(fakes);

    const first = await createGuestUser({ deviceId: 'device-1' });
    const second = await createGuestUser({ deviceId: 'device-2' });

    assert.notEqual(first.user.id, second.user.id);
    assert.equal(fakes.householdsCreated.length, 2);
  });
});
