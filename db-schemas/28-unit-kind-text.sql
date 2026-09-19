-- unit_kind enum'dan TEXT + CHECK'e geçiş.
--
-- NEDEN: 07-storage-kind-text.sql ile aynı gerekçe — migrate.js her .sql'i
-- tek pool.query() ile gönderiyor, "ALTER TYPE ... ADD VALUE" transaction
-- içinde yasak. unit_kind o geçişte atlanmıştı; şimdi tamir/bakım
-- malzemeleri için metre/santimetre/metrekare eklemek gerekiyor, aynı
-- deseni izliyoruz.
--
-- Mevcut değerler ('piece','gram','kilogram','milliliter','liter','package')
-- aynen korunuyor — nutrition.js GRAM_UNITS/ML_UNITS haritaları, mobil
-- unit_label.dart ve ingredient-match.js string karşılaştırması bozulmasın.
--
-- unit_kind kullanan 7 kolon: recipe_ingredient.unit, product.default_unit,
-- receipt_line_item.parsed_unit, inventory_item.unit, shopping_list_item.unit,
-- product.pack_unit, receipt_line_item.parsed_pack_unit.

-- 1) recipe_ingredient.unit
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recipe_ingredient' AND column_name = 'unit' AND udt_name = 'unit_kind'
  ) THEN
    ALTER TABLE recipe_ingredient ALTER COLUMN unit TYPE TEXT USING unit::TEXT;
  END IF;
END $$;

-- 2) product.default_unit
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product' AND column_name = 'default_unit' AND udt_name = 'unit_kind'
  ) THEN
    ALTER TABLE product ALTER COLUMN default_unit DROP DEFAULT;
    ALTER TABLE product ALTER COLUMN default_unit TYPE TEXT USING default_unit::TEXT;
    ALTER TABLE product ALTER COLUMN default_unit SET DEFAULT 'piece';
  END IF;
END $$;

-- 3) receipt_line_item.parsed_unit
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receipt_line_item' AND column_name = 'parsed_unit' AND udt_name = 'unit_kind'
  ) THEN
    ALTER TABLE receipt_line_item ALTER COLUMN parsed_unit TYPE TEXT USING parsed_unit::TEXT;
  END IF;
END $$;

-- 4) inventory_item.unit
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_item' AND column_name = 'unit' AND udt_name = 'unit_kind'
  ) THEN
    ALTER TABLE inventory_item ALTER COLUMN unit TYPE TEXT USING unit::TEXT;
  END IF;
END $$;

-- 5) shopping_list_item.unit
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopping_list_item' AND column_name = 'unit' AND udt_name = 'unit_kind'
  ) THEN
    ALTER TABLE shopping_list_item ALTER COLUMN unit DROP DEFAULT;
    ALTER TABLE shopping_list_item ALTER COLUMN unit TYPE TEXT USING unit::TEXT;
    ALTER TABLE shopping_list_item ALTER COLUMN unit SET DEFAULT 'piece';
  END IF;
END $$;

-- 6) product.pack_unit
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product' AND column_name = 'pack_unit' AND udt_name = 'unit_kind'
  ) THEN
    ALTER TABLE product ALTER COLUMN pack_unit TYPE TEXT USING pack_unit::TEXT;
  END IF;
END $$;

-- 7) receipt_line_item.parsed_pack_unit
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receipt_line_item' AND column_name = 'parsed_pack_unit' AND udt_name = 'unit_kind'
  ) THEN
    ALTER TABLE receipt_line_item ALTER COLUMN parsed_pack_unit TYPE TEXT USING parsed_pack_unit::TEXT;
  END IF;
END $$;

-- 8) İzin verilen değerler CHECK ile, her kolon için ayrı (DROP + ADD,
--    idempotent). Yeni birimler: meter, centimeter, square_meter — tamir/
--    bakım malzemeleri için (ör. "3 metre kablo", "2 m² fayans").
ALTER TABLE recipe_ingredient DROP CONSTRAINT IF EXISTS chk_recipe_ingredient_unit;
ALTER TABLE recipe_ingredient ADD CONSTRAINT chk_recipe_ingredient_unit CHECK (unit IN (
  'piece', 'gram', 'kilogram', 'milliliter', 'liter', 'package',
  'meter', 'centimeter', 'square_meter'
));

ALTER TABLE product DROP CONSTRAINT IF EXISTS chk_product_default_unit;
ALTER TABLE product ADD CONSTRAINT chk_product_default_unit CHECK (default_unit IN (
  'piece', 'gram', 'kilogram', 'milliliter', 'liter', 'package',
  'meter', 'centimeter', 'square_meter'
));

ALTER TABLE product DROP CONSTRAINT IF EXISTS chk_product_pack_unit;
ALTER TABLE product ADD CONSTRAINT chk_product_pack_unit CHECK (pack_unit IS NULL OR pack_unit IN (
  'piece', 'gram', 'kilogram', 'milliliter', 'liter', 'package',
  'meter', 'centimeter', 'square_meter'
));

ALTER TABLE receipt_line_item DROP CONSTRAINT IF EXISTS chk_receipt_line_item_parsed_unit;
ALTER TABLE receipt_line_item ADD CONSTRAINT chk_receipt_line_item_parsed_unit CHECK (parsed_unit IS NULL OR parsed_unit IN (
  'piece', 'gram', 'kilogram', 'milliliter', 'liter', 'package',
  'meter', 'centimeter', 'square_meter'
));

ALTER TABLE receipt_line_item DROP CONSTRAINT IF EXISTS chk_receipt_line_item_parsed_pack_unit;
ALTER TABLE receipt_line_item ADD CONSTRAINT chk_receipt_line_item_parsed_pack_unit CHECK (parsed_pack_unit IS NULL OR parsed_pack_unit IN (
  'piece', 'gram', 'kilogram', 'milliliter', 'liter', 'package',
  'meter', 'centimeter', 'square_meter'
));

ALTER TABLE inventory_item DROP CONSTRAINT IF EXISTS chk_inventory_item_unit;
ALTER TABLE inventory_item ADD CONSTRAINT chk_inventory_item_unit CHECK (unit IN (
  'piece', 'gram', 'kilogram', 'milliliter', 'liter', 'package',
  'meter', 'centimeter', 'square_meter'
));

ALTER TABLE shopping_list_item DROP CONSTRAINT IF EXISTS chk_shopping_list_item_unit;
ALTER TABLE shopping_list_item ADD CONSTRAINT chk_shopping_list_item_unit CHECK (unit IN (
  'piece', 'gram', 'kilogram', 'milliliter', 'liter', 'package',
  'meter', 'centimeter', 'square_meter'
));
