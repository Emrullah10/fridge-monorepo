import { household, emptyHousehold } from './household';
import { inventory, emptyInventory } from './inventory';
import { receipt } from './receipt';
import { shopping, emptyShopping } from './shopping';
import { recipes } from './recipes';
import { chef } from './chef';
import { insights, emptyInsights } from './insights';
import { notifications, emptyNotifications } from './notifications';

/**
 * @typedef {Object} Seed
 * @property {'full'|'empty'} mode
 * @property {import('./household').Household} household
 * @property {import('./inventory').InventoryItem[]} inventory
 * @property {import('./receipt').Receipt} receipt
 * @property {import('./shopping').ShoppingItem[]} shopping
 * @property {import('./recipes').Recipe[]} recipes
 * @property {import('./chef').ChefMessage[]} chef
 * @property {import('./insights').Insights[]} insights
 * @property {import('./notifications').AppNotification[]} notifications
 */

/**
 * Tüm maketlerin tükettiği tek veri kaynağı. Ağa hiç çıkılmaz.
 * @param {'full'|'empty'} [mode]
 * @returns {Seed}
 */
export function getSeed(mode = 'full') {
  if (mode === 'empty') {
    return {
      mode,
      household: emptyHousehold,
      inventory: emptyInventory,
      receipt: { ...receipt, lines: [] },
      shopping: emptyShopping,
      recipes: [],
      chef: [],
      insights: emptyInsights,
      notifications: emptyNotifications,
    };
  }
  return {
    mode,
    household,
    inventory,
    receipt,
    shopping,
    recipes,
    chef,
    insights,
    notifications,
  };
}
