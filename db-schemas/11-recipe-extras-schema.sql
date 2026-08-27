-- Tarifler için eksik parçalar: favoriler + adım adım pişirme desteği.

CREATE TABLE IF NOT EXISTS recipe_favorite (
  household_id  UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  recipe_id     UUID NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (recipe_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_favorite_household
  ON recipe_favorite (household_id, user_id);

-- instructions (tek TEXT blob) geriye dönük uyumluluk için kalıyor.
-- steps: AI'ın ürettiği adım adım pişirme dizisi, JSONB — ayrı bir
-- recipe_step tablosu burada gereksiz join maliyeti getirir çünkü hep
-- birlikte okunuyor, tek tek sorgulanmıyor.
-- Örnek içerik: [{"order":1,"text":"Soğanı doğrayın","minutes":5}, ...]
ALTER TABLE recipe ADD COLUMN IF NOT EXISTS steps JSONB;

-- AI tarafından mı üretildi, kullanıcı mı ekledi. Öneri sıralamasında ve
-- UI'da "AI önerisi" rozeti göstermek için.
ALTER TABLE recipe ADD COLUMN IF NOT EXISTS generated_by TEXT NOT NULL DEFAULT 'user';
ALTER TABLE recipe DROP CONSTRAINT IF EXISTS chk_recipe_generated_by;
ALTER TABLE recipe ADD CONSTRAINT chk_recipe_generated_by CHECK (generated_by IN ('user', 'ai'));

-- 05-recipe-schema.sql'de recipe_cook_log.recipe_id CASCADE olmadan tanımlanmıştı
-- (recipe_ingredient/recipe_favorite'in aksine) — bir tarif bir kez pişirildikten
-- sonra bir daha ASLA silinemiyordu (FK ihlali). Kullanıcı artık tarif
-- silebildiği için (DELETE /:recipeId) bu kısıt CASCADE'e taşınıyor;
-- pişirme geçmişi kaybolur ama silme işlemi engellenmemeli.
ALTER TABLE recipe_cook_log DROP CONSTRAINT IF EXISTS recipe_cook_log_recipe_id_fkey;
ALTER TABLE recipe_cook_log ADD CONSTRAINT recipe_cook_log_recipe_id_fkey
  FOREIGN KEY (recipe_id) REFERENCES recipe(id) ON DELETE CASCADE;
