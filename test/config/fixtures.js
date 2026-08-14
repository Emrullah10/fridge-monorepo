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

const createTestProduct = async (householdId, canonicalName = 'Test Ürün', defaultUnit = 'piece') => {
  const { rows } = await rawQuery(
    `INSERT INTO product (household_id, canonical_name, default_unit, is_global, source)
     VALUES ($1, $2, $3, false, 'user') RETURNING id`,
    [householdId, canonicalName, defaultUnit],
  );
  return rows[0].id;
};

export { createTestUser, createTestHousehold, createTestStorageLocation, createTestProduct };
