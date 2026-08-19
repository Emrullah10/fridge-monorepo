-- storage_kind / household_kind enum'dan TEXT + CHECK'e geçiş.
--
-- NEDEN: migrate.js her .sql dosyasını TEK pool.query() ile gönderiyor;
-- Postgres çok-ifadeli simple query'yi örtük transaction'a sarıyor ve
-- "ALTER TYPE ... ADD VALUE" transaction içinde PG15'te yasak. Yani enum'a
-- değer eklemek bu migrate altyapısında mümkün değil. TEXT + CHECK hem
-- transaction-safe hem de ileride değer eklemek tek satırlık iş.
--
-- Mevcut değerler ('fridge','freezer','pantry','other' /
-- 'home','office','summerhouse','other') aynen korunuyor — storage-suggestion.js
-- ve mobil taraftaki karşılaştırmalar bozulmasın diye.

-- 1) storage_location.kind: enum -> text
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'storage_location'
      AND column_name = 'kind'
      AND udt_name = 'storage_kind'
  ) THEN
    ALTER TABLE storage_location ALTER COLUMN kind DROP DEFAULT;
    ALTER TABLE storage_location ALTER COLUMN kind TYPE TEXT USING kind::TEXT;
    ALTER TABLE storage_location ALTER COLUMN kind SET DEFAULT 'other';
  END IF;
END $$;

-- 2) household.kind: enum -> text
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'household'
      AND column_name = 'kind'
      AND udt_name = 'household_kind'
  ) THEN
    ALTER TABLE household ALTER COLUMN kind DROP DEFAULT;
    ALTER TABLE household ALTER COLUMN kind TYPE TEXT USING kind::TEXT;
    ALTER TABLE household ALTER COLUMN kind SET DEFAULT 'home';
  END IF;
END $$;

-- 3) İzin verilen değerler CHECK ile. Yeni değer eklemek = listeye bir
--    string eklemek. DROP + ADD sırası önemli: idempotent olması için
--    önce varsa düşürülüyor.
ALTER TABLE storage_location DROP CONSTRAINT IF EXISTS chk_storage_location_kind;
ALTER TABLE storage_location ADD CONSTRAINT chk_storage_location_kind CHECK (kind IN (
  'fridge',     -- Buzdolabı
  'freezer',    -- Dondurucu
  'pantry',     -- Kiler
  'cabinet',    -- Mutfak dolabı
  'drawer',     -- Çekmece
  'counter',    -- Tezgah
  'cellar',     -- Depo / bodrum
  'box',        -- Kutu / sandık
  'shelf',      -- Raf
  'wine',       -- Şaraplık
  'medicine',   -- İlaç dolabı
  'balcony',    -- Balkon (TR'de kışın fiilen soğuk depo)
  'garage',     -- Garaj
  'other'
));

ALTER TABLE household DROP CONSTRAINT IF EXISTS chk_household_kind;
ALTER TABLE household ADD CONSTRAINT chk_household_kind CHECK (kind IN (
  'home',        -- Ev
  'office',      -- Ofis
  'summerhouse', -- Yazlık
  'cottage',     -- Dağ evi / bağ evi
  'workshop',    -- Atölye
  'shop',        -- Dükkan
  'dorm',        -- Yurt
  'garage',      -- Garaj
  'boat',        -- Tekne
  'other'
));

-- 4) storage_location.icon: kind'ın ima ettiğinin ötesinde serbest ikon
--    seçimi. NULL = "kind'ın varsayılan ikonunu kullan" (mobil taraftaki
--    storageKindStyle fallback'i). Değer, mobil ikon kataloğundaki
--    anahtardır (örn. 'kitchen_rounded') — backend içeriğe karışmaz,
--    sadece uzunluk sınırı koyar.
ALTER TABLE storage_location ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE storage_location DROP CONSTRAINT IF EXISTS chk_storage_location_icon_len;
ALTER TABLE storage_location ADD CONSTRAINT chk_storage_location_icon_len
  CHECK (icon IS NULL OR char_length(icon) <= 64);

-- 5) Aynı evde aynı isimde iki bölüm olmasın (büyük/küçük harf duyarsız).
CREATE UNIQUE INDEX IF NOT EXISTS uq_storage_location_household_name
  ON storage_location (household_id, lower(name));
