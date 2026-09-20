import { assertHouseholdUsableForConversation } from './assert-household-usable-for-conversation.js';

const VALID_MODES = new Set(['food', 'repair', 'general']);

// POST /assistant/conversations — householdId verilmişse yaratmadan ÖNCE
// üyelik + kilit kontrolü uygulanır (bkz. plan §C2 son paragraf), mantığın
// kendisi assert-household-usable-for-conversation.js'de — updateConversation
// da aynı fonksiyonu kullanır (bkz. o dosyanın üstündeki not).
const makeCreateConversation = ({ conversationRepo, householdMemberRepo, resolveLockedHouseholdIds, getEntitlements, listMembershipsWithJoinedAt }) => {
  return async ({ userId, householdId = null, mode = 'general', platform = null }) => {
    const resolvedMode = VALID_MODES.has(mode) ? mode : 'general';

    await assertHouseholdUsableForConversation({
      householdId,
      userId,
      platform,
      householdMemberRepo,
      resolveLockedHouseholdIds,
      getEntitlements,
      listMembershipsWithJoinedAt,
    });

    return conversationRepo.create({ userId, householdId, mode: resolvedMode });
  };
};

export { makeCreateConversation };
