-- stock_movement.product_id denormalizasyonu.
--
-- NEDEN: stock_movement.inventory_item_id FK'si ON DELETE CASCADE idi.
-- Bir envanter kalemi silindiğinde (tüketildi, hata düzeltmesi vb.) o
-- ürünün tüm tüketim geçmişi de kayboluyordu. Alışveriş listesi AI
-- önerileri (tüketim ritmi tahmini) bu geçmişe dayanıyor ve geriye dönük
-- veri üretilemez — bu yüzden product_id'yi denormalize edip FK'yi
-- SET NULL'a çeviriyoruz: envanter kalemi silinse bile hangi ürünün
-- tüketildiği bilgisi kalıcı olsun.

ALTER TABLE stock_movement ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES product(id);

-- Backfill: mevcut hareketler için product_id'yi envanterden çek.
-- inventory_item_id CASCADE ile silinmiş satırlarda inv bulunamaz, NULL kalır.
UPDATE stock_movement sm
SET product_id = inv.product_id
FROM inventory_item inv
WHERE inv.id = sm.inventory_item_id
  AND sm.product_id IS NULL;

-- FK'yi SET NULL'a çevir (önce NOT NULL kısıtı kalkmalı).
ALTER TABLE stock_movement ALTER COLUMN inventory_item_id DROP NOT NULL;
ALTER TABLE stock_movement DROP CONSTRAINT IF EXISTS stock_movement_inventory_item_id_fkey;
ALTER TABLE stock_movement
  ADD CONSTRAINT stock_movement_inventory_item_id_fkey
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_item(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movement_product
  ON stock_movement (household_id, product_id, created_at DESC);
