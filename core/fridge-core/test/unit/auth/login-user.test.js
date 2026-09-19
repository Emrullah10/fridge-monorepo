import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

import { makeLoginUser } from '../../../src/application/use-cases/auth/login-user.use-case.js';

const makeFakes = ({ users = new Map() } = {}) => {
  const userRepo = {
    findByEmail: async (email) => [...users.values()].find((u) => u.email === email),
  };
  const sessionRepo = {
    create: async (input) => input,
  };
  const tokenService = {
    signAccessToken: () => 'access-token',
    signRefreshToken: () => 'refresh-token',
    hashRefreshToken: () => 'hashed-refresh-token',
    refreshTokenExpiryDate: () => new Date(),
  };
  return { userRepo, sessionRepo, tokenService, users };
};

describe('loginUser — doğru davranış', () => {
  test('doğru email + şifre ile giriş başarılı olur', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 10);
    const users = new Map([['user-1', { id: 'user-1', email: 'user@example.com', displayName: 'Test', passwordHash }]]);
    const loginUser = makeLoginUser(makeFakes({ users }));

    const result = await loginUser({ email: 'user@example.com', password: 'correct-password' });
    assert.equal(result.user.email, 'user@example.com');
    assert.ok(result.accessToken);
  });

  test('yanlış şifre InvalidCredentialsError fırlatır', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 10);
    const users = new Map([['user-1', { id: 'user-1', email: 'user@example.com', displayName: 'Test', passwordHash }]]);
    const loginUser = makeLoginUser(makeFakes({ users }));

    await assert.rejects(
      () => loginUser({ email: 'user@example.com', password: 'wrong-password' }),
      (error) => error.code === 'INVALID_CREDENTIALS' || error.name === 'InvalidCredentialsError',
    );
  });

  test("olmayan email InvalidCredentialsError fırlatır (enumeration'a karşı aynı hata)", async () => {
    const loginUser = makeLoginUser(makeFakes());

    await assert.rejects(
      () => loginUser({ email: 'ghost@example.com', password: 'whatever' }),
      (error) => error.code === 'INVALID_CREDENTIALS' || error.name === 'InvalidCredentialsError',
    );
  });
});

describe('loginUser — zamanlama yan kanalı düzeltmesi (güvenlik regresyon testi)', () => {
  test('var olmayan email de bcrypt.compare çalıştırır — erken dönüş yok, süre mevcut kullanıcıyla kıyaslanabilir olmalı', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 10);
    const users = new Map([['user-1', { id: 'user-1', email: 'user@example.com', displayName: 'Test', passwordHash }]]);

    const existingUserStart = process.hrtime.bigint();
    await assert.rejects(() => makeLoginUser(makeFakes({ users }))({ email: 'user@example.com', password: 'wrong' }));
    const existingUserMs = Number(process.hrtime.bigint() - existingUserStart) / 1e6;

    const ghostUserStart = process.hrtime.bigint();
    await assert.rejects(() => makeLoginUser(makeFakes({ users }))({ email: 'ghost@example.com', password: 'wrong' }));
    const ghostUserMs = Number(process.hrtime.bigint() - ghostUserStart) / 1e6;

    // Kesin bir zamanlama assertion'ı flaky olur (CPU yüküne bağlı) — burada
    // asıl garanti edilen şey ikisinin de bcrypt.compare'i GERÇEKTEN
    // çalıştırdığı (ikisi de en az birkaç ms sürer, bcrypt cost=10 ile
    // milisaniyeler mertebesinde bir iş yapar — erken dönseydi <1ms olurdu).
    assert.ok(existingUserMs > 1, `mevcut kullanıcı yolu bcrypt çalıştırmalı, geldi: ${existingUserMs}ms`);
    assert.ok(ghostUserMs > 1, `olmayan kullanıcı yolu da bcrypt çalıştırmalı (dummy hash), geldi: ${ghostUserMs}ms`);
  });

  test('userRepo.findByEmail undefined dönerse bcrypt.compare exception fırlatmadan çalışır (DUMMY_HASH fallback)', async () => {
    const loginUser = makeLoginUser(makeFakes());
    // exception AtınLMAmalı — assert.rejects zaten InvalidCredentialsError bekliyor,
    // farklı bir hata (örn. bcrypt "Invalid hash" TypeError) fırlatılırsa bu test
    // farklı bir hata koduyla başarısız olur.
    await assert.rejects(
      () => loginUser({ email: 'ghost@example.com', password: 'whatever' }),
      (error) => error.code === 'INVALID_CREDENTIALS' || error.name === 'InvalidCredentialsError',
    );
  });
});
