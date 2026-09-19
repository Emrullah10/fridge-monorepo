import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { readEnv } from '../../../packages/modules/config/src/index.js';

const baseEnv = () => ({
  DATABASE_URL: 'postgres://fridge:fridge@localhost:5432/fridge',
  JWT_ACCESS_SECRET: 'test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
});

describe('readEnv — JWT secret fallback\'leri kaldırıldı (güvenlik regresyon testi)', () => {
  test('JWT_ACCESS_SECRET eksikse NODE_ENV development iken bile boot patlar', () => {
    const env = baseEnv();
    delete env.JWT_ACCESS_SECRET;
    assert.throws(() => readEnv(env), /Missing required env vars/);
  });

  test('JWT_REFRESH_SECRET eksikse NODE_ENV tanımsız iken bile boot patlar', () => {
    const env = baseEnv();
    delete env.JWT_REFRESH_SECRET;
    delete env.NODE_ENV;
    assert.throws(() => readEnv(env), /Missing required env vars/);
  });

  test('her iki secret de eksikse hata mesajı ikisini de listeler', () => {
    const env = baseEnv();
    delete env.JWT_ACCESS_SECRET;
    delete env.JWT_REFRESH_SECRET;
    assert.throws(() => readEnv(env), /JWT_ACCESS_SECRET/);
    assert.throws(() => readEnv(env), /JWT_REFRESH_SECRET/);
  });

  test('secret\'lar tanımlıysa hiçbir sabit fallback kullanılmaz, env değeri aynen geçer', () => {
    const env = baseEnv();
    const config = readEnv(env);
    assert.equal(config.jwtAccessSecret, 'test-access-secret');
    assert.equal(config.jwtRefreshSecret, 'test-refresh-secret');
    assert.notEqual(config.jwtAccessSecret, 'dev-access-secret');
    assert.notEqual(config.jwtRefreshSecret, 'dev-refresh-secret');
  });

  test('NODE_ENV=production ile de aynı zorunluluk geçerli (davranış değişmedi)', () => {
    const env = baseEnv();
    env.NODE_ENV = 'production';
    delete env.JWT_ACCESS_SECRET;
    assert.throws(() => readEnv(env), /Missing required env vars/);
  });

  test('DATABASE_URL hâlâ her ortamda zorunlu (mevcut davranış korunuyor)', () => {
    const env = baseEnv();
    delete env.DATABASE_URL;
    assert.throws(() => readEnv(env), /DATABASE_URL/);
  });
});
