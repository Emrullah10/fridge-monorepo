import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildSystemPrompt, buildAreaContext } from '../../../src/infrastructure/assistant/assistant-prompt.js';

const baseArea = () => ({
  inventory: [{ name: 'Süt', brand: 'Sütaş', quantity: 2, unit: 'liter', expiresAt: '2026-08-29' }],
  expiringSoon: [{ name: 'Süt', expiresAt: '2026-08-29', daysLeft: 2 }],
  shoppingList: [{ name: 'Ekmek' }],
  recentlyCooked: [{ title: 'Menemen' }],
  diet: { allergens: ['fıstık'], diets: ['vegan'] },
});

describe('buildSystemPrompt', () => {
  test('alansızda alansız notu var, mod bloğu doğru', () => {
    const prompt = buildSystemPrompt({ mode: 'food', hasHousehold: false, foodEnabled: true });
    assert.match(prompt, /erişimin YOK/);
    assert.match(prompt, /AKTİF MOD: YEMEK/);
  });

  test('mode:repair -> tamir bloğu var, yemek yok', () => {
    const prompt = buildSystemPrompt({ mode: 'repair', hasHousehold: true, foodEnabled: true });
    assert.match(prompt, /AKTİF MOD: TAMİR\/BAKIM/);
    assert.doesNotMatch(prompt, /AKTİF MOD: YEMEK/);
  });

  test('mode:general -> genel blok', () => {
    const prompt = buildSystemPrompt({ mode: 'general', hasHousehold: true, foodEnabled: true });
    assert.match(prompt, /AKTİF MOD: GENEL/);
  });

  test('MOD UYUMU kuralı her zaman metinde bulunur', () => {
    const prompt = buildSystemPrompt({ mode: 'food', hasHousehold: true, foodEnabled: true });
    assert.match(prompt, /MOD UYUMU/);
    assert.match(prompt, /modeMismatch/);
  });
});

describe('buildAreaContext', () => {
  test('food açıkken 5 blok yerinde (SKT/DOLAP/ALIŞVERİŞ/SON PİŞİRİLEN/ALERJEN)', () => {
    const ctx = buildAreaContext({ area: baseArea(), foodEnabled: true });
    assert.match(ctx, /SKT YAKLAŞANLAR/);
    assert.match(ctx, /DOLAP \/ KİLER:/);
    assert.match(ctx, /ALIŞVERİŞ LİSTESİNDE/);
    assert.match(ctx, /SON PİŞİRİLENLER:/);
    assert.match(ctx, /ALERJENLER/);
  });

  test('food kapalıyken DOLAP/KİLER, SON PİŞİRİLENLER, ALERJENLER geçmiyor', () => {
    const area = { ...baseArea(), diet: null, recentlyCooked: [] };
    const ctx = buildAreaContext({ area, foodEnabled: false });
    assert.doesNotMatch(ctx, /DOLAP \/ KİLER:/);
    assert.doesNotMatch(ctx, /SON PİŞİRİLENLER:/);
    assert.doesNotMatch(ctx, /ALERJENLER/);
    assert.match(ctx, /ALANDAKİ EŞYALAR:/);
    assert.match(ctx, /TARİHİ YAKLAŞANLAR:/);
    assert.match(ctx, /ALIŞVERİŞ LİSTESİNDE/);
  });

  test('alan adı ve türü prompta girer', () => {
    const ctx = buildAreaContext({ area: baseArea(), areaName: 'Yazlık Evi', areaKind: 'summerhouse', foodEnabled: true });
    assert.match(ctx, /ALAN: Yazlık Evi \(yazlık\)/);
  });

  test('alan adı verilmezse ALAN: satırı yok', () => {
    const ctx = buildAreaContext({ area: baseArea(), foodEnabled: true });
    assert.doesNotMatch(ctx, /^ALAN:/m);
  });
});
