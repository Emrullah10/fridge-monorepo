import { NotFoundError } from '@fridge/errors';
import { InviteExpiredError, InviteAlreadyUsedError } from '../../../domain/errors/index.js';

const makeAcceptInvite = ({ inviteRepo, householdMemberRepo, clock }) => {
  return async ({ code, userId }) => {
    const invite = await inviteRepo.findByCode(code);
    if (!invite) {
      throw new NotFoundError('Invite not found');
    }

    if (invite.status !== 'pending') {
      throw new InviteAlreadyUsedError();
    }

    if (invite.expiresAt.getTime() < clock.now().getTime()) {
      await inviteRepo.updateStatus(invite.id, 'expired');
      throw new InviteExpiredError();
    }

    const existingMembership = await householdMemberRepo.findMembership({
      householdId: invite.householdId,
      userId,
    });

    if (!existingMembership) {
      await householdMemberRepo.addMember({
        householdId: invite.householdId,
        userId,
        role: 'member',
      });
    }

    await inviteRepo.updateStatus(invite.id, 'accepted');

    return { householdId: invite.householdId };
  };
};

export { makeAcceptInvite };
