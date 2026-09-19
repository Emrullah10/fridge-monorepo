import { NotFoundError } from '@fridge/errors';
import { asyncHandler } from '@fridge/helper';
import { requireHouseholdRole, requireUnlockedHousehold } from '@fridge/middlewares';
import { resolveLockedHouseholdIds } from '@fridge/core/src/domain/access-lock.js';

// assistant.routes.js kök seviyede mount edildiği için (bkz. plan §C2)
// sahiplik path'ten DEĞİL kayıttan gelir. Üç kontrol yapar:
//  1. conversation.userId === req.user.id  -> değilse 404 (403 DEĞİL, ID
//     varlığı sızdırılmasın, assert-owned-by-household.js deseni)
//  2. conversation.householdId doluysa      -> o alana üyelik
//     (requireHouseholdRole yeniden kullanılır, req.params.householdId
//     conversation'dan enjekte edilerek)
//  3. Düşüş kilidi                          -> kilitli alansa 402
//     HOUSEHOLD_LOCKED (requireUnlockedHousehold yeniden kullanılır, elle
//     yazılmaz — aksi halde asistan kilitli alanın envanterini okuyan bir
//     arka kapı olur, bkz. plan "Riskli noktalar" #1).
const makeLoadConversation = ({ container }) => {
  const { repos, useCases } = container;

  const roleGate = requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'viewer' });
  const lockGate = requireUnlockedHousehold({
    getEntitlements: useCases.getEntitlements,
    listMembershipsWithJoinedAt: (userId) => repos.householdRepo.findMembershipsWithJoinedAtByUserId(userId),
    resolveLockedIds: resolveLockedHouseholdIds,
  });

  return asyncHandler(async (req, res, next) => {
    const conversation = await repos.assistantConversationRepo.findById(req.params.conversationId ?? req.params.id);

    if (!conversation || conversation.userId !== req.user.id) {
      throw new NotFoundError('Conversation not found');
    }

    req.conversation = conversation;

    if (!conversation.householdId) {
      return next();
    }

    // requireHouseholdRole/requireUnlockedHousehold req.params.householdId
    // okuyor (path parametresi ile aynı sözleşme) — conversation'daki
    // household_id'yi geçici olarak params'a enjekte ederek elle mantık
    // YAZMADAN yeniden kullanıyoruz.
    req.params.householdId = conversation.householdId;

    roleGate(req, res, (err) => {
      if (err) return next(err);
      lockGate(req, res, next);
    });
  });
};

export { makeLoadConversation };
