-- Aile paketi (YouTube Family tarzı grup üyeliği, bkz. plan: aile-plani).
-- Enum yerine TEXT + CHECK (cerebrum kuralı — migrate.js transaction'sız
-- çalıştığı için ALTER TYPE ... ADD VALUE migration'ları kırılıyor, bkz.
-- 23. migration'daki aynı gerekçe).

-- plan_tier: RC ürününün 'individual' mi 'family' mi olduğunu taşır —
-- apply-billing-event.use-case.js productId'den çözüp yazar. seats sadece
-- family'de anlamlı (bireysel abonelikte NULL kalır). Koltuk sayısını
-- uygulama sürümü çıkarmadan değiştirebilmek için PLAN_LIMITS_JSON ile aynı
-- ilkeyle plans.js'te PRODUCT_TIERS_JSON env'i üzerinden ezilebilir tutulur
-- (bu kolon sadece "bu abonelik hangi kademeden alındı" bilgisini saklar).
ALTER TABLE subscription ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'individual'
  CHECK (plan_tier IN ('individual','family'));
ALTER TABLE subscription ADD COLUMN IF NOT EXISTS seats INTEGER;
