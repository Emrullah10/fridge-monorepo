import { ValidationError } from '@fridge/errors';
import { mergeDietConstraints } from '../../../domain/nutrition.js';

const MAX_MESSAGE_LEN = 2000;

// AI Chef sohbeti — kullanıcının mesajını kaydeder, mutfak bağlamını toplar,
// modeli çağırır, cevabı kaydeder. Öneri çipleri (suggestedShoppingItems)
// ASLA doğrudan listeye yazılmaz — sadece döndürülür, kullanıcı çipe basınca
// mevcut add-shopping-item akışı normal yoldan çalışır (halüsinasyon savunması,
// suggest-ai-shopping-items deseni).
const makeSendChefMessage = ({
  chefChatRepo,
  inventoryItemRepo,
  shoppingListRepo,
  recipeCookLogRepo,
  householdMemberRepo,
  chefChatPort,
  clock,
}) => {
  return async ({ householdId, userId, message, isGuest = false }) => {
    const text = typeof message === 'string' ? message.trim() : '';
    if (!text) throw new ValidationError('Mesaj boş olamaz');
    if (text.length > MAX_MESSAGE_LEN) {
      throw new ValidationError(`Mesaj çok uzun (en fazla ${MAX_MESSAGE_LEN} karakter)`);
    }

    await chefChatRepo.append({ householdId, userId, role: 'user', content: text });
    const history = await chefChatRepo.listRecent({ householdId, limit: 20 });

    // Mutfak bağlamı — hepsi mevcut repo metodları, yeni sorgu yok.
    const now = clock.now();
    const soonCutoff = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const [inventory, expiring, shoppingList, cookLog, dietProfiles] = await Promise.all([
      inventoryItemRepo.listByHousehold(householdId),
      inventoryItemRepo.listExpiringBefore(householdId, soonCutoff),
      shoppingListRepo.getOrCreateActiveList({ householdId, userId })
        .then((list) => shoppingListRepo.listItems(list.id)),
      recipeCookLogRepo.listByHousehold(householdId, { limit: 8 }),
      householdMemberRepo?.listDietProfiles
        ? householdMemberRepo.listDietProfiles(householdId)
        : Promise.resolve([]),
    ]);

    const kitchen = {
      inventory: inventory
        .filter((it) => it.quantity > 0)
        .map((it) => ({
          name: it.productName,
          brand: it.productBrand ?? null,
          quantity: it.quantity,
          unit: it.unit,
          categoryKey: it.categoryId ?? null,
          expiresAt: it.expiresAt,
        })),
      expiringSoon: expiring.map((it) => ({
        name: it.productName,
        expiresAt: it.expiresAt,
        daysLeft: it.expiresAt
          ? Math.ceil((new Date(it.expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
          : null,
      })),
      shoppingList: shoppingList.map((s) => ({ name: s.name })),
      recentlyCooked: cookLog.map((c) => ({ title: c.recipeTitle, cookedAt: c.cookedAt })),
      diet: mergeDietConstraints(dietProfiles),
    };

    const { reply, suggestedShoppingItems } = await chefChatPort.reply({
      history,
      kitchen,
      context: { userId, householdId, isGuest },
    });

    const saved = await chefChatRepo.append({
      householdId,
      userId: null,
      role: 'assistant',
      content: reply,
    });

    return {
      message: saved,
      suggestedShoppingItems: suggestedShoppingItems ?? [],
    };
  };
};

export { makeSendChefMessage };
