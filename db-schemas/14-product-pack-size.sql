-- Çoklu paket ürünlerin ("6X200ML Kızılay") gerçek paket boyutunu ayrı
-- kolonlarda saklar. Önceki davranış: 6 adet x 200 ml'yi "1200 milliliter"
-- tek kalem olarak yutuyordu (bkz. line-item-finalizer.js parseMultipack).
--
-- pack_size/pack_unit product'ta KALICI (ürünün değişmez SKU özelliği —
-- "200ml Kızılay" ile "500ml Kızılay" farklı üründür, tıpkı default_unit
-- gibi), receipt_line_item'da ise GEÇİCİ (onay öncesi kullanıcı düzeltebilsin,
-- ürün henüz yaratılmamış/eşleşmemiş olabilir — parsed_name/parsed_brand ile
-- aynı ikili-yazma deseni, bkz. correct-line-item.use-case.js).
--
-- inventory_item'a EKLENMEDİ: quantity/unit zaten doğru adet sayısını taşıyor
-- (quantity=6, unit='piece'), paket boyutu product JOIN'i ile okunur —
-- uq_inventory_item_identity UNIQUE index'ine dokunmaya gerek yok.
ALTER TABLE product ADD COLUMN IF NOT EXISTS pack_size NUMERIC(10,3);
ALTER TABLE product ADD COLUMN IF NOT EXISTS pack_unit unit_kind;

ALTER TABLE receipt_line_item ADD COLUMN IF NOT EXISTS parsed_pack_size NUMERIC(10,3);
ALTER TABLE receipt_line_item ADD COLUMN IF NOT EXISTS parsed_pack_unit unit_kind;

-- Boyut ve birim ya birlikte dolu ya birlikte boş olmalı.
ALTER TABLE product DROP CONSTRAINT IF EXISTS product_pack_consistency;
ALTER TABLE product ADD CONSTRAINT product_pack_consistency
  CHECK ((pack_size IS NULL) = (pack_unit IS NULL));

ALTER TABLE receipt_line_item DROP CONSTRAINT IF EXISTS receipt_line_item_pack_consistency;
ALTER TABLE receipt_line_item ADD CONSTRAINT receipt_line_item_pack_consistency
  CHECK ((parsed_pack_size IS NULL) = (parsed_pack_unit IS NULL));
