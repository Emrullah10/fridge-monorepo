import { makeDatasource } from '@fridge/core/src/infrastructure/persistence/datasource.js';
import { makeTokenService } from '@fridge/core/src/infrastructure/token-service.js';
import { makeLocalDiskStorage } from '@fridge/core/src/infrastructure/storage/local-disk.adapter.js';
import { makeTesseractOcr } from '@fridge/core/src/infrastructure/ocr/tesseract.adapter.js';
import { makeGeminiTextParser } from '@fridge/core/src/infrastructure/parser/gemini-text.adapter.js';
import { makeRuleBasedParser } from '@fridge/core/src/infrastructure/parser/rule-based.adapter.js';

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

import { makeRegisterUser } from '@fridge/core/src/application/use-cases/auth/register-user.use-case.js';
import { makeLoginUser } from '@fridge/core/src/application/use-cases/auth/login-user.use-case.js';
import { makeRefreshSession } from '@fridge/core/src/application/use-cases/auth/refresh-session.use-case.js';
import { makeLogoutUser } from '@fridge/core/src/application/use-cases/auth/logout-user.use-case.js';

import { makeCreateHousehold } from '@fridge/core/src/application/use-cases/household/create-household.use-case.js';
import { makeCreateInvite } from '@fridge/core/src/application/use-cases/household/create-invite.use-case.js';
import { makeAcceptInvite } from '@fridge/core/src/application/use-cases/household/accept-invite.use-case.js';
import { makeUpdateHouseholdSettings } from '@fridge/core/src/application/use-cases/household/update-household-settings.use-case.js';

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

  // Tek OCR sağlayıcı: /scan (foto) yolu bunu kullanır. /scan-text zaten
  // ham metinle geldiği için process-receipt-scan.use-case.js OCR portunu
  // hiç çağırmaz — "mlkit-passthrough" diye ayrı bir sağlayıcıya gerek yok,
  // olması kafa karıştırıcı ve imza uyumsuzluğuna (imagePath vs rawText) açıktı.
  const ocrPort = makeTesseractOcr({ storagePort });

  const receiptParserPort = config.parserProvider === 'rule-based'
    ? makeRuleBasedParser()
    : makeGeminiTextParser({ apiKey: config.geminiApiKey, model: config.geminiModel });

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
  };

  const useCases = {
    registerUser: makeRegisterUser({ userRepo: repos.userRepo }),
    loginUser: makeLoginUser({ userRepo: repos.userRepo, sessionRepo: repos.sessionRepo, tokenService }),
    refreshSession: makeRefreshSession({ sessionRepo: repos.sessionRepo, tokenService }),
    logoutUser: makeLogoutUser({ sessionRepo: repos.sessionRepo, tokenService }),

    createHousehold: makeCreateHousehold({
      householdRepo: repos.householdRepo,
      householdMemberRepo: repos.householdMemberRepo,
      storageLocationRepo: repos.storageLocationRepo,
    }),
    createInvite: makeCreateInvite({ inviteRepo: repos.inviteRepo, clock }),
    acceptInvite: makeAcceptInvite({ inviteRepo: repos.inviteRepo, householdMemberRepo: repos.householdMemberRepo, clock }),
    updateHouseholdSettings: makeUpdateHouseholdSettings({ householdRepo: repos.householdRepo }),

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
    }),
    correctLineItem: makeCorrectLineItem({
      receiptLineItemRepo: repos.receiptLineItemRepo,
      productAliasRepo: repos.productAliasRepo,
      productRepo: repos.productRepo,
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
    createRecipe: makeCreateRecipe({ recipeRepo: repos.recipeRepo }),
    getRecipeDetail: makeGetRecipeDetail({ recipeRepo: repos.recipeRepo }),
    cookRecipe: makeCookRecipe({
      datasource,
      recipeRepo: repos.recipeRepo,
      makeInventoryItemRepo: makeInventoryItemRepository,
      makeStockMovementRepo: makeStockMovementRepository,
      makeRecipeCookLogRepo: makeRecipeCookLogRepository,
    }),
  };

  return { config, datasource, tokenService, storagePort, repos, useCases };
};

export { buildContainer };
