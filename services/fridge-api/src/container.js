import { readFileSync } from 'node:fs';
import { makeDatasource } from '@fridge/core/src/infrastructure/persistence/datasource.js';
import { makeTokenService } from '@fridge/core/src/infrastructure/token-service.js';
import { makeLocalDiskStorage } from '@fridge/core/src/infrastructure/storage/local-disk.adapter.js';
import { makeTesseractOcr } from '@fridge/core/src/infrastructure/ocr/tesseract.adapter.js';
import { makeGeminiTextParser } from '@fridge/core/src/infrastructure/parser/gemini-text.adapter.js';
import { makeRuleBasedParser } from '@fridge/core/src/infrastructure/parser/rule-based.adapter.js';
import { makeGeminiRecipeGenerator } from '@fridge/core/src/infrastructure/recipe/gemini-recipe.adapter.js';
import { makeGeminiShoppingSuggester } from '@fridge/core/src/infrastructure/shopping/gemini-shopping.adapter.js';
import { makeGeminiChefChat } from '@fridge/core/src/infrastructure/chef/gemini-chef.adapter.js';
import { makeOpenFoodFactsLookup } from '@fridge/core/src/infrastructure/barcode/openfoodfacts.adapter.js';
import { makeFcmNotifier } from '@fridge/core/src/infrastructure/notification/fcm.adapter.js';
import { makeNoopNotifier } from '@fridge/core/src/infrastructure/notification/noop.adapter.js';

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

import { makeRegisterUser } from '@fridge/core/src/application/use-cases/auth/register-user.use-case.js';
import { makeLoginUser } from '@fridge/core/src/application/use-cases/auth/login-user.use-case.js';
import { makeCreateGuestUser } from '@fridge/core/src/application/use-cases/auth/create-guest-user.use-case.js';
import { makeUpgradeGuestUser } from '@fridge/core/src/application/use-cases/auth/upgrade-guest-user.use-case.js';
import { makeRefreshSession } from '@fridge/core/src/application/use-cases/auth/refresh-session.use-case.js';
import { makeLogoutUser } from '@fridge/core/src/application/use-cases/auth/logout-user.use-case.js';
import { makeDeleteAccount } from '@fridge/core/src/application/use-cases/auth/delete-account.use-case.js';
import { makeUpdateProfile } from '@fridge/core/src/application/use-cases/auth/update-profile.use-case.js';
import { makeChangePassword } from '@fridge/core/src/application/use-cases/auth/change-password.use-case.js';

import { makeCreateHousehold } from '@fridge/core/src/application/use-cases/household/create-household.use-case.js';
import { makeUpdateHouseholdFeatures } from '@fridge/core/src/application/use-cases/household/update-household-features.use-case.js';
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

import { makeSystemClock } from '@fridge/helper';

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

  const receiptParserPort = config.parserProvider === 'rule-based'
    ? makeRuleBasedParser()
    : makeGeminiTextParser({ apiKey: config.geminiApiKey, model: config.geminiModel });

  // recipeAiEnabled=false ise null kalır — recipe.routes.js bunu görüp 503
  // döner, key eksikken sessizce boot edip runtime'da patlamak yerine.
  const recipeGeneratorPort = config.recipeAiEnabled
    ? makeGeminiRecipeGenerator({ apiKey: config.geminiApiKey, model: config.geminiRecipeModel })
    : null;

  // shoppingAiEnabled=false ise null kalır — shopping.routes.js bunu görüp
  // 503 döner, recipeGeneratorPort ile aynı desen.
  const shoppingSuggesterPort = config.shoppingAiEnabled
    ? makeGeminiShoppingSuggester({ apiKey: config.geminiApiKey, model: config.geminiShoppingModel })
    : null;

  // chefAiEnabled=false ise null kalır — chef.routes.js bunu görüp 503 döner,
  // recipeGeneratorPort ile aynı desen.
  const chefChatPort = config.chefAiEnabled
    ? makeGeminiChefChat({ apiKey: config.geminiApiKey, model: config.geminiChefModel })
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

  const repos = {
    userRepo: makeUserRepository({ rawQuery }),
    sessionRepo: makeSessionRepository({ rawQuery }),
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
  };

  const notifyHousehold = makeNotifyHousehold({
    householdMemberRepo: repos.householdMemberRepo,
    deviceTokenRepo: repos.deviceTokenRepo,
    notificationRepo: repos.notificationRepo,
    notificationPreferenceRepo: repos.notificationPreferenceRepo,
    notificationPort,
  });

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

    createHousehold,
    updateHouseholdFeatures: makeUpdateHouseholdFeatures({ householdRepo: repos.householdRepo }),
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

  return { config, datasource, tokenService, storagePort, notificationPort, repos, useCases };
};

export { buildContainer };
