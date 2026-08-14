CREATE TABLE IF NOT EXISTS receipt_scan (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id           UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  uploaded_by            UUID NOT NULL REFERENCES app_user(id),
  status                 scan_status NOT NULL DEFAULT 'uploaded',
  error_message          TEXT,
  merchant_name          TEXT,
  purchased_at           TIMESTAMPTZ,
  total_amount           NUMERIC(10,2),
  currency               TEXT DEFAULT 'TRY',

  image_path             TEXT,
  image_bytes            INT,
  image_sha256           TEXT,
  image_deleted_at       TIMESTAMPTZ,

  raw_text               TEXT,
  ocr_provider           TEXT,
  parser_provider        TEXT,
  parser_model           TEXT,

  attempt_count          INT NOT NULL DEFAULT 0,
  processing_started_at  TIMESTAMPTZ,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS receipt_line_item (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_scan_id          UUID NOT NULL REFERENCES receipt_scan(id) ON DELETE CASCADE,
  household_id             UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  line_no                  INT NOT NULL,
  raw_text                 TEXT NOT NULL,
  parsed_name              TEXT,
  parsed_quantity          NUMERIC(10,3),
  parsed_unit              unit_kind,
  parsed_price             NUMERIC(10,2),
  matched_product_id       UUID REFERENCES product(id),
  confidence                NUMERIC(4,3),
  match_method             match_method,
  status                   line_item_status NOT NULL DEFAULT 'pending',
  resolved_inventory_item_id UUID REFERENCES inventory_item(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ADD CONSTRAINT IF NOT EXISTS diye bir şey yok Postgres'te; migrate.js her
-- dosyayı tekrar tekrar çalıştırılabilir (idempotent) varsaydığı için bu
-- DO bloğu olmadan ikinci "npm run db:migrate" komple düşerdi.
DO $$ BEGIN
  ALTER TABLE stock_movement
    ADD CONSTRAINT fk_stock_movement_receipt_line_item
    FOREIGN KEY (receipt_line_item_id) REFERENCES receipt_line_item(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
