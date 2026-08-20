-- Davet kodu: tek kullanımlıktan alana-sabit, çok kullanımlı koda geçiş.
--
-- NEDEN: Eskiden her davet dialogu açılışında yeni kod üretiliyordu
-- (create-invite.use-case.js koşulsuz insert atıyordu) ve kod bir kişi
-- katılınca tükeniyordu (accept-invite.use-case.js status='accepted'
-- yazıyordu) — kullanıcı "kodum her tıklamada değişiyor" diye şikayet etti.
-- Artık alan başına tek bir "paylaşımlı" kod var: dialog her açıldığında
-- aynı kod döner, birden fazla kişi aynı kodla katılabilir, süresi
-- (is_shared=true satırlarda) NULL = süresiz olabilir ya da elle
-- ayarlanabilir. "Kodu yenile" eskisini revoked yapıp yenisini üretir.
--
-- expires_at NOT NULL kısıtı kaldırılıyor: NULL artık geçerli bir durum
-- (süresiz), migrate.js transaction-safe DDL istiyor (ALTER TYPE ADD VALUE
-- yasak olduğu gibi burada da basit ALTER COLUMN kullanılıyor, sorun yok).

ALTER TABLE household_invite ALTER COLUMN expires_at DROP NOT NULL;

ALTER TABLE household_invite ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false;

-- Bir alanda aynı anda en fazla bir aktif (pending + is_shared) kod olsun —
-- create-invite.use-case.js bunu bulup döndürüyor, bulamazsa üretiyor.
CREATE UNIQUE INDEX IF NOT EXISTS uq_household_invite_active_shared
  ON household_invite (household_id)
  WHERE is_shared AND status = 'pending';
