import { ConflictError, ValidationError, NotFoundError } from '@fridge/errors';

class EmailAlreadyRegisteredError extends ConflictError {
  constructor(email) {
    super('Bu e-posta adresiyle zaten bir hesap var');
  }
}

class InvalidCredentialsError extends ValidationError {
  constructor() {
    super('E-posta veya şifre hatalı', { code: 'INVALID_CREDENTIALS' });
  }
}

class InviteExpiredError extends ValidationError {
  constructor() {
    super('Davet kodunun süresi dolmuş', { code: 'INVITE_EXPIRED' });
  }
}

class InviteAlreadyUsedError extends ValidationError {
  constructor() {
    super('Bu davet kodu zaten kullanılmış', { code: 'INVITE_USED' });
  }
}

class InsufficientStockError extends ValidationError {
  constructor(productName) {
    super(`Yeterli stok yok: ${productName}`, { code: 'INSUFFICIENT_STOCK' });
  }
}

class ReceiptNotReadyError extends ValidationError {
  constructor(status) {
    super('Fiş henüz onaylanabilir durumda değil', { code: 'RECEIPT_NOT_READY' });
    this.status = status;
  }
}

class ReceiptAlreadyConfirmedError extends ValidationError {
  constructor() {
    super('Bu fiş zaten dolaba eklenmiş', { code: 'RECEIPT_ALREADY_CONFIRMED' });
  }
}

class InvalidResetCodeError extends ValidationError {
  constructor() {
    super('Doğrulama kodu hatalı veya süresi dolmuş', { code: 'INVALID_RESET_CODE' });
  }
}

class HouseholdNotFoundError extends NotFoundError {
  constructor() {
    super('Alan bulunamadı', { code: 'HOUSEHOLD_NOT_FOUND' });
  }
}

class LocationNotEmptyError extends ConflictError {
  constructor(itemCount) {
    super('Bu bölümde ürün var, önce ürünleri başka bir bölüme taşı veya sil');
    this.itemCount = itemCount;
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
  ReceiptAlreadyConfirmedError,
  InvalidResetCodeError,
  HouseholdNotFoundError,
  LocationNotEmptyError,
  OwnerCannotLeaveError,
};
