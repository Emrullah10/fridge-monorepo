import { Router } from 'express';
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

  router.use('/auth', buildAuthRouter({ container }));
  router.use('/households', buildHouseholdRouter({ container }));
  router.use('/invites', buildInviteRouter({ container }));
  router.use('/households/:householdId/inventory', buildInventoryRouter({ container }));
  router.use('/households/:householdId/receipts', buildReceiptRouter({ container }));
  router.use('/households/:householdId/recipes', buildRecipeRouter({ container }));
  router.use('/households/:householdId/shopping-list', buildShoppingRouter({ container }));
  router.use('/households/:householdId/products', buildProductRouter({ container }));
  router.use('/households/:householdId/insights', buildInsightsRouter({ container }));
  router.use('/households/:householdId/chef', buildChefRouter({ container }));
  router.use('/devices', buildDeviceRouter({ container }));
  router.use('/notifications', buildNotificationRouter({ container }));
  router.use('/', buildBillingRouter({ container })); // /me/entitlements, /me/subscription/manage-url

  return router;
};

export { buildRouter };
