import { ConflictError, ValidationError, NotFoundError } from '@fridge/errors';

class EmailAlreadyRegisteredError extends ConflictError {
  constructor(email) {
    super('Bu e-posta adresiyle zaten bir hesap var');
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

class LocationNotEmptyError extends ConflictError {
  constructor(itemCount) {
    super('Bu bölümde ürün var, önce ürünleri başka bir bölüme taşı veya sil');
    this.itemCount = itemCount;
  }
}

class LastLocationError extends ValidationError {
  constructor() {
    super('Bir alanda en az bir bölüm olmalı');
  }
}

class OwnerCannotLeaveError extends ValidationError {
  constructor() {
    super('Alan sahibi ayrılamaz — önce sahipliği devret ya da alanı sil');
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
  LocationNotEmptyError,
  LastLocationError,
  OwnerCannotLeaveError,
};
