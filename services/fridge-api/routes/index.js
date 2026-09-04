import { Router } from 'express';
import { requireAuth, requireUnlockedHousehold, clientPlatform } from '@fridge/middlewares';
import { resolveLockedHouseholdIds } from '@fridge/core/src/domain/access-lock.js';
import { buildAuthRouter } from './auth.routes.js';
import { buildHouseholdRouter } from './household.routes.js';
import { buildInviteRouter } from './invite.routes.js';
import { buildInventoryRouter } from './inventory.routes.js';
import { buildReceiptRouter } from './receipt.routes.js';
import { buildRecipeRouter } from './recipe.routes.js';
import { buildShoppingRouter } from './shopping.routes.js';
import { buildProductRouter } from './product.routes.js';
import { buildInsightsRouter } from './insights.routes.js';
import { buildChefRouter } from './chef.routes.js';
import { buildDeviceRouter, buildNotificationRouter } from './notification.routes.js';
import { buildBillingRouter } from './billing.routes.js';

const buildRouter = ({ container, authenticate }) => {
  const router = Router();

  router.use(authenticate);
  // req.clientPlatform — bkz. plan §Faz D, getEntitlements çağıran her yer
  // (requireCapability/requireStructuralLimit/requirePlanFeature/receipt
  // özel kapısı/billing route'u) bunu okuyup platforma göre limit çözer.
  router.use(clientPlatform());

  router.use('/auth', buildAuthRouter({ container }));
  router.use('/households', buildHouseholdRouter({ container }));
  router.use('/invites', buildInviteRouter({ container }));

  // Düşüş kilidi (bkz. plan §Faz C) — household.count limitinin üstünde
  // kalan alanların TÜM alt uçlarına (envanter/fiş/tarif/alışveriş/ürün/
  // analiz/şef) tek middleware'den 402 HOUSEHOLD_LOCKED uygulanır. household.
  // routes.js'in KENDİ /:householdId/* alt yolları (features, locations) bu
  // mount'un dışında kaldığı için requireAuth burada AYRICA gerekir (alt
  // router'lar zaten kendi requireAuth()'unu çağırıyor ama bu middleware
  // onlardan ÖNCE, req.user'a ihtiyaç duyuyor).
  const unlockedHouseholdGate = [
    requireAuth(),
    requireUnlockedHousehold({
      getEntitlements: container.useCases.getEntitlements,
      listMembershipsWithJoinedAt: (userId) => container.repos.householdRepo.findMembershipsWithJoinedAtByUserId(userId),
      resolveLockedIds: resolveLockedHouseholdIds,
    }),
  ];

  router.use('/households/:householdId/inventory', unlockedHouseholdGate, buildInventoryRouter({ container }));
  router.use('/households/:householdId/receipts', unlockedHouseholdGate, buildReceiptRouter({ container }));
  router.use('/households/:householdId/recipes', unlockedHouseholdGate, buildRecipeRouter({ container }));
  router.use('/households/:householdId/shopping-list', unlockedHouseholdGate, buildShoppingRouter({ container }));
  router.use('/households/:householdId/products', unlockedHouseholdGate, buildProductRouter({ container }));
  router.use('/households/:householdId/insights', unlockedHouseholdGate, buildInsightsRouter({ container }));
  router.use('/households/:householdId/chef', unlockedHouseholdGate, buildChefRouter({ container }));
  router.use('/devices', buildDeviceRouter({ container }));
  router.use('/notifications', buildNotificationRouter({ container }));
  router.use('/', buildBillingRouter({ container })); // /me/entitlements, /me/subscription/manage-url

  return router;
};

export { buildRouter };
