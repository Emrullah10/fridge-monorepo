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
    // gemini-text sağlayıcısı key'siz sessizce boot ediyordu, her tarama
    // runtime'da 400 ile patlıyordu. rule-based fallback key gerektirmiyor,
    // bu yüzden sadece gemini-text seçiliyken zorunlu kılınıyor.
    const parserProvider = env.PARSER_PROVIDER || 'gemini-text';
    if (parserProvider === 'gemini-text' && !env.GEMINI_API_KEY) {
      missing.push('GEMINI_API_KEY');
    }
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
    parserProvider: env.PARSER_PROVIDER || 'gemini-text',
    geminiApiKey: env.GEMINI_API_KEY,
    geminiModel: env.GEMINI_MODEL || 'gemini-2.5-flash',
    scanWorkerIntervalMs: Number(env.SCAN_WORKER_INTERVAL_MS || 5000),
    retentionCleanupIntervalMs: Number(env.RETENTION_CLEANUP_INTERVAL_MS || 24 * 60 * 60 * 1000),
    // FCM_ENABLED=true olsa bile kimlik bilgisi eksikse container no-op
    // adaptöre düşer — push'un yokluğu hiçbir isteği asla 500'e düşürmemeli.
    fcmEnabled: env.FCM_ENABLED === 'true',
    fcmServiceAccountPath: env.FCM_SERVICE_ACCOUNT_PATH,
    fcmServiceAccountBase64: env.FCM_SERVICE_ACCOUNT_BASE64,
    fcmProjectId: env.FCM_PROJECT_ID,
  };
};

export { readEnv };
