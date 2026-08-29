import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeRequestPasswordReset } from '../../../src/application/use-cases/auth/request-password-reset.use-case.js';

const makeFakes = ({ users = [] } = {}) => {
  const created = [];
  const invalidated = [];
  const sent = [];
  const mailerErrors = [];

  const userRepo = {
    findByEmail: async (email) => users.find((u) => u.email === email),
  };
  const passwordResetRepo = {
    invalidateAllForUser: async (userId) => invalidated.push(userId),
    create: async (input) => {
      created.push(input);
      return { id: `token-${created.length}`, ...input };
    },
  };
  const mailer = {
    sendPasswordResetCode: async (input) => {
      if (mailer._shouldThrow) throw new Error('mail servisi çöktü');
      sent.push(input);
    },
    _shouldThrow: false,
  };

  return { userRepo, passwordResetRepo, mailer, created, invalidated, sent };
};

describe('makeRequestPasswordReset', () => {
  test('kayıtlı e-posta için kod üretir, hash\'ler ve mail gönderir', async () => {
    const fakes = makeFakes({ users: [{ id: 'u1', email: 'a@test.local', displayName: 'A', isGuest: false }] });
    const requestPasswordReset = makeRequestPasswordReset(fakes);

    await requestPasswordReset({ email: 'a@test.local' });

    assert.equal(fakes.invalidated.length, 1);
    assert.equal(fakes.created.length, 1);
    assert.equal(fakes.created[0].userId, 'u1');
    assert.match(fakes.created[0].codeHash, /^[0-9a-f]{64}$/); // sha256 hex — düz kod DB'ye yazılmaz
    assert.equal(fakes.sent.length, 1);
    assert.equal(fakes.sent[0].to, 'a@test.local');
    assert.match(fakes.sent[0].code, /^\d{6}$/);
  });

  test('bilinmeyen e-posta sessizce başarıyla biter (enumeration sızdırmaz)', async () => {
    const fakes = makeFakes({ users: [] });
    const requestPasswordReset = makeRequestPasswordReset(fakes);

    await assert.doesNotReject(() => requestPasswordReset({ email: 'yok@test.local' }));
    assert.equal(fakes.created.length, 0);
    assert.equal(fakes.sent.length, 0);
  });

  test('misafir hesap mail almaz', async () => {
    const fakes = makeFakes({ users: [{ id: 'g1', email: 'guest+x@guest.local', displayName: 'Misafir', isGuest: true }] });
    const requestPasswordReset = makeRequestPasswordReset(fakes);

    await requestPasswordReset({ email: 'guest+x@guest.local' });

    assert.equal(fakes.created.length, 0);
    assert.equal(fakes.sent.length, 0);
  });

  test('mail gönderimi patlarsa akış yine başarıyla biter', async () => {
    const fakes = makeFakes({ users: [{ id: 'u1', email: 'a@test.local', displayName: 'A', isGuest: false }] });
    fakes.mailer._shouldThrow = true;
    const requestPasswordReset = makeRequestPasswordReset(fakes);

    await assert.doesNotReject(() => requestPasswordReset({ email: 'a@test.local' }));
    assert.equal(fakes.created.length, 1); // kod yine üretildi/kaydedildi
  });
});
