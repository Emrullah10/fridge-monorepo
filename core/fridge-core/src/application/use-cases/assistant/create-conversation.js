import { ValidationError, NotFoundError, PaymentRequiredError } from '@fridge/errors';

const VALID_MODES = new Set(['food', 'repair', 'general']);

// POST /assistant/conversations — householdId verilmişse yaratmadan ÖNCE
// aynı kontroller uygulanır (üyelik + kilit), bkz. plan §C2 son paragraf.
const makeCreateConversation = ({ conversationRepo, householdMemberRepo, resolveLockedHouseholdIds, getEntitlements, listMembershipsWithJoinedAt }) => {
  return async ({ userId, householdId = null, mode = 'general', platform = null }) => {
    const resolvedMode = VALID_MODES.has(mode) ? mode : 'general';

    if (householdId) {
      const membership = await householdMemberRepo.findMembership({ householdId, userId });
      if (!membership) {
        throw new NotFoundError('Household not found');
      }

      const entitlements = await getEntitlements({ userId, platform });
      const limit = entitlements.householdCountLimit;
      if (limit !== null && limit !== undefined) {
        const memberships = await listMembershipsWithJoinedAt(userId);
        const lockedIds = resolveLockedHouseholdIds({ memberships, limit });
        if (lockedIds.has(householdId)) {
          throw new PaymentRequiredError(
            'Bu alan plan sınırın dışında kaldı, verilerin silinmedi. Premium ile tekrar açabilirsin.',
            { code: 'HOUSEHOLD_LOCKED' },
          );
        }
      }
    }

    return conversationRepo.create({ userId, householdId, mode: resolvedMode });
  };
};

export { makeCreateConversation };
