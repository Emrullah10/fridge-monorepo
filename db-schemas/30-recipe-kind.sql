-- recipe.kind: AI Asistan genellemesi -- tarif altyapısı artık yemek
-- dışında görev/kılavuz (task) da üretebiliyor (bkz. plan §A3, §C7).
-- DEFAULT 'food' mevcut satırları doğru işaretler, backfill gerekmez --
-- generated_by TEXT NOT NULL DEFAULT 'user' (11-recipe-extras-schema.sql)
-- ile aynı desen.

ALTER TABLE recipe ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'food';

ALTER TABLE recipe DROP CONSTRAINT IF EXISTS chk_recipe_kind;
ALTER TABLE recipe ADD CONSTRAINT chk_recipe_kind CHECK (kind IN ('food', 'task'));

CREATE INDEX IF NOT EXISTS idx_recipe_household_kind
  ON recipe (household_id, kind);
