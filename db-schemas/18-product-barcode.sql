-- Barkod ile hızlı ürün ekleme (Faz 4).
--
-- product.barcode: EAN/UPC. Katalogda varsa barkodla anında bulunur; yoksa
-- Open Food Facts'ten çekilip (ücretsiz, anahtarsız) yeni ürün oluşturulur.
-- UNIQUE ama NULL'a izin var (Postgres'te birden fazla NULL UNIQUE'i ihlal
-- etmez) — barkodsuz ürünler (fişten gelen, elle eklenen) sorunsuz.
ALTER TABLE product ADD COLUMN IF NOT EXISTS barcode TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_barcode
  ON product (barcode) WHERE barcode IS NOT NULL;
