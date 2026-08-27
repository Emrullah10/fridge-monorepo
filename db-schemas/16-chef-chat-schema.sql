-- AI Chef sohbeti — mutfağı bilen sohbet asistanının mesaj geçmişi.
--
-- role: enum DEĞİL TEXT+CHECK (cerebrum: migrate.js transaction içinde
-- ALTER TYPE ADD VALUE yasak, yeni tablo tasarımında baştan TEXT+CHECK).
-- Geçmiş household bazlı tutulur (paylaşılan mutfak), user_id kimin yazdığını
-- işaretler ama sohbet tüm haneye görünür.

CREATE TABLE IF NOT EXISTS chef_chat_message (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES app_user(id) ON DELETE SET NULL,
  role         TEXT NOT NULL,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE chef_chat_message DROP CONSTRAINT IF EXISTS chk_chef_chat_role;
ALTER TABLE chef_chat_message ADD CONSTRAINT chk_chef_chat_role
  CHECK (role IN ('user', 'assistant'));

CREATE INDEX IF NOT EXISTS idx_chef_chat_household_created
  ON chef_chat_message (household_id, created_at);
