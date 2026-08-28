-- Misafir hesap desteği: kayıt duvarı olmadan uygulamayı kullanabilme.
-- email/password_hash NOT NULL KALIR (register/login/delete-account/davet
-- akışlarının hiçbiri değişmez) — misafire sentetik değerler yazılır
-- (guest+<uuid>@guest.local, rastgele bcrypt hash). Yükseltmede (upgrade)
-- aynı satır UPDATE edilir, is_guest=false olur.
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS guest_device_id TEXT;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Aynı cihaz ikinci kez misafir hesabı açmaya çalışırsa (uygulama silinip
-- yeniden kurulmadıysa) mevcut misafiri döndürmek için — create-guest-user
-- bu index'i kullanarak "bu deviceId için zaten bir misafir var mı" sorgular.
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_user_guest_device
  ON app_user (guest_device_id) WHERE guest_device_id IS NOT NULL;
