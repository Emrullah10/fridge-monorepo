-- Her Gemini çağrısının kaydı — hangi özelliğin ne kadar token harcadığını,
-- hangi hata kodunun ne sıklıkta geldiğini ölçmek için (bkz. gemini-client.js).
-- Bu tablo olmadan "kaç kullanıcı ne kadar kullanıyor / hangi limit vuruyor /
-- hangi model daha ucuz" sorularının hiçbiri veriyle cevaplanamıyordu.
-- Enum yerine TEXT + CHECK (cerebrum kuralı — migrate.js transaction'sız
-- çalıştığı için ALTER TYPE ... ADD VALUE migration'ları kırılıyor).
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  feature TEXT NOT NULL CHECK (feature IN ('receipt', 'recipe', 'chef', 'shopping')),
  model TEXT NOT NULL,
  user_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  household_id UUID REFERENCES household(id) ON DELETE SET NULL,
  is_guest BOOLEAN NOT NULL DEFAULT false,
  ok BOOLEAN NOT NULL,
  http_status INTEGER,
  error_code TEXT,
  latency_ms INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER,
  output_tokens INTEGER,
  thought_tokens INTEGER,
  total_tokens INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at ON ai_usage_log (created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user_created ON ai_usage_log (user_id, created_at);
