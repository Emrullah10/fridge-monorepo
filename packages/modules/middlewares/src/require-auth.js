import { UnauthorizedError } from '@fridge/errors';

const requireAuth = () => (req, res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError('Oturum açman gerekiyor'));
  }
  return next();
};

export { requireAuth };
