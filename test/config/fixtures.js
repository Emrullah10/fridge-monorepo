import crypto from 'node:crypto';
import { rawQuery } from './db-client.js';

// Her testte benzersiz email üretir — testler paralel çalışsa bile çakışmaz.
const uniqueEmail = (label) => `${label}-${crypto.randomUUID()}@test.local`;

const createTestUser = async (label = 'user') => {
  const { rows } = await rawQuery(
    `INSERT INTO app_user (email, password_hash, display_name)
     VALUES ($1, 'x', $2) RETURNING id`,
    [uniqueEmail(label), label],
  );
  return rows[0].id;
};

const createTestHousehold = async (ownerId, name = 'Test Ev') => {
  const { rows } = await rawQuery(
    `INSERT INTO household (name, created_by) VALUES ($1, $2) RETURNING id`,
    [name, ownerId],
  );
  const householdId = rows[0].id;
  await rawQuery(
    `INSERT INTO household_member (household_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [householdId, ownerId],
  );
  return householdId;
};

const createTestStorageLocation = async (householdId, kind = 'fridge') => {
  const { rows } = await rawQuery(
    `INSERT INTO storage_location (household_id, name, kind) VALUES ($1, $2, $3) RETURNING id`,
    [householdId, kind, kind],
  );
  return rows[0].id;
};

const createTestProduct = async (householdId, canonicalName = 'Test Ürün', defaultUnit = 'piece', { brand = null, categoryId = null } = {}) => {
  const { rows } = await rawQuery(
    `INSERT INTO product (household_id, canonical_name, default_unit, brand, category_id, is_global, source)
     VALUES ($1, $2, $3, $4, $5, false, 'user') RETURNING id`,
    [householdId, canonicalName, defaultUnit, brand, categoryId],
  );
  return rows[0].id;
};

const findCategoryIdByKey = async (key) => {
  const { rows } = await rawQuery('SELECT id FROM product_category WHERE key = $1', [key]);
  return rows[0]?.id ?? null;
};

const createStockMovement = async ({ householdId, inventoryItemId, productId, delta, reason, createdAt, unitPrice = null, actorUserId = null }) => {
  await rawQuery(
    `INSERT INTO stock_movement (household_id, inventory_item_id, product_id, delta, reason, created_at, unit_price, actor_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [householdId, inventoryItemId, productId, delta, reason, createdAt, unitPrice, actorUserId],
  );
};

export {
  createTestUser,
  createTestHousehold,
  createTestStorageLocation,
  createTestProduct,
  findCategoryIdByKey,
  createStockMovement,
};
