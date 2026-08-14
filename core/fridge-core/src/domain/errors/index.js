import { ConflictError, ValidationError, NotFoundError } from '@fridge/errors';

class EmailAlreadyRegisteredError extends ConflictError {
  constructor(email) {
    super(`Email already registered: ${email}`);
  }
}

class InvalidCredentialsError extends ValidationError {
  constructor() {
    super('Invalid email or password');
  }
}

class InviteExpiredError extends ValidationError {
  constructor() {
    super('Invite code has expired');
  }
}

class InviteAlreadyUsedError extends ValidationError {
  constructor() {
    super('Invite code has already been used');
  }
}

class InsufficientStockError extends ValidationError {
  constructor(productName) {
    super(`Not enough stock to consume: ${productName}`);
  }
}

class ReceiptNotReadyError extends ValidationError {
  constructor(status) {
    super(`Receipt is not ready for this action (status: ${status})`);
  }
}

class HouseholdNotFoundError extends NotFoundError {
  constructor() {
    super('Household not found');
  }
}

export {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InviteExpiredError,
  InviteAlreadyUsedError,
  InsufficientStockError,
  ReceiptNotReadyError,
  HouseholdNotFoundError,
};
