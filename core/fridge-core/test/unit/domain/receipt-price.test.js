import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseAmountToken, splitTrailingAmount, attachPrices } from '../../../src/domain/receipt-price.js';
import { isNonProductLine } from '../../../src/domain/receipt-line-filter.js';

describe('receipt-price — parseAmountToken', () => {
  test('virgül ondalık, yıldız ve TL soneki ayrıştırılır', () => {
    assert.equal(parseAmountToken('*9,90'), 9.9);
    assert.equal(parseAmountToken('82,55'), 82.55);
    assert.equal(parseAmountToken('*82,55 TL'), 82.55);
  });
  test('nokta binlik ayraç doğru okunur', () => {
    assert.equal(parseAmountToken('1.234,56'), 1234.56);
  });
  test('fiyat gibi görünmeyen metin null döner', () => {
    assert.equal(parseAmountToken('EKMEK'), null);
    assert.equal(parseAmountToken(''), null);
    assert.equal(parseAmountToken(null), null);
  });
});

describe('receipt-price — splitTrailingAmount', () => {
  test('ürün adı + sondaki tutar ayrılır, ürün adı bozulmaz', () => {
    const { text, price } = splitTrailingAmount('EKMEK *9,90');
    assert.equal(text, 'EKMEK');
    assert.equal(price, 9.9);
  });
  test('sadece ürün adı varsa (fiyat yok) fiyat null, metin aynen kalır', () => {
    const { text, price } = splitTrailingAmount('EKMEK TAM BUGDAY');
    assert.equal(text, 'EKMEK TAM BUGDAY');
    assert.equal(price, null);
  });
});

describe('receipt-price — attachPrices', () => {
  test('ürün ile ayrı satırdaki fiyatı eşler', () => {
    const rawLines = ['EKMEK', '*9,90', 'SUT 1L', '*32,50'];
    const { takePrice } = attachPrices(rawLines, isNonProductLine);
    assert.equal(takePrice('EKMEK'), 9.9);
    assert.equal(takePrice('SUT 1L'), 32.5);
  });

  test('aynı satırdaki fiyat (birleşik) de yakalanır', () => {
    const rawLines = ['EKMEK *9,90'];
    const { takePrice } = attachPrices(rawLines, isNonProductLine);
    assert.equal(takePrice('EKMEK'), 9.9);
  });

  test('çarpım/birim-fiyat ipucu satırı ("2 X 16,25") fiyat olarak alınmaz, sonraki satır toplamı alınır', () => {
    const rawLines = ['SUT 1L', '2 X 16,25', '*32,50'];
    const { takePrice } = attachPrices(rawLines, isNonProductLine);
    assert.equal(takePrice('SUT 1L'), 32.5);
  });

  test('fiş altbilgisine (TOPLAM) gelince tarama durur — altbilgi tutarı ürün fiyatı sayılmaz', () => {
    const rawLines = ['EKMEK', 'TOPLAM 9,90'];
    const { takePrice } = attachPrices(rawLines, isNonProductLine);
    assert.equal(takePrice('EKMEK'), null);
  });

  test('birebir aynı metinli iki gerçek satır kuyruktan sırayla farklı fiyat alabilir', () => {
    const rawLines = ['EKMEK', '*9,90', 'EKMEK', '*8,50'];
    const { takePrice } = attachPrices(rawLines, isNonProductLine);
    assert.equal(takePrice('EKMEK'), 9.9);
    assert.equal(takePrice('EKMEK'), 8.5);
    assert.equal(takePrice('EKMEK'), null);
  });

  test('fiyat hiç bulunamayan ürün null döner (OCR kaçırmış), sessizce 0 kabul edilmez', () => {
    const rawLines = ['EKMEK', 'SUT 1L', '*32,50'];
    const { takePrice } = attachPrices(rawLines, isNonProductLine);
    assert.equal(takePrice('EKMEK'), null);
  });
});
