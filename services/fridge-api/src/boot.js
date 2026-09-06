import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { errorHandler, requestLogger } from '@fridge/middlewares';
import { log } from '@fridge/helper';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

import { makeAuthMiddleware } from '../middlewares/auth.middleware.js';
import { buildRouter } from '../routes/index.js';
import { buildBillingWebhookHandler } from '../routes/billing.routes.js';

// origin: true her origin'i yansıtır — credentials: true ile birleşince
// tehlikeli bir kombinasyon. Prod'da CORS_ALLOWED_ORIGINS zorunlu
// (virgülle ayrılmış liste); dev'de mobil/web farklı portlardan geldiği
// için whitelist vermek pratik değil, o yüzden orada fallback korunuyor.
const buildCorsOptions = (config) => {
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (allowedOrigins.length > 0) {
    return { origin: allowedOrigins, credentials: true };
  }

  if (config.nodeEnv === 'production') {
    throw new Error('CORS_ALLOWED_ORIGINS is required in production');
  }

  log.warn('cors_open_origin_dev_only', { message: 'CORS_ALLOWED_ORIGINS not set, reflecting all origins (dev only)' });
  return { origin: true, credentials: true };
};

const boot = (container) => {
  const app = express();

  // Nginx gibi bir reverse proxy arkasında çalışıyor — bu olmadan req.ip
  // proxy'nin IP'si olur ve login rate limiter tüm kullanıcıları tek
  // kovada toplar.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors(buildCorsOptions(container.config)));
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());
  app.use(requestLogger());

  const authenticate = makeAuthMiddleware({ tokenService: container.tokenService, userRepo: container.repos.userRepo });

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // Giriş yapmamış kullanıcı da açılışta görebilmeli — authenticate'ten
  // önce mount edilir. Mobil bunu her açılışta karşılaştırıp minSupported'ın
  // altındaysa kapatılamaz güncelleme ekranı, latest'in altındaysa
  // kapatılabilir banner gösterir. latestVersion artık Play Store'dan
  // (production track) okunuyor — cachedPlayVersion, service account
  // kuruluysa gerçek sürümü döner, kurulu değilse/hata varsa appLatestVersion
  // env fallback'ine düşer (bkz. container.js).
  const appConfigHandler = async (req, res) => res.json({
    latestVersion: await container.cachedPlayVersion.getLatestVersion(),
    minSupportedVersion: container.config.appMinSupportedVersion,
    storeUrl: container.config.appStoreUrl,
  });
  // Mobilin ApiConfig.baseUrl'i zaten /api ile bitiyor (bkz.
  // fridge-mobil/lib/core/api/api_config.dart) — istek hep /api/app-config'e
  // gidiyordu, kökteki mount hiç tetiklenmiyordu (404, bkz. bug: sürüm
  // kontrolü hiç çalışmamıştı). İki yolda da aynı handler mount edilir; kök
  // mount eski/farklı client'lar için korunur.
  app.get('/app-config', appConfigHandler);
  app.get('/api/app-config', appConfigHandler);

  // Play Store store listing'in istediği halka açık gizlilik politikası
  // ve hesap silme sayfaları — ayrı hosting gerektirmesin diye API'den
  // servis ediliyor.
  app.get('/privacy', (req, res) => res.sendFile(join(publicDir, 'privacy.html')));
  app.get('/delete-account', (req, res) => res.sendFile(join(publicDir, 'delete-account.html')));
  // Abonelik şartları — fiyat/yenileme/iptal/iade politikası (plan §Faz 6,
  // paywall_screen.dart ve settings_screen.dart buradan link verir).
  app.get('/terms', (req, res) => res.sendFile(join(publicDir, 'terms.html')));

  // Android App Links doğrulaması: /join/KOD linkinin tıklanınca tarayıcı
  // yerine doğrudan uygulamayı açması için Android bu dosyayı HTTPS
  // üzerinden (yönlendirmesiz, doğrudan) okuyabilmeli — authenticate'ten
  // önce, herkese açık olmalı.
  app.get('/.well-known/assetlinks.json', (req, res) =>
    res.sendFile(join(publicDir, '.well-known', 'assetlinks.json')));

  // Uygulama yüklü değilse veya doğrulama başarısız olursa (örn. iOS,
  // masaüstü tarayıcı) tıklanan link burada açılır — kod gösterilir,
  // Play Store'a yönlendirme sunulur.
  app.get('/join/:code', (req, res) => res.sendFile(join(publicDir, 'join.html')));

  // RevenueCat webhook — authenticate'ten ÖNCE (RC bizim JWT'mizi bilmez),
  // kendi Authorization-header doğrulamasını yapıyor (bkz.
  // buildBillingWebhookHandler). Play Console'da /api altında değil, kök
  // seviyede tutuluyor ki mobil API prefix'iyle karışmasın ve RC
  // dashboard'unda tek, sabit bir URL olsun.
  app.post('/billing/webhook', buildBillingWebhookHandler({ container }));

  app.use('/api', buildRouter({ container, authenticate }));

  app.use(errorHandler());

  return app;
};

export { boot };
