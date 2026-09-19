import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildPasswordResetEmail } from '../../../src/infrastructure/mail/password-reset-email.js';

describe('buildPasswordResetEmail — displayName HTML escape (güvenlik regresyon testi)', () => {
  test('normal isimde HTML gövdesi değişmez', () => {
    const { html } = buildPasswordResetEmail({ displayName: 'Ahmet Yılmaz', code: '123456', ttlMinutes: 15 });
    assert.ok(html.includes('Merhaba Ahmet Yılmaz,'));
  });

  test('HTML enjeksiyonu içeren displayName escape edilir', () => {
    const malicious = '<img src=x onerror=alert(1)>';
    const { html } = buildPasswordResetEmail({ displayName: malicious, code: '123456', ttlMinutes: 15 });

    assert.ok(!html.includes('<img'), 'ham <img etiketi HTML çıktısında olmamalı');
    assert.ok(html.includes('&lt;img'), 'escape edilmiş hali görünmeli');
  });

  test('anchor tag ile phishing linki escape edilir', () => {
    const malicious = '<a href="https://evil.example/">Tıkla</a>';
    const { html } = buildPasswordResetEmail({ displayName: malicious, code: '123456', ttlMinutes: 15 });

    assert.ok(!html.includes('<a href='), 'ham <a> etiketi render edilmemeli');
    assert.ok(html.includes('&lt;a href=&quot;https://evil.example/&quot;&gt;'));
  });

  test('düz metin (text) gövdesi escape edilmez — e-posta istemcisi zaten HTML render etmez', () => {
    const { text } = buildPasswordResetEmail({ displayName: 'Ahmet & Oğuz', code: '123456', ttlMinutes: 15 });
    assert.ok(text.includes('Merhaba Ahmet & Oğuz,'), 'düz metinde & escape edilmemeli, HTML entity anlamsız olurdu');
  });

  test('kod ve süre HTML gövdesinde hâlâ doğru şekilde yer alır', () => {
    const { html } = buildPasswordResetEmail({ displayName: 'Test', code: '999999', ttlMinutes: 30 });
    assert.ok(html.includes('999999'));
    assert.ok(html.includes('30'));
  });
});
