import { NotFoundError } from '@fridge/errors';

// Route params'taki householdId ile kaydın gerçek household_id'si eşleşmiyorsa
// NotFoundError fırlatır. requireHouseholdRole kullanıcının BİR eve üye
// olduğunu doğruluyor, ama kaydın O eve ait olduğunu doğrulamıyor — bu
// fonksiyon o boşluğu kapatır (IDOR: başka evin kaydına erişim).
// 404 dönülür (403 değil) — kaydın var olduğunu bile sızdırmamak için.
const assertOwnedByHousehold = (record, householdId, notFoundMessage) => {
  if (!record || record.householdId !== householdId) {
    throw new NotFoundError(notFoundMessage);
  }
  return record;
};

export { assertOwnedByHousehold };
