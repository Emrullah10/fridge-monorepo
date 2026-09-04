import { NotFoundError, PaymentRequiredError } from '@fridge/errors';
import { InviteExpiredError, InviteAlreadyUsedError } from '../../../domain/errors/index.js';
import { NOTIFICATION_TYPES } from '../../../domain/notification-types.js';
import { isSubscriptionCurrentlyActive } from '../../../domain/entitlements.js';
import { PLAN } from '../../../domain/plans.js';

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
  // Üye sayısı sınırını (alan SAHİBİNİN planına göre) aynı transaction
  // içinde kontrol etmek için — race condition'a karşı güvenli (iki davet
  // aynı anda kabul edilirse ikisi de aynı transaction sırasına girer).
  // planLimitsByPlan opsiyonel: verilmezse limit kontrolü atlanır (geriye
  // dönük güvenli, mevcut testler kırılmaz).
  planLimitsByPlan,
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

      // Paylaşımlı (alana-sabit) kodlar 'pending' dışındaysa (revoked/expired)
      // reddedilir ama başarıyla kullanılınca TÜKETİLMEZ — birden fazla kişi
      // aynı kodla katılabilsin diye. Tek kullanımlık eski kodlar (isShared
      // false — geriye dönük uyumluluk) hâlâ 'accepted' yazılıp tüketilir.
      if (invite.status !== 'pending') {
        throw new InviteAlreadyUsedError();
      }

      if (invite.expiresAt && invite.expiresAt.getTime() < clock.now().getTime()) {
        if (!invite.isShared) {
          await inviteRepo.updateStatus(invite.id, 'expired');
        }
        throw new InviteExpiredError();
      }

      const existingMembership = await householdMemberRepo.findMembership({
        householdId: invite.householdId,
        userId,
      });

      if (!existingMembership) {
        if (planLimitsByPlan) {
          const members = await householdMemberRepo.listMembers(invite.householdId);
          const owner = members.find((m) => m.role === 'owner');
          const ownerSubscription = owner
            ? await householdMemberRepo.listOwnerSubscriptionsForUser(owner.userId)
              .then((rows) => rows.find((row) => row.householdId === invite.householdId))
            : null;
          const ownerIsPremium = ownerSubscription
            ? isSubscriptionCurrentlyActive(
              { status: ownerSubscription.ownerSubscriptionStatus, currentPeriodEnd: ownerSubscription.ownerCurrentPeriodEnd },
              clock.now(),
            )
            : false;
          const ownerPlan = ownerIsPremium ? PLAN.PREMIUM : PLAN.FREE;
          const maxMembers = planLimitsByPlan[ownerPlan].member.perHousehold;
          if (maxMembers !== null && members.length >= maxMembers) {
            throw new PaymentRequiredError('Bu alanda üye sayısı sınırına ulaşıldı.', { code: 'PLAN_LIMIT_REACHED' });
          }
        }

        await householdMemberRepo.addMember({
          householdId: invite.householdId,
          userId,
          role: 'member',
        });
        didJoin = true;
      }

      if (!invite.isShared) {
        await inviteRepo.updateStatus(invite.id, 'accepted');
      }
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
