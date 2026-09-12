import { readFileSync } from 'node:fs';
import { makeDatasource } from '@fridge/core/src/infrastructure/persistence/datasource.js';
import { makeTokenService } from '@fridge/core/src/infrastructure/token-service.js';
import { makeLocalDiskStorage } from '@fridge/core/src/infrastructure/storage/local-disk.adapter.js';
import { makeTesseractOcr } from '@fridge/core/src/infrastructure/ocr/tesseract.adapter.js';
import { makeZaiTextParser } from '@fridge/core/src/infrastructure/parser/zai-text.adapter.js';
import { makeRuleBasedParser } from '@fridge/core/src/infrastructure/parser/rule-based.adapter.js';
import { makeZaiRecipeGenerator } from '@fridge/core/src/infrastructure/recipe/zai-recipe.adapter.js';
import { makeZaiShoppingSuggester } from '@fridge/core/src/infrastructure/shopping/zai-shopping.adapter.js';
import { makeZaiChefChat } from '@fridge/core/src/infrastructure/chef/zai-chef.adapter.js';
import { makeOpenFoodFactsLookup } from '@fridge/core/src/infrastructure/barcode/openfoodfacts.adapter.js';
import { makeFcmNotifier } from '@fridge/core/src/infrastructure/notification/fcm.adapter.js';
import { makeNoopNotifier } from '@fridge/core/src/infrastructure/notification/noop.adapter.js';
import { makePlayVersionAdapter } from '@fridge/core/src/infrastructure/play-store/play-version.adapter.js';
import { makeCachedPlayVersion } from '@fridge/core/src/infrastructure/play-store/cached-play-version.js';
import { makeAppStoreVersionAdapter } from '@fridge/core/src/infrastructure/app-store/app-store-version.adapter.js';
import { makeResendMailer } from '@fridge/core/src/infrastructure/mail/resend.adapter.js';
import { makeNoopMailer } from '@fridge/core/src/infrastructure/mail/noop-mailer.adapter.js';
import { makePasswordResetRepository } from '@fridge/core/src/infrastructure/persistence/repositories/password-reset.repository.js';
import { makeAiUsageLogRepository } from '@fridge/core/src/infrastructure/persistence/repositories/ai-usage-log.repository.js';

import { makeUserRepository } from '@fridge/core/src/infrastructure/persistence/repositories/user.repository.js';
import { makeSessionRepository } from '@fridge/core/src/infrastructure/persistence/repositories/session.repository.js';
import { makeHouseholdRepository } from '@fridge/core/src/infrastructure/persistence/repositories/household.repository.js';
import { makeHouseholdMemberRepository } from '@fridge/core/src/infrastructure/persistence/repositories/household-member.repository.js';
import { makeHouseholdInviteRepository } from '@fridge/core/src/infrastructure/persistence/repositories/household-invite.repository.js';
import { makeStorageLocationRepository } from '@fridge/core/src/infrastructure/persistence/repositories/storage-location.repository.js';
import { makeProductRepository } from '@fridge/core/src/infrastructure/persistence/repositories/product.repository.js';
import { makeProductCategoryRepository } from '@fridge/core/src/infrastructure/persistence/repositories/product-category.repository.js';
import { makeProductAliasRepository } from '@fridge/core/src/infrastructure/persistence/repositories/product-alias.repository.js';
import { makeInventoryItemRepository } from '@fridge/core/src/infrastructure/persistence/repositories/inventory-item.repository.js';
import { makeStockMovementRepository } from '@fridge/core/src/infrastructure/persistence/repositories/stock-movement.repository.js';
import { makeReceiptScanRepository } from '@fridge/core/src/infrastructure/persistence/repositories/receipt-scan.repository.js';
import { makeReceiptLineItemRepository } from '@fridge/core/src/infrastructure/persistence/repositories/receipt-line-item.repository.js';
import { makeRecipeRepository } from '@fridge/core/src/infrastructure/persistence/repositories/recipe.repository.js';
import { makeRecipeCookLogRepository } from '@fridge/core/src/infrastructure/persistence/repositories/recipe-cook-log.repository.js';
import { makeRecipeFavoriteRepository } from '@fridge/core/src/infrastructure/persistence/repositories/recipe-favorite.repository.js';
import { makeShoppingListRepository } from '@fridge/core/src/infrastructure/persistence/repositories/shopping-list.repository.js';
import { makeDeviceTokenRepository } from '@fridge/core/src/infrastructure/persistence/repositories/device-token.repository.js';
import { makeNotificationRepository } from '@fridge/core/src/infrastructure/persistence/repositories/notification.repository.js';
import { makeNotificationPreferenceRepository } from '@fridge/core/src/infrastructure/persistence/repositories/notification-preference.repository.js';
import { makeInsightsRepository } from '@fridge/core/src/infrastructure/persistence/repositories/insights.repository.js';
import { makeChefChatRepository } from '@fridge/core/src/infrastructure/persistence/repositories/chef-chat.repository.js';
import { makeSubscriptionRepository } from '@fridge/core/src/infrastructure/persistence/repositories/subscription.repository.js';
import { makeUsageCounterRepository } from '@fridge/core/src/infrastructure/persistence/repositories/usage-counter.repository.js';
import { makeBillingEventRepository } from '@fridge/core/src/infrastructure/persistence/repositories/billing-event.repository.js';

