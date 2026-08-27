-- Besin değeri & sağlık profili (Faz 3).
--
-- product.nutrition: 100g VEYA 100ml başına değerler, JSONB. Gemini ile ürün
-- oluşturulurken / talep üzerine doldurulur, NULL kalabilir. Ayrı tablo
-- gereksiz — hep ürünle birlikte okunuyor (recipe_ingredient.custom_name /
-- recipe.steps JSONB deseniyle aynı gerekçe).
-- Örnek: {"kcal": 64, "protein": 3.4, "carb": 4.8, "fat": 3.6, "basis": "100ml"}
ALTER TABLE product ADD COLUMN IF NOT EXISTS nutrition JSONB;

-- app_user.diet_profile: profil KULLANICIYA ait, alana değil — kullanıcı
-- birden fazla alanda aynı alerjen/diyet kısıtını taşımalı. NULL = kısıt yok.
-- Örnek: {"allergens": ["fındık", "süt"], "diet": "vegetarian", "dailyKcalTarget": 2000}
-- diet değerleri serbest string (whitelist use-case katmanında) — enum'a
-- bağlamak sonradan değer eklemeyi zorlaştırır (cerebrum: migrate.js + ALTER TYPE).
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS diet_profile JSONB;
