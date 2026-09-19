// JWT_ACCESS_SECRET/JWT_REFRESH_SECRET her ortamda zorunlu — sadece
// production'da değil. Önceden yalnızca NODE_ENV === 'production' tam
// eşleşmesinde zorunluydu; NODE_ENV tanımsız bir container, bir staging
// kurulumu veya "prod" gibi bir yazım hatası, koda gömülü sabit
// 'dev-access-secret'/'dev-refresh-secret' ile sessizce açılabiliyordu —
// o durumda herkes istediği userId için geçerli token üretebilirdi.
// Artık DATABASE_URL ile aynı kategoride: env yoksa ortam ne olursa olsun
// boot patlar.
const REQUIRED_KEYS = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

const readEnv = (env = process.env) => {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  const missing = REQUIRED_KEYS.filter((key) => !env[key]);
  if (isProduction) {
    // Tüm AI özellikleri (fiş, tarif, alışveriş, şef) Z.ai kullanır.
    // Herhangi bir AI özelliği devredeyse ZAI_API_KEY zorunludur.
    const recipeAiEnabled = env.RECIPE_AI_ENABLED !== 'false';
    const shoppingAiEnabled = env.SHOPPING_AI_ENABLED !== 'false';
    // ASSISTANT_AI_ENABLED yeni ad (AI Chef -> AI Asistan genellemesi),
    // CHEF_AI_ENABLED eski env değişkenine geriye dönük fallback (mevcut
    // deploy'larda .env yeniden yazılmadan çalışmaya devam etsin diye).
    const assistantAiEnabled = (env.ASSISTANT_AI_ENABLED ?? env.CHEF_AI_ENABLED) !== 'false';
    if ((recipeAiEnabled || shoppingAiEnabled || assistantAiEnabled) && !env.ZAI_API_KEY) {
      missing.push('ZAI_API_KEY');
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  return {
    nodeEnv,
    port: Number(env.PORT || 4000),
    databaseUrl: env.DATABASE_URL,
    jwtAccessSecret: env.JWT_ACCESS_SECRET,
    jwtRefreshSecret: env.JWT_REFRESH_SECRET,
    uploadsDir: env.UPLOADS_DIR || 'uploads',
    // Tüm AI özellikleri Z.ai üzerinden çalışır — glm-4.6 (ücretli, $0.60/$2.20
    // per 1M token), thinking kapalı (bkz. infrastructure/ai/zai.js). Ücretsiz
    // glm-4.7-flash/glm-4.5-flash canlıda denendi (2026-09-12): biri sürekli
    // aşırı yük hatası verdi, diğeri yavaş+hatalıydı — üretim için glm-4.6'ya
    // geçildi. Groq'un ücretli katmanı kapandığı ve free tier'ı (~63 kullanıcıda
    // TPD tavanı) yetersiz kaldığı için Z.ai'ye değiştirildi, bkz.
    // docs/AI_PROVIDER_SPEC.md ve docs/ZAI_MIGRATION_PLAN.md.
    zaiApiKey: env.ZAI_API_KEY,
    zaiModel: env.ZAI_MODEL || 'glm-4.6',
    recipeAiEnabled: env.RECIPE_AI_ENABLED !== 'false',
    zaiRecipeModel: env.ZAI_RECIPE_MODEL || env.ZAI_MODEL || 'glm-4.6',
    shoppingAiEnabled: env.SHOPPING_AI_ENABLED !== 'false',
    zaiShoppingModel: env.ZAI_SHOPPING_MODEL || env.ZAI_MODEL || 'glm-4.6',
    // ASSISTANT_AI_ENABLED / ZAI_ASSISTANT_MODEL yeni adlar — CHEF_AI_ENABLED
    // / ZAI_CHEF_MODEL eski deploy'lar için fallback olarak okunur.
    assistantAiEnabled: (env.ASSISTANT_AI_ENABLED ?? env.CHEF_AI_ENABLED) !== 'false',
    zaiAssistantModel: env.ZAI_ASSISTANT_MODEL || env.ZAI_CHEF_MODEL || env.ZAI_MODEL || 'glm-4.6',
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
    // REDIS_URL yoksa container in-memory cache'e düşer — Redis'in yokluğu
    // boot'u patlatmamalı (resendApiKey/fcm ile aynı ilke). Bilinçli olarak
    // REQUIRED_IN_PRODUCTION_KEYS'E EKLENMEDİ: cache verisi kaybolabilir
    // veridir, yokluğu yalnızca yavaşlık üretir, yanlış sonuç değil (bkz.
    // plan §Redis Faz 1 — kota/session/fiş kuyruğu HİÇBİR ZAMAN Redis'e
    // taşınmıyor, o yüzden Redis'in yokluğu asla yanlış bir karara yol açmaz).
    redisUrl: env.REDIS_URL || null,
    // AI yanıt cache'ini acil durumda tek env ile kapatabilmek için — bir
    // "bayat cevap" şikayeti gelirse deploy beklemeden kapatılabilir.
    aiCacheEnabled: env.AI_CACHE_ENABLED !== 'false',
    aiCacheTtlSeconds: Number(env.AI_CACHE_TTL_SECONDS || 24 * 60 * 60),
    // Mobil açılışta GET /app-config ile karşılaştırır — buradan kapatılabilir
    // banner ("yeni sürüm var") ya da kapatılamaz zorunlu güncelleme ekranı
    // tetiklenir. APP_LATEST_VERSION artık sadece FALLBACK: playServiceAccount
    // ayarlıysa gerçek değer doğrudan Play Store'dan (production track) okunur,
    // bu env hiç elle güncellenmez. Play API'ye hiç ulaşılamazsa (kimlik bilgisi
    // yok/hata) bu değere düşülür.
    appLatestVersion: env.APP_LATEST_VERSION || '1.0.0',
    appMinSupportedVersion: env.APP_MIN_SUPPORTED_VERSION || '1.0.0',
    appStoreUrl: env.APP_STORE_URL || 'https://play.google.com/store/apps/details?id=com.fridge.fridge_mobil',
    // Play Console > Setup > API access'te "View app information (read-only)"
    // izniyle davet edilmiş bir service account gerekir (bkz. fcmServiceAccount*
    // ile aynı ikili desen — base64 prod'da, path local'de).
    playServiceAccountPath: env.PLAY_SERVICE_ACCOUNT_PATH,
    playServiceAccountBase64: env.PLAY_SERVICE_ACCOUNT_BASE64,
    playPackageName: env.PLAY_PACKAGE_NAME || 'com.fridge.fridge_mobil',
    // iOS tarafı: Play Developer API'nin karşılığı yok, iTunes Lookup
    // public endpoint'i kullanılıyor (bkz. app-store-version.adapter.js) —
    // kimlik bilgisi gerekmez, bu yüzden playServiceAccount* gibi bir
    // ikili desen yok. App Store'da henüz yayın yoksa (TestFlight-only)
    // adaptör null döner, appLatestVersion'a (aynı zincirin Android
    // fallback'i) değil AYRICA kendi appLatestVersionIos fallback'ine düşülür.
    appStoreUrlIos: env.APP_STORE_URL_IOS || 'https://apps.apple.com/app/id0000000000',
    appLatestVersionIos: env.APP_LATEST_VERSION_IOS || env.APP_LATEST_VERSION || '1.0.0',
    appMinSupportedVersionIos: env.APP_MIN_SUPPORTED_VERSION_IOS || env.APP_MIN_SUPPORTED_VERSION || '1.0.0',
    // ios/Runner.xcodeproj/project.pbxproj > PRODUCT_BUNDLE_IDENTIFIER ile aynı olmalı.
    iosBundleId: env.IOS_BUNDLE_ID || 'com.fridge.fridgeMobil',
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
