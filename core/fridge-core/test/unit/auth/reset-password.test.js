import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { makeResetPassword } from '../../../src/application/use-cases/auth/reset-password.use-case.js';

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

const makeFakes = ({ user, token } = {}) => {
  const updatedPasswords = [];
  const consumed = [];
  const attemptsIncremented = [];
  const revoked = [];

  const userRepo = {
    findByEmail: async (email) => (user && user.email === email ? user : undefined),
    updatePassword: async (id, passwordHash) => updatedPasswords.push({ id, passwordHash }),
  };
  const passwordResetRepo = {
    findActiveByUserId: async (userId) => (token && token.userId === userId ? token : undefined),
    incrementAttempts: async (id) => attemptsIncremented.push(id),
    markConsumed: async (id) => consumed.push(id),
  };
  const sessionRepo = {
    revokeAllForUser: async (userId) => revoked.push(userId),
  };

  return { userRepo, passwordResetRepo, sessionRepo, updatedPasswords, consumed, attemptsIncremented, revoked };
};

describe('makeResetPassword', () => {
  test('doğru kod şifreyi değiştirir, token\'ı tüketir ve oturumları düşürür', async () => {
    const user = { id: 'u1', email: 'a@test.local' };
    const token = { id: 't1', userId: 'u1', codeHash: hashCode('123456'), attempts: 0 };
    const fakes = makeFakes({ user, token });
    const resetPassword = makeResetPassword(fakes);

    await resetPassword({ email: 'a@test.local', code: '123456', newPassword: 'yenisifre123' });

    assert.equal(fakes.updatedPasswords.length, 1);
    assert.equal(fakes.updatedPasswords[0].id, 'u1');
    assert.equal(fakes.consumed[0], 't1');
    assert.equal(fakes.revoked[0], 'u1');
  });

  test('yanlış kod reddedilir ve deneme sayısı artar', async () => {
    const user = { id: 'u1', email: 'a@test.local' };
    const token = { id: 't1', userId: 'u1', codeHash: hashCode('123456'), attempts: 0 };
    const fakes = makeFakes({ user, token });
    const resetPassword = makeResetPassword(fakes);

    await assert.rejects(() => resetPassword({ email: 'a@test.local', code: '000000', newPassword: 'yenisifre123' }));

    assert.equal(fakes.attemptsIncremented[0], 't1');
    assert.equal(fakes.updatedPasswords.length, 0);
  });

  test('5 deneme aşılmış token reddedilir (kaba kuvvet koruması)', async () => {
    const user = { id: 'u1', email: 'a@test.local' };
    const token = { id: 't1', userId: 'u1', codeHash: hashCode('123456'), attempts: 5 };
    const fakes = makeFakes({ user, token });
    const resetPassword = makeResetPassword(fakes);

    await assert.rejects(() => resetPassword({ email: 'a@test.local', code: '123456', newPassword: 'yenisifre123' }));
    assert.equal(fakes.updatedPasswords.length, 0);
  });

  test('süresi dolmuş / tüketilmiş token bulunamaz (repo zaten filtreler) → reddedilir', async () => {
    const user = { id: 'u1', email: 'a@test.local' };
    const fakes = makeFakes({ user, token: undefined });
    const resetPassword = makeResetPassword(fakes);

    await assert.rejects(() => resetPassword({ email: 'a@test.local', code: '123456', newPassword: 'yenisifre123' }));
  });

  test('kısa yeni şifre ValidationError fırlatır', async () => {
    const user = { id: 'u1', email: 'a@test.local' };
    const token = { id: 't1', userId: 'u1', codeHash: hashCode('123456'), attempts: 0 };
    const fakes = makeFakes({ user, token });
    const resetPassword = makeResetPassword(fakes);

    await assert.rejects(() => resetPassword({ email: 'a@test.local', code: '123456', newPassword: 'kisa' }));
    assert.equal(fakes.updatedPasswords.length, 0);
  });

  test('bilinmeyen e-posta reddedilir', async () => {
    const fakes = makeFakes({ user: undefined, token: undefined });
    const resetPassword = makeResetPassword(fakes);

    await assert.rejects(() => resetPassword({ email: 'yok@test.local', code: '123456', newPassword: 'yenisifre123' }));
  });
});
