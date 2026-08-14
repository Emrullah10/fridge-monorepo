const REQUIRED_KEYS = ['DATABASE_URL'];

const readEnv = (env = process.env) => {
  const missing = REQUIRED_KEYS.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  return {
    nodeEnv: env.NODE_ENV || 'development',
    port: Number(env.PORT || 4000),
    databaseUrl: env.DATABASE_URL,
    jwtAccessSecret: env.JWT_ACCESS_SECRET || 'dev-access-secret',
    jwtRefreshSecret: env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    uploadsDir: env.UPLOADS_DIR || 'uploads',
    ocrProvider: env.OCR_PROVIDER || 'tesseract',
    parserProvider: env.PARSER_PROVIDER || 'ollama-text',
    ollamaBaseUrl: env.OLLAMA_BASE_URL || 'http://localhost:11434',
    ollamaModel: env.OLLAMA_MODEL || 'llama3.1:8b',
    scanWorkerIntervalMs: Number(env.SCAN_WORKER_INTERVAL_MS || 5000),
    retentionCleanupCron: env.RETENTION_CLEANUP_CRON || '0 3 * * *',
  };
};

export { readEnv };
