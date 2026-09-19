-- user_session.refresh_token_hash üzerinde HİÇ index yoktu — her refresh
-- akışı (session.repository.js findActiveByTokenHash) WHERE refresh_token_
-- hash = $1 ile full table scan yapıyordu. Tablo ayrıca revoke edilen
-- satırları hiç SİLMİYOR (sadece revoked_at set ediliyor), bu yüzden 30
-- günlük refresh + her yenilemede yeni satır ile sürekli büyüyor — index
-- eksikliğinin etkisi zamanla artan bir yavaşlama (bkz. plan §Faz 0).
--
-- Kısmi index (WHERE revoked_at IS NULL): aktif oturum aramaları (asıl sıcak
-- yol) küçük ve hızlı kalır, revoke edilmiş/süresi geçmiş eski satırlar
-- index'i şişirmez — findActiveByTokenHash zaten revoked_at IS NULL AND
-- expires_at > now() filtreliyor, index bu deseni birebir kapsıyor.
CREATE INDEX IF NOT EXISTS idx_user_session_active_refresh_hash
  ON user_session (refresh_token_hash)
  WHERE revoked_at IS NULL;
