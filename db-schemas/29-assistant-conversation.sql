-- AI Asistan (chef -> assistant genellemesi). Sohbetler artık kullanıcıya
-- ait (hane üyeleri birbirininkini görmez), opsiyonel olarak bir alana
-- bağlı (household_id NULL = alansız, AI envanteri görmez). chef_chat_message
-- yerine geçiyor -- geçmiş kullanıcı kararıyla SİLİNDİ (bkz. plan §A2), bu
-- yüzden ALTER zinciri yerine yeni tablo + DROP.
--
-- role/mode: enum DEĞİL TEXT+CHECK (cerebrum: migrate.js transaction içinde
-- ALTER TYPE ADD VALUE yasak, yeni tasarımda baştan TEXT+CHECK, bkz.
-- 07-storage-kind-text.sql deseni).

CREATE TABLE IF NOT EXISTS assistant_conversation (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  household_id UUID REFERENCES household(id) ON DELETE SET NULL,
  title        TEXT,
  mode         TEXT NOT NULL DEFAULT 'general',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE assistant_conversation DROP CONSTRAINT IF EXISTS chk_assistant_conversation_mode;
ALTER TABLE assistant_conversation ADD CONSTRAINT chk_assistant_conversation_mode
  CHECK (mode IN ('food', 'repair', 'general'));

CREATE INDEX IF NOT EXISTS idx_assistant_conversation_user_updated
  ON assistant_conversation (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS assistant_message (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES assistant_conversation(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  parts           JSONB,   -- vision için ayrılmış, bugün NULL
  meta            JSONB,   -- {suggestedShoppingItems, modeMismatch, guide}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE assistant_message DROP CONSTRAINT IF EXISTS chk_assistant_message_role;
ALTER TABLE assistant_message ADD CONSTRAINT chk_assistant_message_role
  CHECK (role IN ('user', 'assistant'));

CREATE INDEX IF NOT EXISTS idx_assistant_message_conversation_created
  ON assistant_message (conversation_id, created_at);

DROP TABLE IF EXISTS chef_chat_message;
