-- Abonelik/kota/deneme altyapısı (bkz. plan: ~/.claude/plans/imdi-deneme-taraf-nda-uygulaman-n-rippling-river.md).
-- Enum yerine TEXT + CHECK (cerebrum kuralı — migrate.js transaction'sız
-- çalıştığı için ALTER TYPE ... ADD VALUE migration'ları kırılıyor).

-- 14 günlük ters deneme: kayıt (register/upgrade) anında başlar, veri
-- kaybı olmadan ücretsiz kademeye düşer. trial_device_id aynı cihazın
-- ikinci kez deneme almasını önler (uygulama silinip kurulsa bile).
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS trial_ends_at    TIMESTAMPTZ;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS trial_device_id  TEXT;

CREATE TABLE IF NOT EXISTS subscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES app_user(id) ON DELETE CASCADE,
  store TEXT NOT NULL CHECK (store IN ('play','app_store','promo')),
  product_id TEXT NOT NULL,
  purchase_token TEXT UNIQUE,          -- Play token / RevenueCat transaction id
  rc_app_user_id TEXT,                 -- RevenueCat app_user_id == bizim user.id
  status TEXT NOT NULL CHECK (status IN
    ('pending','active','in_grace','on_hold','paused','canceled','expired','revoked')),
  auto_renewing BOOLEAN NOT NULL DEFAULT true,
  current_period_end TIMESTAMPTZ,      -- İPTAL EDİLSE BİLE bu tarihe kadar erişim açık kalır
  canceled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  environment TEXT NOT NULL DEFAULT 'production',  -- sandbox testleri prod'u kirletmesin
  last_event_at TIMESTAMPTZ,           -- sırası bozulan/tekrar gelen webhook koruması
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscription_expiry ON subscription (status, current_period_end);

-- Aylık kullanım sayaçları — dönem = takvim ayı, Europe/Istanbul (istemci
-- saatine asla güvenilmez). Atomik artırım: INSERT ... ON CONFLICT DO UPDATE.
CREATE TABLE IF NOT EXISTS usage_counter (
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK (feature IN ('receipt','recipe','chef','shopping')),
  period_start DATE NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, feature, period_start)
);

-- Rezervasyon: asenkron fiş işleme kotayı İSTEK ANINDA ayırır (Gemini
-- sonuçlanmadan önce), terminal hata/0-ürün durumunda İADE edilir. ref_id
-- (scanId/chefMessageId/requestId) idempotency sağlar — mobil retry veya
-- receipts/:scanId/retry aynı ref_id'yi kullandığı için ikinci kez yakmaz.
CREATE TABLE IF NOT EXISTS usage_reservation (
  ref_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  period_start DATE NOT NULL,
  released BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Webhook idempotency + denetim izi — RevenueCat/Play bildirimi sırası
-- bozulabilir veya tekrar gelebilir, event_id PK bunu tek seferliğe indirger.
CREATE TABLE IF NOT EXISTS billing_event (
  event_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB
);
