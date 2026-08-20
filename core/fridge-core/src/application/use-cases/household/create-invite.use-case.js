import crypto from 'node:crypto';

// Alanın kalıcı, çok kullanımlı davet kodu. İDEMPOTENT: aktif bir paylaşımlı
// kod varsa onu döndürür — dialog her açıldığında yeni kod üretmek
// ("kodum her tıklamada değişiyor" şikayetinin kök nedeniydi) artık olmuyor.
// expiresInDays verilmezse süresiz (NULL) üretilir.
const makeCreateInvite = ({ inviteRepo, clock }) => {
  return async ({ householdId, invitedByUserId, invitedEmail = null, expiresInDays = null }) => {
    const existing = await inviteRepo.findActiveSharedByHousehold(householdId);
    if (existing) {
      return existing;
    }

    const code = crypto.randomBytes(6).toString('hex');
    const expiresAt = expiresInDays == null
      ? null
      : new Date(clock.now().getTime() + expiresInDays * 24 * 60 * 60 * 1000);

    return inviteRepo.create({
      householdId,
      code,
      invitedEmail,
      invitedBy: invitedByUserId,
      expiresAt,
      isShared: true,
    });
  };
};

export { makeCreateInvite };
