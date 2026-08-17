import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeOcrArtifacts, stripHomoglyphs } from '../../../src/infrastructure/parser/text-normalize.js';

describe('normalizeOcrArtifacts', () => {
  test('İ/Ì ve Ğ/à OCR kod sayfası kaymalarını düzeltir', () => {
    assert.equal(normalizeOcrArtifacts('MÌLKTEN 200G KAYMAK'), 'MİLKTEN 200G KAYMAK');
    assert.equal(normalizeOcrArtifacts('BİRŞAH 500G MEY.YOà.'), 'BİRŞAH 500G MEY.YOğ.');
  });

  test('bozulma yoksa metni değiştirmez', () => {
    assert.equal(normalizeOcrArtifacts('CP SOSİS 500G'), 'CP SOSİS 500G');
  });
});

describe('stripHomoglyphs', () => {
  test('Kiril harfleriyle karışmış kelimeyi tamamen Latin\'e çevirir', () => {
    assert.equal(stripHomoglyphs('Milktен'), 'Milkten');
  });

  test('Türkçe harflere (ı İ ş Ş ğ Ğ ü Ü ö Ö ç Ç) dokunmaz — regresyon kilidi', () => {
    const turkishText = 'Süt Şeker Çilek Öğütülmüş Gülbahçesi ıspanak İstanbul ğ';
    assert.equal(stripHomoglyphs(turkishText), turkishText);
  });

  test('temiz Latin metni değiştirmez', () => {
    assert.equal(stripHomoglyphs('7Days Kruvasan'), '7Days Kruvasan');
  });
});
