import { NotFoundError, PaymentRequiredError } from '@fridge/errors';

// Bir konuşmaya householdId bağlanırken (yaratılırken YA DA güncellenirken)
// uygulanması gereken tek kontrol: kullanıcı gerçekten o evin üyesi mi ve
// alan plan sınırı yüzünden kilitli mi. Önceden bu mantık yalnızca
// create-conversation.js'de vardı — updateConversation aynı alana bağlanma
// işlemini kontrolsüz yapıyordu (bkz. IDOR bulgusu: bir kullanıcı PATCH ile
// kendi konuşmasını üye olmadığı bir evin id'sine bağlayabiliyordu).
// loadConversation middleware'i bu bağlantı KURULDUKTAN SONRA üyeliği
// doğruluyor (bu yüzden veri sızıntısı yoktu — bkz. audit), ama kayıt
// tutarsız bir duruma düşebiliyordu ve create/update arasındaki asimetri
// gelecekte başka bir kontrolsüz yol açılmasına zemin hazırlıyordu.
const assertHouseholdUsableForConversation = async ({
  householdId,
  userId,
  platform,
  householdMemberRepo,
  resolveLockedHouseholdIds,
  getEntitlements,
  listMembershipsWithJoinedAt,
}) => {
  if (!householdId) return;

  const membership = await householdMemberRepo.findMembership({ householdId, userId });
  if (!membership) {
    throw new NotFoundError('Household not found');
  }

  const entitlements = await getEntitlements({ userId, platform });
  const limit = entitlements.householdCountLimit;
  if (limit === null || limit === undefined) return;

  const memberships = await listMembershipsWithJoinedAt(userId);
  const lockedIds = resolveLockedHouseholdIds({ memberships, limit });
  if (lockedIds.has(householdId)) {
    throw new PaymentRequiredError(
      'Bu alan plan sınırın dışında kaldı, verilerin silinmedi. Premium ile tekrar açabilirsin.',
      { code: 'HOUSEHOLD_LOCKED' },
    );
  }
};

export { assertHouseholdUsableForConversation };
