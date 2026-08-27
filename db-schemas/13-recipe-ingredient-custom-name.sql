-- Tarif AI'ı artık eşleşmeyen malzeme için yeni bir product yaratmıyor
-- (generate-ai-recipes.use-case.js) — bu, katalog kirlenme döngüsünü kesmek
-- için: fiş "Kızılay Mangoana" gibi bozuk bir isim üretiyordu, tarif AI'ı bu
-- ismi görüp daha da bozuk bir malzeme adı ("Kızılay Mango Kiz Tilay")
-- yazıyordu, generate-ai-recipes bunu bulamayınca YENİ bir ai_generated ürün
-- yaratıyordu (çoğunlukla kategorisiz) — her tarif üretimi kataloğu biraz
-- daha bozuyordu. Artık eşleşmeyen malzeme serbest metin (custom_name) olarak
-- saklanıyor, product tablosu sadece fiş/kullanıcı tarafından büyüyor.
--
-- shopping_list_item ile birebir aynı desen: product_id nullable + custom_name
-- + CHECK (ikisinden en az biri dolu olmalı).
ALTER TABLE recipe_ingredient ADD COLUMN IF NOT EXISTS custom_name TEXT;
ALTER TABLE recipe_ingredient ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE recipe_ingredient DROP CONSTRAINT IF EXISTS recipe_ingredient_name_check;
ALTER TABLE recipe_ingredient ADD CONSTRAINT recipe_ingredient_name_check
  CHECK (product_id IS NOT NULL OR (custom_name IS NOT NULL AND length(trim(custom_name)) > 0));
