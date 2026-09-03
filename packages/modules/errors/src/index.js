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

// Gemini 429 (RESOURCE_EXHAUSTED) — kota gerçekten bitti, retry'ın faydası yok.
// httpStatus 503 (kalıcı değil, "şimdilik hizmet veremiyoruz" anlamında) —
// istemci bunu 500 INTERNAL_ERROR'dan ayırt edip farklı bir mesaj gösterebilsin.
class AiQuotaError extends DomainError {
  constructor(message = 'Yapay zeka günlük sınırına ulaşıldı. Yarın tekrar dene.') {
    super(message, { code: 'AI_QUOTA_EXCEEDED', httpStatus: 503 });
  }
}

// Gemini 500/502/503 (geçici aşırı yüklenme) — retry sonrası hâlâ başarısızsa
// buraya düşer.
class AiBusyError extends DomainError {
  constructor(message = 'Yapay zeka şu anda yoğun, birazdan tekrar dene.') {
    super(message, { code: 'AI_BUSY', httpStatus: 503 });
  }
}

// AbortController zaman aşımı (fetch tamamlanamadı) — kota/yoğunluktan ayrı,
// 504 Gateway Timeout kullanıcıya "sunucu değil, işlem uzun sürdü" anlamı verir.
class AiTimeoutError extends DomainError {
  constructor(message = 'İşlem çok uzun sürdü, tekrar dene.') {
    super(message, { code: 'AI_TIMEOUT', httpStatus: 504 });
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
  AiQuotaError,
  AiBusyError,
  AiTimeoutError,
  translateDomainError,
};
