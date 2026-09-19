import { Router } from 'express';
import crypto from 'node:crypto';
import { asyncHandler, log } from '@fridge/helper';
import { requireAuth } from '@fridge/middlewares';
import { parseRevenueCatWebhookPayload } from '@fridge/core/src/domain/billing-event-mapping.js';

// crypto.timingSafeEqual eşit uzunlukta buffer ister — farklı uzunluk
// erken dönülürse bu erken dönüş zaten sızdıracak bir şey yok (uzunluk
// secret'ın kendisi değil), ama karşılaştırmayı hep sabit-zamanlı tutmak
// için ikisini de aynı uzunluğa (hash'e) indirgemek yerine burada basit
// bir uzunluk ön-kontrolü + timingSafeEqual kullanılıyor.
const secretsMatch = (a, b) => {
  // İkisi de boşsa (örn. her iki argüman da undefined) eşleşmiş sayılmaz —
  // çağıran taraf zaten config.revenueCatWebhookSecret boşken 503 ile önceden
  // reddediyor, ama bu fonksiyon tek başına "iki boş secret eşleşir" gibi
  // yanlış bir sonuç vermemeli (defense-in-depth).
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

// GET /api/me/entitlements — mobilin tek doğruluk kaynağı (plan §Mimari
// ilke). RevenueCat webhook'u BURADA DEĞİL — authenticate'ten ÖNCE mount
// edilmesi gerektiği için boot.js'teki public route bloğunda
// (bkz. buildBillingWebhookHandler, aynı dosya sonunda export edilir).
const buildBillingRouter = ({ container }) => {
  const router = Router();
  const { useCases } = container;

  router.get('/me/entitlements', requireAuth(), asyncHandler(async (req, res) => {
    const entitlements = await useCases.getEntitlements({ userId: req.user.id, platform: req.clientPlatform });
    res.json(entitlements);
  }));

  // GET /api/plans — auth GEREKMEZ (kasıtlı): paywall ve onboarding tanıtım
  // kartı henüz hesabı olmayan/oturum açmamış kullanıcıya da "Ücretsiz vs
  // Premium" karşılaştırmasını gösterebilmeli.
  router.get('/plans', asyncHandler(async (req, res) => {
    const catalog = useCases.getPlanCatalog({ platform: req.clientPlatform });
    res.json(catalog);
  }));

  // Play'in 2026 zorunluluğu: uygulama içinden en fazla 2 dokunuşta iptal
  // (plan §Faz 5). Deep link üretimi tek satır — mağaza tarafında hiçbir
  // ek entegrasyon gerektirmiyor.
  router.get('/me/subscription/manage-url', requireAuth(), asyncHandler(async (req, res) => {
    const entitlements = await useCases.getEntitlements({ userId: req.user.id, platform: req.clientPlatform });
    const productId = entitlements.plan === 'premium' ? (req.query.productId ?? null) : null;
    const url = productId
      ? `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(productId)}&package=com.fridge.fridge_mobil`
      : 'https://play.google.com/store/account/subscriptions';
    res.json({ url });
  }));

  return router;
};

// RevenueCat webhook — plan §Faz 5 akış diyagramı: mobil satın alma yapar
// -> RC doğrular -> BU uca POST eder -> biz subscription tablosunu
// güncelleriz. boot.js'te authenticate'ten ÖNCE, doğrudan Express app'e
// mount edilir (RC bizim JWT'mizi bilmez) — bu yüzden kendi doğrulamasını
// (Authorization header == paylaşılan sır) burada yapar.
//
// FAIL-CLOSED: revenueCatWebhookSecret boşsa (henüz RC Dashboard'da
// ayarlanmadı) TÜM istekler 503 ile reddedilir — diğer no-op adaptörlerin
// (FCM/mail) aksine, burası abonelik/para durumunu değiştiren bir uç;
// sessizce açık bırakmak sahte "premium" olayları kabul etmek demektir.
const buildBillingWebhookHandler = ({ container }) => {
  const { useCases, config } = container;

  return asyncHandler(async (req, res) => {
    if (!config.revenueCatWebhookSecret) {
      log.error('revenuecat_webhook_not_configured');
      return res.status(503).json({ error: { code: 'WEBHOOK_NOT_CONFIGURED', message: 'Webhook henüz yapılandırılmadı' } });
    }

    const authHeader = req.headers.authorization;
    if (!secretsMatch(authHeader, config.revenueCatWebhookSecret)) {
      log.warn('revenuecat_webhook_unauthorized', { hasHeader: Boolean(authHeader) });
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Geçersiz webhook imzası' } });
    }

    const parsed = parseRevenueCatWebhookPayload(req.body);
    if (!parsed) {
      // Tüm gövde değil — yalnızca teşhis için event tipi + app_user_id
      // (RC payload şekli standarttır, bunlar zaten PII değil). Tam gövde
      // subscriber id / store purchase token / diğer alanları içerebilir,
      // loglara PII yığmamak için basılmıyor.
      log.warn('revenuecat_webhook_malformed', {
        eventType: req.body?.event?.type ?? null,
        appUserId: req.body?.event?.app_user_id ?? null,
      });
      return res.status(400).json({ error: { code: 'MALFORMED_PAYLOAD', message: 'Beklenmeyen webhook gövdesi' } });
    }

    const result = await useCases.applyBillingEvent(parsed);
    log.info('revenuecat_webhook_processed', {
      eventType: parsed.eventType,
      appUserId: parsed.appUserId,
      result: result.applied ? 'applied' : result.reason,
    });

    // RC'ye HER ZAMAN 200 dönülür (applied:false olsa bile —
    // DUPLICATE_EVENT/UNKNOWN_EVENT_TYPE/USER_NOT_FOUND bizim tarafımızda
    // "işlenmedi" ama RC için "teslim edildi" demek; 4xx/5xx dönersek RC'nin
    // retry mekanizması sonsuz döngüye girer).
    res.status(200).json({ received: true });
  });
};

export { buildBillingRouter, buildBillingWebhookHandler, secretsMatch };
