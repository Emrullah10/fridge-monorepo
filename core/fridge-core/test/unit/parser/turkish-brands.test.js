import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { findBrandInText } from '../../../src/infrastructure/parser/turkish-brands.js';

describe('findBrandInText', () => {
  test('tam alt dize eşleşmesi (bitişik yazım): "55G7DAYS" içinde "7DAYS"', () => {
    assert.equal(findBrandInText('KRUVASAN 55G7DAYS'), '7Days');
  });

  test('kısa marka (CP) sadece tam eşleşmeyle bulunur', () => {
    assert.equal(findBrandInText('CP SOSİS 500G'), 'CP');
  });

  test('marka satırın herhangi bir yerinde olabilir', () => {
    assert.equal(findBrandInText('MİLKTEN 200G KAYMAK'), 'Milkten');
    assert.equal(findBrandInText('TODAY WAFFLE 252G'), 'Today');
    assert.equal(findBrandInText('XROLL ÇILEKL 142G'), 'Xroll');
  });

  test('bulanık eşleşme: OCR hatasıyla bozulmuş uzun marka adını yakalar', () => {
    // "KIZTILAY" -> "KIZILAY" (Kızılay), tek harf ekleme hatası, ayraçsız bitişik metin
    assert.equal(findBrandInText('MANGOANA6X200KIZTILAY %08'), 'Kızılay');
  });

  test('marka yoksa null döner', () => {
    assert.equal(findBrandInText('EKMEK TAM BUGDAY'), null);
    assert.equal(findBrandInText('AYRAN'), null);
    assert.equal(findBrandInText('MEZE RUS SALATASI'), null);
  });

  test('kısa markalarda (<6 karakter) yanlış pozitif üretmez — regresyon kilidi', () => {
    // "EKMEK" bulanık eşleşmeyle "Eker"e, "AYRAN" "Aytaç"a yanlışlıkla eşleşiyordu
    assert.equal(findBrandInText('EKMEK TAM BUGDAY'), null);
    assert.equal(findBrandInText('AYRAN'), null);
  });

  test('kısa marka kelime sınırı olmadan başka kelimenin içinde eşleşmez — regresyon kilidi', () => {
    // "Sek" -> ŞEKER/EKSEK, "Tat" -> PATATES/SALATA/TATLI içinde yanlışlıkla eşleşiyordu
    assert.equal(findBrandInText('PATATES 1KG'), null);
    assert.equal(findBrandInText('TOZ SEKER 1KG'), null);
    assert.equal(findBrandInText('MEZE RUS SALATASI'), null);
  });

  test('kısa marka tam token olarak geçince hâlâ bulunur', () => {
    assert.equal(findBrandInText('SEK SUT 1LT'), 'Sek');
    assert.equal(findBrandInText('TAT SALCA 700G'), 'Tat');
  });

  test('uzunluğa göre öncelik: daha spesifik marka kazanır', () => {
    assert.equal(findBrandInText('PINAR ET SUCUK'), 'Pınar Et');
  });
});
