import { UnauthorizedError } from '@fridge/errors';

const requireAuth = () => (req, res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }
  return next();
};

export { requireAuth };
