-- Bildirim tipleri TEXT + CHECK (enum değil) — 07'deki ile aynı gerekçe:
-- migrate.js altyapısında enum'a değer eklenemiyor, yeni bildirim tipi
-- eklemek sık olacak.
CREATE TABLE IF NOT EXISTS device_token (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,
  platform      TEXT NOT NULL DEFAULT 'android',
  device_id     TEXT,
  locale        TEXT NOT NULL DEFAULT 'tr',
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE device_token DROP CONSTRAINT IF EXISTS chk_device_token_platform;
ALTER TABLE device_token ADD CONSTRAINT chk_device_token_platform
  CHECK (platform IN ('android', 'ios', 'web'));

-- token UNIQUE ve user_id'siz DEĞİL: aynı cihaz başka bir hesaba giriş
-- yaparsa FCM aynı token'ı verir; upsert user_id'yi devreder, böylece
-- eski kullanıcı yeni kullanıcının cihazına bildirim göndermez.

CREATE TABLE IF NOT EXISTS notification (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  household_id  UUID REFERENCES household(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  -- Derin link / ekran yönlendirmesi için serbest payload.
  data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Aynı olayın iki kez yazılmasını engeller (retry/çift tetikleme).
  dedupe_key    TEXT,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_preference (
  user_id       UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  push_enabled  BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, type)
);

-- Tercih satırı YOKSA varsayılan açık — yeni bildirim tipi eklendiğinde
-- herkesin tek tek opt-in etmesi gerekmesin diye (bkz. notification-types.js
-- defaultEnabled).

CREATE INDEX IF NOT EXISTS idx_device_token_user ON device_token (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_user_created
  ON notification (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_user_unread
  ON notification (user_id) WHERE read_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_dedupe
  ON notification (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
