CREATE TABLE IF NOT EXISTS app_user (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  locale        TEXT NOT NULL DEFAULT 'tr',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS household (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                          TEXT NOT NULL,
  kind                          household_kind NOT NULL DEFAULT 'home',
  created_by                    UUID NOT NULL REFERENCES app_user(id),
  receipt_image_retention_days  INT DEFAULT 365,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS household_member (
  household_id UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  role         household_role NOT NULL DEFAULT 'member',
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);

CREATE TABLE IF NOT EXISTS household_invite (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  code           TEXT NOT NULL UNIQUE,
  invited_email  TEXT,
  invited_by     UUID NOT NULL REFERENCES app_user(id),
  status         invite_status NOT NULL DEFAULT 'pending',
  expires_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_session (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  revoked_at        TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Var olan kurulumlar için: household.kind sonradan eklendi (2026-08-18).
-- migrate.js tracking tablosu kullanmadığı için bu blok her çalıştırmada
-- yeniden koşar; IF NOT EXISTS sayesinde no-op olur.
ALTER TABLE household ADD COLUMN IF NOT EXISTS kind household_kind NOT NULL DEFAULT 'home';
