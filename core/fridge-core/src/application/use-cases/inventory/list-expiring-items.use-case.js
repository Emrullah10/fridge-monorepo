const DEFAULT_WINDOW_DAYS = 5;

const makeListExpiringItems = ({ inventoryItemRepo, clock }) => {
  return async ({ householdId, withinDays = DEFAULT_WINDOW_DAYS }) => {
    const beforeDate = new Date(clock.now().getTime() + withinDays * 24 * 60 * 60 * 1000);
    return inventoryItemRepo.listExpiringBefore(householdId, beforeDate);
  };
};

export { makeListExpiringItems };
