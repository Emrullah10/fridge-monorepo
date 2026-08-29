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
    // recipeAiEnabled varsayılan true — bu koşulu unutmak tam olarak
    // parserProvider'da daha önce yaşanan sorunu (key'siz sessiz boot,
    // runtime'da 400) tarif üretiminde de tekrarlardı.
    const recipeAiEnabled = env.RECIPE_AI_ENABLED !== 'false';
    const shoppingAiEnabled = env.SHOPPING_AI_ENABLED !== 'false';
    const chefAiEnabled = env.CHEF_AI_ENABLED !== 'false';
    if ((parserProvider === 'gemini-text' || recipeAiEnabled || shoppingAiEnabled || chefAiEnabled) && !env.GEMINI_API_KEY) {
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
    recipeAiEnabled: env.RECIPE_AI_ENABLED !== 'false',
    geminiRecipeModel: env.GEMINI_RECIPE_MODEL || 'gemini-2.5-flash',
    shoppingAiEnabled: env.SHOPPING_AI_ENABLED !== 'false',
    geminiShoppingModel: env.GEMINI_SHOPPING_MODEL || 'gemini-2.5-flash',
    chefAiEnabled: env.CHEF_AI_ENABLED !== 'false',
    geminiChefModel: env.GEMINI_CHEF_MODEL || 'gemini-2.5-flash',
    scanWorkerIntervalMs: Number(env.SCAN_WORKER_INTERVAL_MS || 5000),
    retentionCleanupIntervalMs: Number(env.RETENTION_CLEANUP_INTERVAL_MS || 24 * 60 * 60 * 1000),
    // FCM_ENABLED=true olsa bile kimlik bilgisi eksikse container no-op
    // adaptöre düşer — push'un yokluğu hiçbir isteği asla 500'e düşürmemeli.
    fcmEnabled: env.FCM_ENABLED === 'true',
    fcmServiceAccountPath: env.FCM_SERVICE_ACCOUNT_PATH,
    fcmServiceAccountBase64: env.FCM_SERVICE_ACCOUNT_BASE64,
    fcmProjectId: env.FCM_PROJECT_ID,
    // RESEND_API_KEY yoksa container no-op mailer'a düşer (fcm ile aynı
    // ilke) — bilinçli olarak REQUIRED_IN_PRODUCTION_KEYS'e eklenmedi,
    // şifremi unuttum'un yokluğu boot'u patlatmamalı.
    resendApiKey: env.RESEND_API_KEY,
    mailFrom: env.MAIL_FROM || 'Fridge <onboarding@resend.dev>',
    passwordResetTtlMinutes: Number(env.PASSWORD_RESET_TTL_MINUTES || 15),
    // Mobil açılışta GET /app-config ile karşılaştırır — buradan kapatılabilir
    // banner ("yeni sürüm var") ya da kapatılamaz zorunlu güncelleme ekranı
    // tetiklenir. Sadece env değişikliği yeterli, yeniden yayın gerekmez.
    appLatestVersion: env.APP_LATEST_VERSION || '1.0.0',
    appMinSupportedVersion: env.APP_MIN_SUPPORTED_VERSION || '1.0.0',
    appStoreUrl: env.APP_STORE_URL || 'https://play.google.com/store/apps/details?id=com.fridge.fridge_mobil',
  };
};

export { readEnv };
