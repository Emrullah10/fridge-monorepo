import crypto from 'node:crypto';

const CODE_TTL_MINUTES_DEFAULT = 15;

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

// Kayıtlı e-posta olsun olmasın, misafir hesap olsun olmasın: bu use-case
// HER ZAMAN sessizce başarıyla biter. Route her koşulda 204 döner — aksi
// halde yanıt farkı ("e-posta yok" vs "kod gönderildi") saldırgana hangi
// e-postaların kayıtlı olduğunu sızdırır (enumeration).
const makeRequestPasswordReset = ({ userRepo, passwordResetRepo, mailer, ttlMinutes = CODE_TTL_MINUTES_DEFAULT }) => {
  return async ({ email }) => {
    const user = await userRepo.findByEmail(email);
    if (!user || user.isGuest) {
      return;
    }

    await passwordResetRepo.invalidateAllForUser(user.id);

    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    await passwordResetRepo.create({ userId: user.id, codeHash: hashCode(code), expiresAt });

    // Mail gönderimi başarısız olsa bile isteği başarısız SAYMA — enumeration
    // sızdırmamak ve kullanıcıyı ağ/sağlayıcı sorunuyla karşı karşıya
    // bırakmamak için (aynı ilke: fcm servis hesabı eksikse push sessizce
    // no-op'a düşer, hiçbir isteği 500'e düşürmez).
    try {
      await mailer.sendPasswordResetCode({
        to: user.email,
        displayName: user.displayName,
        code,
        ttlMinutes,
      });
    } catch (error) {
      console.error('[request-password-reset] mail gönderimi başarısız:', error);
    }
  };
};

export { makeRequestPasswordReset };
