import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { detectImageExtension } from '../../../services/fridge-api/routes/receipt.routes.js';

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('detectImageExtension — magic byte doğrulaması (güvenlik regresyon testi)', () => {
  test('JPEG magic byte -> jpg', () => {
    assert.equal(detectImageExtension(JPEG_MAGIC), 'jpg');
  });

  test('PNG magic byte -> png', () => {
    assert.equal(detectImageExtension(PNG_MAGIC), 'png');
  });

  test('rastgele/kötü amaçlı bir buffer null döner (örn. bir HTML/script dosyası)', () => {
    const fakeHtml = Buffer.from('<script>alert(1)</script>');
    assert.equal(detectImageExtension(fakeHtml), null);
  });

  test('originalname alanı artık hiç kullanılmıyor — uzantı yalnızca içerikten türetilir. '
    + 'Path traversal karakterleri içeren bir dosya adı magic byte doğru olsa bile zararsızdır.', () => {
    // Bu test aslında route seviyesinde davranışı belgeliyor: dosya adı
    // detectImageExtension'a hiç parametre olarak geçmiyor (bkz. receipt.routes.js
    // "req.file.originalname" artık extension türetiminde kullanılmıyor).
    assert.equal(detectImageExtension(JPEG_MAGIC), 'jpg', 'yalnızca buffer içeriği önemli');
  });

  test('çok kısa/boş buffer null döner, exception fırlatmaz', () => {
    assert.equal(detectImageExtension(Buffer.from([])), null);
    assert.equal(detectImageExtension(Buffer.from([0xff])), null);
  });
});
