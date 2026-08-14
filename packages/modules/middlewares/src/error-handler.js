import { translateDomainError } from '@fridge/errors';
import { log } from '@fridge/helper';

const errorHandler = () => (error, req, res, next) => {
  const { httpStatus, body } = translateDomainError(error);
  if (httpStatus === 500) {
    log.error('unhandled_error', { message: error.message, stack: error.stack, path: req.path });
  }
  res.status(httpStatus).json(body);
};

export { errorHandler };
