import { Router } from 'express';
import { buildAuthRouter } from './auth.routes.js';
import { buildHouseholdRouter } from './household.routes.js';
import { buildInviteRouter } from './invite.routes.js';
import { buildInventoryRouter } from './inventory.routes.js';
import { buildReceiptRouter } from './receipt.routes.js';
import { buildRecipeRouter } from './recipe.routes.js';
import { buildProductRouter } from './product.routes.js';
import { buildDeviceRouter, buildNotificationRouter } from './notification.routes.js';

const buildRouter = ({ container, authenticate }) => {
  const router = Router();

  router.use(authenticate);

  router.use('/auth', buildAuthRouter({ container }));
  router.use('/households', buildHouseholdRouter({ container }));
  router.use('/invites', buildInviteRouter({ container }));
  router.use('/households/:householdId/inventory', buildInventoryRouter({ container }));
  router.use('/households/:householdId/receipts', buildReceiptRouter({ container }));
  router.use('/households/:householdId/recipes', buildRecipeRouter({ container }));
  router.use('/households/:householdId/products', buildProductRouter({ container }));
  router.use('/devices', buildDeviceRouter({ container }));
  router.use('/notifications', buildNotificationRouter({ container }));

  return router;
};

export { buildRouter };
