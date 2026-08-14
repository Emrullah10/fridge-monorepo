import crypto from 'node:crypto';

const INVITE_TTL_DAYS = 7;

const makeCreateInvite = ({ inviteRepo, clock }) => {
  return async ({ householdId, invitedByUserId, invitedEmail = null }) => {
    const code = crypto.randomBytes(6).toString('hex');
    const expiresAt = new Date(clock.now().getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    return inviteRepo.create({
      householdId,
      code,
      invitedEmail,
      invitedBy: invitedByUserId,
      expiresAt,
    });
  };
};

export { makeCreateInvite };
