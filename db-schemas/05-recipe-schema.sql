CREATE TABLE IF NOT EXISTS recipe (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID REFERENCES household(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  instructions  TEXT NOT NULL,
  servings      INT,
  prep_minutes  INT,
  cook_minutes  INT,
  source_url    TEXT,
  created_by    UUID REFERENCES app_user(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipe_ingredient (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id    UUID NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES product(id),
  quantity     NUMERIC(10,3) NOT NULL,
  unit         unit_kind NOT NULL,
  is_optional  BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS recipe_tag (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key  TEXT NOT NULL UNIQUE,
  name_tr TEXT NOT NULL,
  name_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipe_tag_map (
  recipe_id UUID NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
  tag_id    UUID NOT NULL REFERENCES recipe_tag(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, tag_id)
);

CREATE TABLE IF NOT EXISTS recipe_cook_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  recipe_id   UUID NOT NULL REFERENCES recipe(id),
  cooked_by   UUID NOT NULL REFERENCES app_user(id),
  cooked_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
