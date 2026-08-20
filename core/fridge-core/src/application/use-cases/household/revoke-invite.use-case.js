// "Kodu yenile": mevcut paylaşımlı kodu iptal eder. Bir sonraki
// createInvite çağrısı aktif kod bulamayıp yenisini üretir.
const makeRevokeInvite = ({ inviteRepo }) => {
  return async ({ householdId }) => {
    await inviteRepo.revokeSharedByHousehold(householdId);
  };
};

export { makeRevokeInvite };
