import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { extractMerchantFromRawText } from '../../../src/infrastructure/parser/turkish-merchants.js';

describe('extractMerchantFromRawText', () => {
  test('fişin başındaki market adını bulur', () => {
    assert.equal(extractMerchantFromRawText('MIGROS TICARET A.S.\nSÜT 1LT *32,50\nTOPLAM 32,50'), 'Migros');
    assert.equal(extractMerchantFromRawText('ŞOK MARKETLER TIC. A.S.\nEKMEK *5,00'), 'Şok');
    assert.equal(extractMerchantFromRawText('BIM BIRLESIK MAGAZALAR\nDOMATES 1KG'), 'BİM');
  });

  test('OCR bozulmalı varyantları bulanık eşleşmeyle yakalar', () => {
    assert.equal(extractMerchantFromRawText('M1GROS TICARET\nSÜT *32,50'), 'Migros');
  });

  test('market adı yoksa null döner', () => {
    assert.equal(extractMerchantFromRawText('SÜT 1LT *32,50\nDOMATES 1KG *18,90\nTOPLAM 51,40'), null);
  });

  test('boş/undefined metin için null döner — çökmemeli', () => {
    assert.equal(extractMerchantFromRawText(''), null);
    assert.equal(extractMerchantFromRawText(null), null);
    assert.equal(extractMerchantFromRawText(undefined), null);
  });

  test('yanlış pozitif üretmez: rastgele ürün satırları market ismine benzemez', () => {
    assert.equal(extractMerchantFromRawText('KRUVASAN 55G7DAYS\nAYRAN 250ML'), null);
  });
});
