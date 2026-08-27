-- Alışveriş listesi. household başına tek "aktif" liste mantığıyla kullanılır
-- (bkz. shopping-list.repository.js getOrCreateActiveList) — is_archived
-- geçmiş listeleri saklamak için var, şu an sadece manuel arşivleme yapılıyor.

CREATE TABLE IF NOT EXISTS shopping_list (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  name          TEXT NOT NULL DEFAULT 'Alışveriş Listesi',
  is_archived   BOOLEAN NOT NULL DEFAULT false,
  created_by    UUID REFERENCES app_user(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- product_id NULL olabilir (kullanıcı serbest metin girer, örn. "poşet");
-- CHECK bu durumda custom_name'in dolu olmasını zorunlu kılar.
CREATE TABLE IF NOT EXISTS shopping_list_item (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_list_id   UUID NOT NULL REFERENCES shopping_list(id) ON DELETE CASCADE,
  product_id         UUID REFERENCES product(id),
  custom_name        TEXT,
  quantity           NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit               unit_kind NOT NULL DEFAULT 'piece',
  is_checked         BOOLEAN NOT NULL DEFAULT false,
  note               TEXT,
  sort_order         INT NOT NULL DEFAULT 0,
  -- TEXT + CHECK, gerçek enum DEĞİL: migrate.js her dosyayı tek transaction
  -- içinde uyguluyor, "ALTER TYPE ... ADD VALUE" transaction içinde PG15'te
  -- yasak (bkz. 07-storage-kind-text.sql). Yeni kaynak eklemek burada tek
  -- satırlık iş kalsın diye baştan TEXT+CHECK.
  source             TEXT NOT NULL DEFAULT 'manual',
  added_by           UUID REFERENCES app_user(id),
  checked_by         UUID REFERENCES app_user(id),
  checked_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shopping_list_item_name_check
    CHECK (product_id IS NOT NULL OR (custom_name IS NOT NULL AND length(trim(custom_name)) > 0))
);

ALTER TABLE shopping_list_item DROP CONSTRAINT IF EXISTS shopping_list_item_source_check;
ALTER TABLE shopping_list_item ADD CONSTRAINT shopping_list_item_source_check
  CHECK (source IN ('manual', 'recipe', 'low_stock', 'receipt', 'ai_suggestion'));

CREATE INDEX IF NOT EXISTS idx_shopping_list_household
  ON shopping_list (household_id, is_archived);

CREATE INDEX IF NOT EXISTS idx_shopping_list_item_list
  ON shopping_list_item (shopping_list_id, is_checked, sort_order);
