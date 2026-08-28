import bcrypt from 'bcryptjs';
import { InvalidCredentialsError } from '../../../domain/errors/index.js';
import { issueSession } from './issue-session.js';

const makeLoginUser = ({ userRepo, sessionRepo, tokenService }) => {
  return async ({ email, password }) => {
    const user = await userRepo.findByEmail(email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
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
