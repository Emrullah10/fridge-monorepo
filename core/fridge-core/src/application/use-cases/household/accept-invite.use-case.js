import { NotFoundError } from '@fridge/errors';
import { InviteExpiredError, InviteAlreadyUsedError } from '../../../domain/errors/index.js';
import { NOTIFICATION_TYPES } from '../../../domain/notification-types.js';

// addMember + invite.updateStatus tek transaction'da: önceden ayrı ayrı
// çalışıyordu — addMember başarılı olup updateStatus patlarsa kod tükenmiş
// ama hâlâ 'pending' kalırdı (kullanıcı üye olur ama kodu tekrar kullanmaya
// çalışabilirdi). Bildirim COMMIT'TEN SONRA gönderilir: push geri
// alınamaz, rollback olacak bir katılımı duyurmak yanlış olur.
const makeAcceptInvite = ({
  datasource,
  makeInviteRepo,
  makeHouseholdMemberRepo,
  householdRepo,
  userRepo,
  notifyHousehold,
  clock,
}) => {
  return async ({ code, userId }) => {
    let householdId;
    let didJoin = false;

    await datasource.withTransaction(async ({ query }) => {
      const inviteRepo = makeInviteRepo({ rawQuery: query });
      const householdMemberRepo = makeHouseholdMemberRepo({ rawQuery: query });

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
        didJoin = true;
      }

      await inviteRepo.updateStatus(invite.id, 'accepted');
      householdId = invite.householdId;
    });

    // Yalnızca gerçekten yeni bir üyelik oluştuysa bildir — eski (zaten
    // kabul edilmiş) bir kodu tekrar kabul etmek herkesi yeniden spam'lemesin.
    if (didJoin) {
      const [household, actor] = await Promise.all([
        householdRepo.findById(householdId),
        userRepo.findById(userId),
      ]);
      await notifyHousehold({
        householdId,
        type: NOTIFICATION_TYPES.MEMBER_JOINED,
        excludeUserId: userId,
        context: {
          actorName: actor.displayName ?? actor.email,
          householdName: household.name,
          householdId,
        },
        dedupeKey: `member_joined:${householdId}:${userId}`,
      });
    }

    return { householdId };
  };
};

export { makeAcceptInvite };
