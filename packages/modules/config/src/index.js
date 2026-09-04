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
    // groq sağlayıcısı seçiliyken aynı sessiz-boot riski GROQ_API_KEY için de
    // geçerli — aynı gerekçe, aynı desen.
    if (parserProvider === 'groq' && !env.GROQ_API_KEY) {
      missing.push('GROQ_API_KEY');
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
    // 2026-08-29 ölçümü: Groq'un ücretsiz katmanı openai/gpt-oss-120b için
    // 1000 istek/gün veriyor (Gemini 2.5 Flash'ın ücretsiz 20/gün'ünün 50
    // katı), kredi kartsız. PARSER_PROVIDER=groq ile fiş ayrıştırma buna
    // yönlendirilebilir — gemini-text ile aynı SYSTEM_PROMPT/finalizeItem
    // zincirini kullanır (bkz. groq-text.adapter.js).
    groqApiKey: env.GROQ_API_KEY,
    groqModel: env.GROQ_MODEL || 'openai/gpt-oss-120b',
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
    // Plan/kota limitlerini uygulama sürümü çıkarmadan ayarlamak için —
    // bkz. domain/plans.js buildPlanLimits(). Kısmi bir JSON objesi
    // (yalnızca değişecek alanlar) yeterli, deep merge edilir. Bozuk JSON
    // sessizce yok sayılır (boot çökmez).
    planLimitsJson: env.PLAN_LIMITS_JSON || null,
    // Aile paketi ürün→kademe/koltuk haritası — bkz. domain/plans.js
    // buildProductTiers(). Aynı ilke: kısmi JSON, deep merge, bozuk JSON
    // sessizce yok sayılır.
    productTiersJson: env.PRODUCT_TIERS_JSON || null,
    // Platform bazlı (Android/iOS) limit ek ezmesi — bkz. domain/plans.js
    // buildPlanLimits() platform parametresi. PLATFORM_LIMITS_JSON=
    // '{"ios":{"free":{"ai":{"receipt":5}}}}' şeklinde platform anahtarı
    // içeren bir üst seviye taşır.
    platformLimitsJson: env.PLATFORM_LIMITS_JSON || null,
    // RevenueCat Dashboard > Webhooks'ta "Authorization Header Value"
    // olarak ayarlanan paylaşılan sır — webhook route'u gelen isteğin
    // Authorization header'ını buna eşitleyip doğrular (bkz. RC docs
    // "Authorization Header Setup"). Boşsa webhook route'u TÜM istekleri
    // reddeder (fail-closed — ödeme durumunu güncelleyen bir uç, diğer
    // no-op adaptörlerin aksine sessizce açık bırakılamaz).
    revenueCatWebhookSecret: env.REVENUECAT_WEBHOOK_SECRET || null,
  };
};

export { readEnv };
