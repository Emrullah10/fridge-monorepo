import { NotFoundError } from '@fridge/errors';
import { assertHouseholdUsableForConversation } from './assert-household-usable-for-conversation.js';

// PATCH /assistant/conversations/:id — önceden householdId doğrudan
// repo.update()'e geçiyordu, createConversation'daki üyelik+kilit kontrolü
// burada YOKTU (bkz. IDOR bulgusu: bir kullanıcı kendi konuşmasını üye
// olmadığı bir evin id'sine bağlayabiliyordu — loadConversation ikinci bir
// kapı olarak veri sızıntısını engelliyordu, ama kayıt tutarsız bir duruma
// düşebiliyordu). Artık create ile aynı assertHouseholdUsableForConversation
// çağrılır — yalnızca householdId GERÇEKTEN değiştirilmek istendiğinde
// (undefined değilse), title/mode güncellemeleri gereksiz sorguya girmez.
const makeUpdateConversation = ({
  conversationRepo,
  householdMemberRepo,
  resolveLockedHouseholdIds,
  getEntitlements,
  listMembershipsWithJoinedAt,
}) => {
  return async ({ conversationId, userId, platform = null, title, householdId, mode }) => {
    if (householdId !== undefined) {
      await assertHouseholdUsableForConversation({
        householdId,
        userId,
        platform,
        householdMemberRepo,
        resolveLockedHouseholdIds,
        getEntitlements,
        listMembershipsWithJoinedAt,
      });
    }

    const updated = await conversationRepo.update(conversationId, { title, householdId, mode });
    if (!updated) {
      throw new NotFoundError('Conversation not found');
    }
    return updated;
  };
};

export { makeUpdateConversation };
