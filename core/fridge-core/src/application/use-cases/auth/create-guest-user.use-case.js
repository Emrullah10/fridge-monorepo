import bcrypt from 'bcryptjs';
import { randomUUID, randomBytes } from 'node:crypto';
import { issueSession } from './issue-session.js';

// Misafir hesap: kayıt duvarı olmadan uygulamayı kullanabilme. email/
// password_hash NOT NULL kısıtına sentetik değerlerle uyulur — çekirdek
// tabloda hiçbir kolon gevşetilmedi (login/delete-account/davet akışlarının
// hiçbiri değişmedi). deviceId ile aynı cihaz tekrar çağırırsa (uygulama
// kapatılıp açıldı, veya 401 sonrası yeniden bağlanıldı) MEVCUT misafir
// döndürülür — veri kaybı olmaz.
const makeCreateGuestUser = ({ userRepo, sessionRepo, tokenService, createHousehold }) => {
  return async ({ deviceId }) => {
    const existing = await userRepo.findByGuestDeviceId(deviceId);
    if (existing) {
      await userRepo.touchLastSeen(existing.id);
      const { accessToken, refreshToken } = await issueSession({ sessionRepo, tokenService }, existing);
      return {
        user: { id: existing.id, email: existing.email, displayName: existing.displayName, isGuest: true },
        accessToken,
        refreshToken,
      };
    }

    const passwordHash = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
    const user = await userRepo.create({
      email: `guest+${randomUUID()}@guest.local`,
      passwordHash,
      displayName: 'Misafir',
      locale: 'tr',
      isGuest: true,
      guestDeviceId: deviceId,
    });

    // Misafir boş bir listeyle karşılanmasın — otomatik bir alan açılır,
    // create-household.use-case.js normal yoldan (features/bölüm seed dahil).
    await createHousehold({ name: 'Evim', kind: 'home', ownerUserId: user.id });

    const { accessToken, refreshToken } = await issueSession({ sessionRepo, tokenService }, user);

    return {
      user: { id: user.id, email: user.email, displayName: user.displayName, isGuest: true },
      accessToken,
      refreshToken,
    };
  };
};

export { makeCreateGuestUser };
