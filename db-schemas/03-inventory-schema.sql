CREATE TABLE IF NOT EXISTS storage_location (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  kind         storage_kind NOT NULL DEFAULT 'other',
  sort_order   INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventory_item (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  storage_location_id UUID NOT NULL REFERENCES storage_location(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES product(id),
  quantity            NUMERIC(10,3) NOT NULL DEFAULT 0,
  unit                unit_kind NOT NULL,
  expires_at          DATE,
  opened_at           DATE,
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Standart UNIQUE kısıtı expires_at NULL olduğunda çalışmaz (Postgres'te
-- NULL != NULL). COALESCE ile NULL'ı sabit bir epoch tarihine eşleyip
-- upsert'in son kullanma tarihi girilmemiş kalemlerde de miktarı
-- birleştirmesini sağlıyoruz.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_item_identity
  ON inventory_item (household_id, storage_location_id, product_id, unit, COALESCE(expires_at, '0001-01-01'));

CREATE TABLE IF NOT EXISTS stock_movement (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id         UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  inventory_item_id    UUID NOT NULL REFERENCES inventory_item(id) ON DELETE CASCADE,
  delta                NUMERIC(10,3) NOT NULL,
  reason               stock_change_reason NOT NULL,
  actor_user_id        UUID REFERENCES app_user(id),
  receipt_line_item_id UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
