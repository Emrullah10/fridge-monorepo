-- Şifremi unuttum: 6 haneli kod ile sıfırlama. Kod ASLA düz metin saklanmaz,
-- user_session.refresh_token_hash desenindeki gibi sha256 hash tutulur.
CREATE TABLE IF NOT EXISTS password_reset_token (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  code_hash    TEXT NOT NULL,
  attempts     INT NOT NULL DEFAULT 0,
  consumed_at  TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user
  ON password_reset_token (user_id, created_at DESC);
