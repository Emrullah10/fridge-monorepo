import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  defaultFeaturesForKind,
  resolveFeatures,
  defaultLocationsForKind,
} from '../../../src/domain/household-profile.js';

describe('household-profile — defaultFeaturesForKind', () => {
  test('yemeğin doğal olduğu türlerde food açık', () => {
    for (const kind of ['home', 'summerhouse', 'cottage', 'dorm', 'boat']) {
      assert.equal(defaultFeaturesForKind(kind).food, true, kind);
    }
  });
  test('diğer türlerde food kapalı', () => {
    for (const kind of ['office', 'workshop', 'shop', 'garage', 'other']) {
      assert.equal(defaultFeaturesForKind(kind).food, false, kind);
    }
  });
});

describe('household-profile — resolveFeatures', () => {
  test('features boşsa (eski/migrasyon öncesi kayıt) türden türetilir — backfill gerekmez', () => {
    assert.equal(resolveFeatures({ kind: 'home', features: {} }).food, true);
    assert.equal(resolveFeatures({ kind: 'workshop', features: {} }).food, false);
  });
  test('features hiç yoksa (undefined) da türden türetilir', () => {
    assert.equal(resolveFeatures({ kind: 'home' }).food, true);
  });
  test('kullanıcı açıkça false/true yazdıysa türü ezer', () => {
    assert.equal(resolveFeatures({ kind: 'home', features: { food: false } }).food, false);
    assert.equal(resolveFeatures({ kind: 'office', features: { food: true } }).food, true);
  });
});

describe('household-profile — defaultLocationsForKind', () => {
  test('home türü mutfak bölümleriyle açılır (eski davranış korunur)', () => {
    const locations = defaultLocationsForKind('home');
    assert.deepEqual(locations.map((l) => l.name), ['Buzdolabı', 'Dondurucu', 'Kiler']);
  });
  test('workshop türü atölye bölümleriyle açılır', () => {
    const locations = defaultLocationsForKind('workshop');
    assert.deepEqual(locations.map((l) => l.name), ['Raf', 'Çekmece', 'Kutu']);
    // Hepsi mevcut chk_storage_location_kind CHECK listesinden seçilmeli.
    assert.deepEqual(locations.map((l) => l.kind), ['shelf', 'drawer', 'box']);
  });
  test('bilinmeyen tür "other" bölümlerine düşer, asla çökmez', () => {
    const locations = defaultLocationsForKind('unknown-kind');
    assert.deepEqual(locations, defaultLocationsForKind('other'));
  });
});