import { makeRegisterUser } from '@fridge/core/src/application/use-cases/auth/register-user.use-case.js';
import { makeLoginUser } from '@fridge/core/src/application/use-cases/auth/login-user.use-case.js';
import { makeCreateGuestUser } from '@fridge/core/src/application/use-cases/auth/create-guest-user.use-case.js';
import { makeUpgradeGuestUser } from '@fridge/core/src/application/use-cases/auth/upgrade-guest-user.use-case.js';
import { makeGetEntitlements } from '@fridge/core/src/application/use-cases/billing/get-entitlements.use-case.js';
import { makeGetPlanCatalog } from '@fridge/core/src/application/use-cases/billing/get-plan-catalog.use-case.js';
import { makeStartReverseTrial } from '@fridge/core/src/application/use-cases/billing/start-reverse-trial.use-case.js';
import { makeReserveAiUsage } from '@fridge/core/src/application/use-cases/billing/reserve-ai-usage.use-case.js';
import { makeReleaseAiUsage } from '@fridge/core/src/application/use-cases/billing/release-ai-usage.use-case.js';
import { makeApplyBillingEvent } from '@fridge/core/src/application/use-cases/billing/apply-billing-event.use-case.js';
import { makeReconcileSubscriptions } from '@fridge/core/src/application/use-cases/billing/reconcile-subscriptions.use-case.js';
import { buildPlanLimits, buildProductTiers } from '@fridge/core/src/domain/plans.js';
import { canUseAiFeature } from '@fridge/core/src/domain/entitlements.js';
import { makeRefreshSession } from '@fridge/core/src/application/use-cases/auth/refresh-session.use-case.js';
import { makeLogoutUser } from '@fridge/core/src/application/use-cases/auth/logout-user.use-case.js';
import { makeDeleteAccount } from '@fridge/core/src/application/use-cases/auth/delete-account.use-case.js';
import { makeUpdateProfile } from '@fridge/core/src/application/use-cases/auth/update-profile.use-case.js';
import { makeChangePassword } from '@fridge/core/src/application/use-cases/auth/change-password.use-case.js';
import { makeRequestPasswordReset } from '@fridge/core/src/application/use-cases/auth/request-password-reset.use-case.js';
import { makeResetPassword } from '@fridge/core/src/application/use-cases/auth/reset-password.use-case.js';

import { makeCreateHousehold } from '@fridge/core/src/application/use-cases/household/create-household.use-case.js';
import { makeUpdateHouseholdFeatures } from '@fridge/core/src/application/use-cases/household/update-household-features.use-case.js';
import { makeUpdateHouseholdProfile } from '@fridge/core/src/application/use-cases/household/update-household-profile.use-case.js';
import { makeCreateInvite } from '@fridge/core/src/application/use-cases/household/create-invite.use-case.js';
import { makeRevokeInvite } from '@fridge/core/src/application/use-cases/household/revoke-invite.use-case.js';
import { makeLeaveHousehold } from '@fridge/core/src/application/use-cases/household/leave-household.use-case.js';
import { makeDeleteHousehold } from '@fridge/core/src/application/use-cases/household/delete-household.use-case.js';
import { makeAcceptInvite } from '@fridge/core/src/application/use-cases/household/accept-invite.use-case.js';
import { makeUpdateHouseholdSettings } from '@fridge/core/src/application/use-cases/household/update-household-settings.use-case.js';
import { makeCreateStorageLocation } from '@fridge/core/src/application/use-cases/storage-location/create-storage-location.use-case.js';
import { makeUpdateStorageLocation } from '@fridge/core/src/application/use-cases/storage-location/update-storage-location.use-case.js';
import { makeDeleteStorageLocation } from '@fridge/core/src/application/use-cases/storage-location/delete-storage-location.use-case.js';
import { makeNotifyHousehold } from '@fridge/core/src/application/use-cases/notification/notify-household.use-case.js';

