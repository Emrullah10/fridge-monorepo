CREATE TABLE IF NOT EXISTS product_category (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL UNIQUE,
  parent_id  UUID REFERENCES product_category(id),
  name_tr    TEXT NOT NULL,
  name_en    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID REFERENCES household(id) ON DELETE CASCADE,
  canonical_name  TEXT NOT NULL,
  category_id     UUID REFERENCES product_category(id),
  default_unit    unit_kind NOT NULL DEFAULT 'piece',
  is_global       BOOLEAN NOT NULL DEFAULT false,
  source          product_source NOT NULL DEFAULT 'user',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_alias (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id      UUID REFERENCES household(id) ON DELETE CASCADE,
  raw_text          TEXT NOT NULL,
  normalized_text   TEXT NOT NULL,
  product_id        UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  source            alias_source NOT NULL DEFAULT 'user_correction',
  confidence        NUMERIC(4,3) NOT NULL DEFAULT 1.0,
  hit_count         INT NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
