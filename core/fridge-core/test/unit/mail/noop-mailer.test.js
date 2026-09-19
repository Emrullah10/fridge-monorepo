import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeNoopMailer } from '../../../src/infrastructure/mail/noop-mailer.adapter.js';

const makeFakeLogger = () => {
  const calls = { warn: [], error: [] };
  return {
    calls,
    warn: (...args) => calls.warn.push(args),
    error: (...args) => calls.error.push(args),
  };
};

describe('noop-mailer — sıfırlama kodu yalnızca development\'ta loglanmalı (güvenlik regresyon testi)', () => {
  test('development ortamında kod konsola basılır', async () => {
    const logger = makeFakeLogger();
    const mailer = makeNoopMailer({ logger, nodeEnv: 'development' });

    await mailer.sendPasswordResetCode({ to: 'user@example.com', code: '123456', ttlMinutes: 15 });

    assert.equal(logger.calls.warn.length, 1);
    assert.ok(logger.calls.warn[0][0].includes('123456'), 'dev\'de kod loglanmalı');
    assert.equal(logger.calls.error.length, 0);
  });

  test('production ortamında kod loglanmaz', async () => {
    const logger = makeFakeLogger();
    const mailer = makeNoopMailer({ logger, nodeEnv: 'production' });

    await mailer.sendPasswordResetCode({ to: 'user@example.com', code: '123456', ttlMinutes: 15 });

    assert.equal(logger.calls.warn.length, 0, 'prod\'da warn ile kod basılmamalı');
    assert.equal(logger.calls.error.length, 1, 'prod\'da bir hata logu düşmeli (kodsuz)');
    assert.ok(!logger.calls.error[0][0].includes('123456'), 'prod log satırı kodu içermemeli');
  });

  test('staging/tanımsız gibi belirsiz ortamlarda da kod loglanmaz (ak liste ilkesi)', async () => {
    const logger = makeFakeLogger();
    const mailer = makeNoopMailer({ logger, nodeEnv: 'staging' });

    await mailer.sendPasswordResetCode({ to: 'user@example.com', code: '999999', ttlMinutes: 15 });

    assert.equal(logger.calls.warn.length, 0, 'staging development olmadığı için kod loglanmamalı');
    assert.equal(logger.calls.error.length, 1);
    assert.ok(!logger.calls.error[0][0].includes('999999'));
  });

  test('nodeEnv verilmezse (varsayılan process.env.NODE_ENV testte genelde tanımsız) kod loglanmaz', async () => {
    const logger = makeFakeLogger();
    const mailer = makeNoopMailer({ logger, nodeEnv: undefined });

    await mailer.sendPasswordResetCode({ to: 'user@example.com', code: '777777', ttlMinutes: 15 });

    assert.equal(logger.calls.warn.length, 0);
    assert.equal(logger.calls.error.length, 1);
  });
});
