// Yalnızca sahip (route seviyesinde requireHouseholdRole minRole:'owner' ile
// zaten garanti ediliyor) çağırabilir. household.deleteById CASCADE ile
// storage_location/inventory_item/receipt_scan/household_member/
// household_invite'ı da temizler (bkz. db-schemas/01-identity-schema.sql).
// Geri dönüşü yoktur — route seviyesinde onay UI'da alınmalı.
const makeDeleteHousehold = ({ householdRepo }) => {
  return async ({ householdId }) => {
    await householdRepo.deleteById(householdId);
  };
};

export { makeDeleteHousehold };