import { makeAddInventoryItem } from '@fridge/core/src/application/use-cases/inventory/add-inventory-item.use-case.js';
import { makeConsumeInventoryItem } from '@fridge/core/src/application/use-cases/inventory/consume-inventory-item.use-case.js';
import { makeUpdateInventoryItem } from '@fridge/core/src/application/use-cases/inventory/update-inventory-item.use-case.js';
import { makeDeleteInventoryItem } from '@fridge/core/src/application/use-cases/inventory/delete-inventory-item.use-case.js';
import { makeListInventoryItems } from '@fridge/core/src/application/use-cases/inventory/list-inventory-items.use-case.js';
import { makeExportInventoryCsv } from '@fridge/core/src/application/use-cases/inventory/export-inventory-csv.use-case.js';
import { makeListExpiringItems } from '@fridge/core/src/application/use-cases/inventory/list-expiring-items.use-case.js';

import { makeUploadReceiptScan, makeUploadReceiptScanText } from '@fridge/core/src/application/use-cases/receipt/upload-receipt-scan.use-case.js';
import { makeProcessReceiptScan } from '@fridge/core/src/application/use-cases/receipt/process-receipt-scan.use-case.js';
import { makeCorrectLineItem } from '@fridge/core/src/application/use-cases/receipt/correct-line-item.use-case.js';
import { makeConfirmReceiptScan } from '@fridge/core/src/application/use-cases/receipt/confirm-receipt-scan.use-case.js';
import { makeRetryReceiptScan } from '@fridge/core/src/application/use-cases/receipt/retry-receipt-scan.use-case.js';
import { makeDeleteReceiptImage } from '@fridge/core/src/application/use-cases/receipt/delete-receipt-image.use-case.js';
import { makeCleanupExpiredReceiptImages } from '@fridge/core/src/application/use-cases/receipt/cleanup-expired-receipt-images.use-case.js';

import { makeSuggestRecipes } from '@fridge/core/src/application/use-cases/recipe/suggest-recipes.use-case.js';
import { makeCookRecipe } from '@fridge/core/src/application/use-cases/recipe/cook-recipe.use-case.js';
import { makeCreateRecipe } from '@fridge/core/src/application/use-cases/recipe/create-recipe.use-case.js';
import { makeGetRecipeDetail } from '@fridge/core/src/application/use-cases/recipe/get-recipe-detail.use-case.js';
import { makeUpdateRecipe } from '@fridge/core/src/application/use-cases/recipe/update-recipe.use-case.js';
import { makeDeleteRecipe } from '@fridge/core/src/application/use-cases/recipe/delete-recipe.use-case.js';
import { makeGenerateAiRecipes } from '@fridge/core/src/application/use-cases/recipe/generate-ai-recipes.use-case.js';

import { makeGetShoppingList } from '@fridge/core/src/application/use-cases/shopping/get-shopping-list.use-case.js';
import { makeAddShoppingItem } from '@fridge/core/src/application/use-cases/shopping/add-shopping-item.use-case.js';
import { makeSuggestShoppingItems } from '@fridge/core/src/application/use-cases/shopping/suggest-shopping-items.use-case.js';
import { makeSuggestAiShoppingItems } from '@fridge/core/src/application/use-cases/shopping/suggest-ai-shopping-items.use-case.js';
import { makeAddShoppingItemsFromText } from '@fridge/core/src/application/use-cases/shopping/add-shopping-items-from-text.use-case.js';
import { makeAddRecipeMissingToList } from '@fridge/core/src/application/use-cases/shopping/add-recipe-missing-to-list.use-case.js';
import { makeTransferCheckedToInventory } from '@fridge/core/src/application/use-cases/shopping/transfer-checked-to-inventory.use-case.js';
import { makeGetHouseholdInsights } from '@fridge/core/src/application/use-cases/insights/get-household-insights.use-case.js';
import { makeSendChefMessage } from '@fridge/core/src/application/use-cases/chef/send-chef-message.use-case.js';
import { makeLookupBarcode } from '@fridge/core/src/application/use-cases/product/lookup-barcode.use-case.js';

