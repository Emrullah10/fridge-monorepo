class DomainError extends Error {
  constructor(message, { code = 'DOMAIN_ERROR', httpStatus = 400 } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

class NotFoundError extends DomainError {
  constructor(message) {
    super(message, { code: 'NOT_FOUND', httpStatus: 404 });
  }
}

class ValidationError extends DomainError {
  constructor(message) {
    super(message, { code: 'VALIDATION_ERROR', httpStatus: 422 });
  }
}

class ConflictError extends DomainError {
  constructor(message) {
    super(message, { code: 'CONFLICT', httpStatus: 409 });
  }
}

class UnauthorizedError extends DomainError {
  constructor(message) {
    super(message, { code: 'UNAUTHORIZED', httpStatus: 401 });
  }
}

class ForbiddenError extends DomainError {
  constructor(message) {
    super(message, { code: 'FORBIDDEN', httpStatus: 403 });
  }
}

const translateDomainError = (error) => {
  if (error instanceof DomainError) {
    return {
      httpStatus: error.httpStatus,
      body: { error: { code: error.code, message: error.message } },
    };
  }

  return {
    httpStatus: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } },
  };
};

export {
  DomainError,
  NotFoundError,
  ValidationError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  translateDomainError,
};
