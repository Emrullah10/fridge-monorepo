import { mergeDietConstraints } from '../../../domain/nutrition.js';
import { resolveFeatures } from '../../../domain/household-profile.js';

// send-chef-message.use-case.js:30-65'in genellemesi (bkz. plan §C5, adım 6).
// householdId null ise ÇAĞRILMAZ — use-case seviyesinde atlanır (bkz.
// send-assistant-message.use-case.js). foodEnabled false ise recipeCookLogRepo
// ve listDietProfiles sorguları da atlanır (yemek dışı alanda anlamsız).
const makeBuildAreaContext = ({
  householdRepo,
  inventoryItemRepo,
  shoppingListRepo,
  recipeCookLogRepo,
  householdMemberRepo,
  clock,
}) => {
  return async ({ householdId, userId }) => {
    const household = await householdRepo.findById(householdId);
    const { food: foodEnabled } = resolveFeatures(household);

    const now = clock.now();
    const soonCutoff = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    const [inventory, expiring, shoppingList, cookLog, dietProfiles] = await Promise.all([
      inventoryItemRepo.listByHousehold(householdId),
      inventoryItemRepo.listExpiringBefore(householdId, soonCutoff),
      shoppingListRepo.getOrCreateActiveList({ householdId, userId })
        .then((list) => shoppingListRepo.listItems(list.id)),
      foodEnabled ? recipeCookLogRepo.listByHousehold(householdId, { limit: 8 }) : Promise.resolve([]),
      foodEnabled && householdMemberRepo?.listDietProfiles
        ? householdMemberRepo.listDietProfiles(householdId)
        : Promise.resolve([]),
    ]);

    const area = {
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
      recentlyCooked: foodEnabled ? cookLog.map((c) => ({ title: c.recipeTitle, cookedAt: c.cookedAt })) : [],
      diet: foodEnabled ? mergeDietConstraints(dietProfiles) : null,
    };

    return { area, household, foodEnabled };
  };
};

export { makeBuildAreaContext };
