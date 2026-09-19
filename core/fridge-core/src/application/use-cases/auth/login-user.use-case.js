import bcrypt from 'bcryptjs';
import { InvalidCredentialsError } from '../../../domain/errors/index.js';
import { issueSession } from './issue-session.js';

// Var olmayan bir e-posta ile geçersiz şifreli mevcut bir hesabın yanıt
// süresi ölçülebilir şekilde farklıydı — kullanıcı bulunamazsa bcrypt.compare
// hiç çalışmadan erken dönülüyordu. Hata mesajları zaten aynı
// (InvalidCredentialsError, enumeration'a karşı doğru), ama zamanlama
// farkı ayrı bir yan kanaldı. DUMMY_HASH'e karşı sahte bir compare çalıştırıp
// iki yolu da bcrypt maliyeti bakımından eşitliyoruz. Hash sabit ve gerçek
// bir şifreye ait değil (bcrypt.hashSync('dummy-password-for-timing', 10)).
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8kf.pT7B2sPbKgggFJvcHqf/HgQpKW';

const makeLoginUser = ({ userRepo, sessionRepo, tokenService }) => {
  return async ({ email, password }) => {
    const user = await userRepo.findByEmail(email);

    const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordMatches) {
      throw new InvalidCredentialsError();
    }

    const { accessToken, refreshToken } = await issueSession({ sessionRepo, tokenService }, user);

    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      accessToken,
      refreshToken,
    };
  };
};

export { makeLoginUser };
