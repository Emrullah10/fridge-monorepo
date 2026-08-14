const REQUIRED_KEYS = ['DATABASE_URL'];
// Production'da bu ikisi de zorunlu — sessiz fallback'e izin verilirse
// secret unutulduğunda herkes geçerli token üretebilir hale gelir.
const REQUIRED_IN_PRODUCTION_KEYS = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

const readEnv = (env = process.env) => {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  const missing = REQUIRED_KEYS.filter((key) => !env[key]);
  if (isProduction) {
    missing.push(...REQUIRED_IN_PRODUCTION_KEYS.filter((key) => !env[key]));
  }
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  return {
    nodeEnv,
    port: Number(env.PORT || 4000),
    databaseUrl: env.DATABASE_URL,
    jwtAccessSecret: env.JWT_ACCESS_SECRET || 'dev-access-secret',
    jwtRefreshSecret: env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    uploadsDir: env.UPLOADS_DIR || 'uploads',
    parserProvider: env.PARSER_PROVIDER || 'ollama-text',
    ollamaBaseUrl: env.OLLAMA_BASE_URL || 'http://localhost:11434',
    ollamaModel: env.OLLAMA_MODEL || 'llama3.1:8b',
    scanWorkerIntervalMs: Number(env.SCAN_WORKER_INTERVAL_MS || 5000),
    retentionCleanupIntervalMs: Number(env.RETENTION_CLEANUP_INTERVAL_MS || 24 * 60 * 60 * 1000),
  };
};

export { readEnv };