import { makeSystemClock, log } from '@fridge/helper';

const buildContainer = (config) => {
  const datasource = makeDatasource({ connectionString: config.databaseUrl });
  const rawQuery = datasource.query;
  const clock = makeSystemClock();

  const tokenService = makeTokenService({
    accessSecret: config.jwtAccessSecret,
    refreshSecret: config.jwtRefreshSecret,
  });
  const storagePort = makeLocalDiskStorage({ baseDir: config.uploadsDir });
  const barcodeLookupPort = makeOpenFoodFactsLookup();

  // Tek OCR sağlayıcı: /scan (foto) yolu bunu kullanır. /scan-text zaten
  // ham metinle geldiği için process-receipt-scan.use-case.js OCR portunu
  // hiç çağırmaz — "mlkit-passthrough" diye ayrı bir sağlayıcıya gerek yok,
  // olması kafa karıştırıcı ve imza uyumsuzluğuna (imagePath vs rawText) açıktı.
  const ocrPort = makeTesseractOcr({ storagePort });

  // Her AI çağrısının (özellik, model, token, gecikme, hata kodu) kaydı —
  // record() kendi try/catch'ini yönetir, asla reject etmez —
  // onUsage burada await edilmeden ateşlenir (fire-and-forget).
  const aiUsageLogRepo = makeAiUsageLogRepository({ rawQuery });
  const onUsage = (entry) => { aiUsageLogRepo.record(entry); };

  // Fiş ayrıştırma: Z.ai API anahtarı varsa Z.ai, yoksa kural tabanlı fallback.
  const receiptParserPort = config.zaiApiKey
    ? makeZaiTextParser({ apiKey: config.zaiApiKey, model: config.zaiModel, onUsage })
    : makeRuleBasedParser();

  // recipeAiEnabled=false veya zaiApiKey yoksa null kalır — recipe.routes.js bunu görüp 503 döner.
  const recipeGeneratorPort = config.recipeAiEnabled && config.zaiApiKey
    ? makeZaiRecipeGenerator({ apiKey: config.zaiApiKey, model: config.zaiRecipeModel, onUsage })
    : null;

  // shoppingAiEnabled=false veya zaiApiKey yoksa null kalır — shopping.routes.js bunu görüp 503 döner.
  const shoppingSuggesterPort = config.shoppingAiEnabled && config.zaiApiKey
    ? makeZaiShoppingSuggester({ apiKey: config.zaiApiKey, model: config.zaiShoppingModel, onUsage })
    : null;

  // chefAiEnabled=false veya zaiApiKey yoksa null kalır — chef.routes.js bunu görüp 503 döner.
  const chefChatPort = config.chefAiEnabled && config.zaiApiKey
    ? makeZaiChefChat({ apiKey: config.zaiApiKey, model: config.zaiChefModel, onUsage })
    : null;

  // Kimlik bilgisi eksikse (dosya yok/okunamıyor) no-op'a düş — push'un
  // yokluğu asla bir isteği 500'e düşürmemeli.
  let notificationPort;
  if (config.fcmEnabled) {
    try {
      let serviceAccount;
      if (config.fcmServiceAccountBase64) {
        serviceAccount = JSON.parse(Buffer.from(config.fcmServiceAccountBase64, 'base64').toString('utf8'));
      } else if (config.fcmServiceAccountPath) {
        serviceAccount = JSON.parse(readFileSync(config.fcmServiceAccountPath, 'utf8'));
      }
      if (!serviceAccount) throw new Error('FCM service account not configured');
      notificationPort = makeFcmNotifier({ serviceAccount, projectId: config.fcmProjectId });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('fcm_init_failed', error.message);
      notificationPort = makeNoopNotifier();
    }
  } else {
    notificationPort = makeNoopNotifier();
  }

  // Kimlik bilgisi eksikse (henüz kurulmadı/hata) cachedPlayVersion.getLatestVersion()
  // hep config.appLatestVersion (env fallback) döner — aynı "yokluk asla 500
  // üretmez" ilkesi FCM'deki gibi burada da geçerli.
  let cachedPlayVersion;
  try {
    let serviceAccount;
    if (config.playServiceAccountBase64) {
      serviceAccount = JSON.parse(Buffer.from(config.playServiceAccountBase64, 'base64').toString('utf8'));
    } else if (config.playServiceAccountPath) {
      serviceAccount = JSON.parse(readFileSync(config.playServiceAccountPath, 'utf8'));
    }
    if (!serviceAccount) throw new Error('Play service account not configured');
    const playVersionAdapter = makePlayVersionAdapter({ serviceAccount, packageName: config.playPackageName });
    cachedPlayVersion = makeCachedPlayVersion({ adapter: playVersionAdapter, fallbackVersion: config.appLatestVersion });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('play_version_init_failed', error.message);
    cachedPlayVersion = { getLatestVersion: async () => config.appLatestVersion };
  }

  // iOS eşdeğeri — iTunes Lookup kimlik bilgisi gerektirmediği için kurulumu
  // hiç patlamaz, yine de aynı "asla boot'u çökertme" ilkesi için try/catch
  // korunuyor (bundleId boşsa vs.). makeCachedPlayVersion adaptör-agnostik,
  // aynı cache/TTL/hata davranışını burada da değişmeden kullanıyoruz.
  let cachedAppStoreVersion;
  try {
    if (!config.iosBundleId) throw new Error('iOS bundle id not configured');
    const appStoreVersionAdapter = makeAppStoreVersionAdapter({ bundleId: config.iosBundleId });
    cachedAppStoreVersion = makeCachedPlayVersion({ adapter: appStoreVersionAdapter, fallbackVersion: config.appLatestVersionIos });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('app_store_version_init_failed', error.message);
    cachedAppStoreVersion = { getLatestVersion: async () => config.appLatestVersionIos };
  }

  // Aynı ilke: RESEND_API_KEY yoksa boot patlamaz, no-op mailer'a düşer —
  // dev'de kod konsola basılır, forgot-password akışı yine 204 döner.
  const mailer = config.resendApiKey
    ? makeResendMailer({ apiKey: config.resendApiKey, from: config.mailFrom })
    : makeNoopMailer();

  const repos = {
    userRepo: makeUserRepository({ rawQuery }),
    sessionRepo: makeSessionRepository({ rawQuery }),
    passwordResetRepo: makePasswordResetRepository({ rawQuery }),
    householdRepo: makeHouseholdRepository({ rawQuery }),
    householdMemberRepo: makeHouseholdMemberRepository({ rawQuery }),
    inviteRepo: makeHouseholdInviteRepository({ rawQuery }),
    storageLocationRepo: makeStorageLocationRepository({ rawQuery }),
    productRepo: makeProductRepository({ rawQuery }),
    productCategoryRepo: makeProductCategoryRepository({ rawQuery }),
    productAliasRepo: makeProductAliasRepository({ rawQuery }),
    inventoryItemRepo: makeInventoryItemRepository({ rawQuery }),
    stockMovementRepo: makeStockMovementRepository({ rawQuery }),
    receiptScanRepo: makeReceiptScanRepository({ rawQuery }),
    receiptLineItemRepo: makeReceiptLineItemRepository({ rawQuery }),
    recipeRepo: makeRecipeRepository({ rawQuery }),
    recipeCookLogRepo: makeRecipeCookLogRepository({ rawQuery }),
    recipeFavoriteRepo: makeRecipeFavoriteRepository({ rawQuery }),
    shoppingListRepo: makeShoppingListRepository({ rawQuery }),
    deviceTokenRepo: makeDeviceTokenRepository({ rawQuery }),
    notificationRepo: makeNotificationRepository({ rawQuery }),
    notificationPreferenceRepo: makeNotificationPreferenceRepository({ rawQuery }),
    insightsRepo: makeInsightsRepository({ rawQuery }),
    chefChatRepo: makeChefChatRepository({ rawQuery }),
    aiUsageLogRepo,
    subscriptionRepo: makeSubscriptionRepository({ rawQuery }),
    usageCounterRepo: makeUsageCounterRepository({ rawQuery, datasource }),
    billingEventRepo: makeBillingEventRepository({ rawQuery }),
  };

  // Plan/kota limit tablosu — env PLAN_LIMITS_JSON ile ezilebilir (bkz.
  // domain/plans.js). Bir kez hesaplanır, tüm entitlement use-case'leri
  // aynı referansı paylaşır.
  // Platform bazlı limitler (bkz. plan §Faz D) — sadece 2 platform olduğu
  // için ikisi de boot'ta önceden hesaplanıp cache'lenir, her istekte
  // yeniden hesaplama yapılmaz. planLimitsFor(platform) tüm entitlement
  // use-case'lerinin kullandığı tek giriş noktası.
  const planLimitsByPlatform = {
    android: buildPlanLimits(config.planLimitsJson, 'android', config.platformLimitsJson),
    ios: buildPlanLimits(config.planLimitsJson, 'ios', config.platformLimitsJson),
  };
  const planLimitsFor = (platform) => planLimitsByPlatform[platform] ?? planLimitsByPlatform.android;
  // Geriye dönük uyumluluk: platform bilinmeyen çağıranlar (henüz
  // güncellenmemiş bir yer varsa) varsayılan olarak Android limitlerini alır.
  const planLimitsByPlan = planLimitsByPlatform.android;
  // Aile paketi ürün→kademe/koltuk haritası — env PRODUCT_TIERS_JSON ile
  // ezilebilir (bkz. domain/plans.js).
  const productTiersByProductId = buildProductTiers(config.productTiersJson);

  const notifyHousehold = makeNotifyHousehold({
    householdMemberRepo: repos.householdMemberRepo,
    deviceTokenRepo: repos.deviceTokenRepo,
    notificationRepo: repos.notificationRepo,
    notificationPreferenceRepo: repos.notificationPreferenceRepo,
    notificationPort,
  });

  // process-receipt-scan.use-case.js kota iadesi için releaseAiUsage'a
  // ihtiyaç duyuyor — useCases objesinin kendisine dairesel referans
  // vermemek için (createHousehold ile aynı desen) önce ayrı bir
  // değişkende kuruluyor, useCases'e de aynı referans atanıyor.
  const releaseAiUsage = makeReleaseAiUsage({ usageCounterRepo: repos.usageCounterRepo });

  // createGuestUser, misafire otomatik bir alan açmak için createHousehold'a
  // ihtiyaç duyuyor — useCases objesinin kendisine dairesel referans
  // vermemek için önce ayrı bir değişkende kuruluyor, useCases'e de aynı
  // referans atanıyor.
  const createHousehold = makeCreateHousehold({
    householdRepo: repos.householdRepo,
    householdMemberRepo: repos.householdMemberRepo,
    storageLocationRepo: repos.storageLocationRepo,
  });

  const useCases = {
    registerUser: makeRegisterUser({ userRepo: repos.userRepo }),
    loginUser: makeLoginUser({ userRepo: repos.userRepo, sessionRepo: repos.sessionRepo, tokenService }),
    createGuestUser: makeCreateGuestUser({
      userRepo: repos.userRepo,
      sessionRepo: repos.sessionRepo,
      tokenService,
      createHousehold,
    }),
    upgradeGuestUser: makeUpgradeGuestUser({ userRepo: repos.userRepo }),
    getEntitlements: makeGetEntitlements({
      userRepo: repos.userRepo,
      subscriptionRepo: repos.subscriptionRepo,
      usageCounterRepo: repos.usageCounterRepo,
      householdMemberRepo: repos.householdMemberRepo,
      planLimitsFor,
      clock,
    }),
    getPlanCatalog: makeGetPlanCatalog({ planLimitsFor, productTiersByProductId }),
    startReverseTrial: makeStartReverseTrial({ userRepo: repos.userRepo, clock }),
    reserveAiUsage: makeReserveAiUsage({ usageCounterRepo: repos.usageCounterRepo }),
    releaseAiUsage,
    applyBillingEvent: makeApplyBillingEvent({
      billingEventRepo: repos.billingEventRepo,
      subscriptionRepo: repos.subscriptionRepo,
      userRepo: repos.userRepo,
      productTiersByProductId,
    }),
    reconcileSubscriptions: makeReconcileSubscriptions({
      subscriptionRepo: repos.subscriptionRepo,
      // Faz 5'te RevenueCat REST istemcisiyle değiştirilecek — şimdilik
      // no-op (her zaman null döner, hiçbir şeyi değiştirmez) böylece cron
      // Faz 1'de bile güvenle çalıştırılabilir/test edilebilir.
      fetchLatestFromStore: async () => null,
      log,
    }),
    refreshSession: makeRefreshSession({ sessionRepo: repos.sessionRepo, tokenService }),
    logoutUser: makeLogoutUser({ sessionRepo: repos.sessionRepo, tokenService }),
    deleteAccount: makeDeleteAccount({
      datasource,
      userRepo: repos.userRepo,
      makeUserRepo: makeUserRepository,
      makeHouseholdRepo: makeHouseholdRepository,
      makeHouseholdMemberRepo: makeHouseholdMemberRepository,
      makeHouseholdInviteRepo: makeHouseholdInviteRepository,
    }),
    updateProfile: makeUpdateProfile({ userRepo: repos.userRepo }),
    changePassword: makeChangePassword({ userRepo: repos.userRepo }),
    requestPasswordReset: makeRequestPasswordReset({
      userRepo: repos.userRepo,
      passwordResetRepo: repos.passwordResetRepo,
      mailer,
      ttlMinutes: config.passwordResetTtlMinutes,
    }),
    resetPassword: makeResetPassword({
      userRepo: repos.userRepo,
      passwordResetRepo: repos.passwordResetRepo,
      sessionRepo: repos.sessionRepo,
    }),

    createHousehold,
    updateHouseholdFeatures: makeUpdateHouseholdFeatures({ householdRepo: repos.householdRepo }),
    updateHouseholdProfile: makeUpdateHouseholdProfile({ householdRepo: repos.householdRepo }),
    createInvite: makeCreateInvite({ inviteRepo: repos.inviteRepo, clock }),
    revokeInvite: makeRevokeInvite({ inviteRepo: repos.inviteRepo }),
    leaveHousehold: makeLeaveHousehold({ householdRepo: repos.householdRepo, householdMemberRepo: repos.householdMemberRepo }),
    deleteHousehold: makeDeleteHousehold({ householdRepo: repos.householdRepo }),
    acceptInvite: makeAcceptInvite({
      datasource,
      makeInviteRepo: makeHouseholdInviteRepository,
      makeHouseholdMemberRepo: makeHouseholdMemberRepository,
      householdRepo: repos.householdRepo,
      userRepo: repos.userRepo,
      notifyHousehold,
      clock,
      planLimitsByPlan,
    }),
    updateHouseholdSettings: makeUpdateHouseholdSettings({ householdRepo: repos.householdRepo }),

    createStorageLocation: makeCreateStorageLocation({ storageLocationRepo: repos.storageLocationRepo }),
    updateStorageLocation: makeUpdateStorageLocation({ storageLocationRepo: repos.storageLocationRepo }),
    deleteStorageLocation: makeDeleteStorageLocation({
      storageLocationRepo: repos.storageLocationRepo,
      makeStorageLocationRepo: makeStorageLocationRepository,
      datasource,
    }),

    addInventoryItem: makeAddInventoryItem({ inventoryItemRepo: repos.inventoryItemRepo, stockMovementRepo: repos.stockMovementRepo }),
    consumeInventoryItem: makeConsumeInventoryItem({
      inventoryItemRepo: repos.inventoryItemRepo,
      stockMovementRepo: repos.stockMovementRepo,
      productRepo: repos.productRepo,
    }),
    updateInventoryItem: makeUpdateInventoryItem({
      inventoryItemRepo: repos.inventoryItemRepo,
      stockMovementRepo: repos.stockMovementRepo,
    }),
    deleteInventoryItem: makeDeleteInventoryItem({
      inventoryItemRepo: repos.inventoryItemRepo,
      stockMovementRepo: repos.stockMovementRepo,
    }),
    listInventoryItems: makeListInventoryItems({ inventoryItemRepo: repos.inventoryItemRepo }),
    exportInventoryCsv: makeExportInventoryCsv({ inventoryItemRepo: repos.inventoryItemRepo }),
    listExpiringItems: makeListExpiringItems({ inventoryItemRepo: repos.inventoryItemRepo, clock }),

    uploadReceiptScan: makeUploadReceiptScan({ receiptScanRepo: repos.receiptScanRepo, storagePort }),
    uploadReceiptScanText: makeUploadReceiptScanText({ receiptScanRepo: repos.receiptScanRepo }),
    processReceiptScan: makeProcessReceiptScan({
      receiptScanRepo: repos.receiptScanRepo,
      receiptLineItemRepo: repos.receiptLineItemRepo,
      productAliasRepo: repos.productAliasRepo,
      productRepo: repos.productRepo,
      productCategoryRepo: repos.productCategoryRepo,
      ocrPort,
      receiptParserPort,
      notifyHousehold,
      releaseAiUsage,
    }),
    correctLineItem: makeCorrectLineItem({
      receiptLineItemRepo: repos.receiptLineItemRepo,
      productAliasRepo: repos.productAliasRepo,
      productRepo: repos.productRepo,
      productCategoryRepo: repos.productCategoryRepo,
    }),
    confirmReceiptScan: makeConfirmReceiptScan({
      datasource,
      receiptScanRepo: repos.receiptScanRepo,
      receiptLineItemRepo: repos.receiptLineItemRepo,
      makeInventoryItemRepo: makeInventoryItemRepository,
      makeStockMovementRepo: makeStockMovementRepository,
    }),
    retryReceiptScan: makeRetryReceiptScan({ receiptScanRepo: repos.receiptScanRepo }),
    deleteReceiptImage: makeDeleteReceiptImage({ receiptScanRepo: repos.receiptScanRepo, storagePort }),
    cleanupExpiredReceiptImages: makeCleanupExpiredReceiptImages({
      householdRepo: repos.householdRepo,
      receiptScanRepo: repos.receiptScanRepo,
      storagePort,
      clock,
    }),

    suggestRecipes: makeSuggestRecipes({ recipeRepo: repos.recipeRepo }),
    createRecipe: makeCreateRecipe({ datasource, makeRecipeRepo: makeRecipeRepository }),
    getRecipeDetail: makeGetRecipeDetail({ recipeRepo: repos.recipeRepo, inventoryItemRepo: repos.inventoryItemRepo }),
    updateRecipe: makeUpdateRecipe({ recipeRepo: repos.recipeRepo }),
    deleteRecipe: makeDeleteRecipe({ recipeRepo: repos.recipeRepo }),
    cookRecipe: makeCookRecipe({
      datasource,
      recipeRepo: repos.recipeRepo,
      makeInventoryItemRepo: makeInventoryItemRepository,
      makeStockMovementRepo: makeStockMovementRepository,
      makeRecipeCookLogRepo: makeRecipeCookLogRepository,
    }),
    generateAiRecipes: recipeGeneratorPort
      ? makeGenerateAiRecipes({
        datasource,
        inventoryItemRepo: repos.inventoryItemRepo,
        householdMemberRepo: repos.householdMemberRepo,
        makeProductRepo: makeProductRepository,
        makeRecipeRepo: makeRecipeRepository,
        recipeGeneratorPort,
      })
      : null,

    getShoppingList: makeGetShoppingList({ shoppingListRepo: repos.shoppingListRepo }),
    addShoppingItem: makeAddShoppingItem({ shoppingListRepo: repos.shoppingListRepo }),
    suggestShoppingItems: makeSuggestShoppingItems({ shoppingListRepo: repos.shoppingListRepo }),
    suggestAiShoppingItems: shoppingSuggesterPort
      ? makeSuggestAiShoppingItems({ shoppingListRepo: repos.shoppingListRepo, shoppingSuggesterPort })
      : null,
    addShoppingItemsFromText: shoppingSuggesterPort
      ? makeAddShoppingItemsFromText({ inventoryItemRepo: repos.inventoryItemRepo, shoppingSuggesterPort })
      : null,
    addRecipeMissingToList: makeAddRecipeMissingToList({
      recipeRepo: repos.recipeRepo,
      inventoryItemRepo: repos.inventoryItemRepo,
      shoppingListRepo: repos.shoppingListRepo,
    }),
    transferCheckedToInventory: makeTransferCheckedToInventory({
      datasource,
      shoppingListRepo: repos.shoppingListRepo,
      makeProductRepo: makeProductRepository,
      makeInventoryItemRepo: makeInventoryItemRepository,
      makeStockMovementRepo: makeStockMovementRepository,
    }),

    getHouseholdInsights: makeGetHouseholdInsights({ insightsRepo: repos.insightsRepo, clock }),

    lookupBarcode: makeLookupBarcode({ productRepo: repos.productRepo, barcodeLookupPort }),

    sendChefMessage: chefChatPort
      ? makeSendChefMessage({
        chefChatRepo: repos.chefChatRepo,
        inventoryItemRepo: repos.inventoryItemRepo,
        shoppingListRepo: repos.shoppingListRepo,
        recipeCookLogRepo: repos.recipeCookLogRepo,
        householdMemberRepo: repos.householdMemberRepo,
        chefChatPort,
        clock,
      })
      : null,
  };

  return { config, datasource, tokenService, storagePort, notificationPort, cachedPlayVersion, cachedAppStoreVersion, repos, useCases, planLimitsByPlan, canUseAiFeature };
};

export { buildContainer };
