import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const makeTokenService = ({ accessSecret, refreshSecret }) => {
  return {
    signAccessToken: ({ userId }) => jwt.sign({ userId }, accessSecret, { expiresIn: ACCESS_TOKEN_TTL }),

    signRefreshToken: ({ userId }) => jwt.sign({ userId }, refreshSecret, { expiresIn: REFRESH_TOKEN_TTL }),

    verifyAccessToken: (token) => jwt.verify(token, accessSecret),

    verifyRefreshToken: (token) => jwt.verify(token, refreshSecret),

    hashRefreshToken: (token) => crypto.createHash('sha256').update(token).digest('hex'),

    refreshTokenExpiryDate: () => new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  };
};

export { makeTokenService };
