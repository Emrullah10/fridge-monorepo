import { products } from './products';

/**
 * @typedef {'normal'|'soon'|'expired'|'none'} ExpiryStatus
 * @typedef {Object} InventoryItem
 * @property {string} id
 * @property {import('./products').Product} product
 * @property {string} storageLocationId
 * @property {number} quantity
 * @property {string} unit
 * @property {string} [expiresAt]
 * @property {ExpiryStatus} expiryStatus
 * @property {boolean} isFinished
 * @property {number} [unitPrice]
 */

const P = Object.fromEntries(products.map((p) => [p.id, p]));

function daysFromNow(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** @type {InventoryItem[]} — 24 kalem: 3 geçmiş SKT, 4 yaklaşan, 2 bitti, gerisi normal */
export const inventory = [
  // Buzdolabı (sl-fridge)
  { id: 'i-1', product: P['p-1'], storageLocationId: 'sl-fridge', quantity: 1, unit: 'lt', expiresAt: daysFromNow(4), expiryStatus: 'normal', isFinished: false, unitPrice: 42.9 },
  { id: 'i-2', product: P['p-2'], storageLocationId: 'sl-fridge', quantity: 1, unit: 'adet', expiresAt: daysFromNow(2), expiryStatus: 'soon', isFinished: false, unitPrice: 59.5 },
  { id: 'i-3', product: P['p-3'], storageLocationId: 'sl-fridge', quantity: 1, unit: 'adet', expiresAt: daysFromNow(-1), expiryStatus: 'expired', isFinished: false, unitPrice: 89.0 },
  { id: 'i-4', product: P['p-4'], storageLocationId: 'sl-fridge', quantity: 6, unit: 'adet', expiresAt: daysFromNow(12), expiryStatus: 'normal', isFinished: false, unitPrice: 3.5 },
  { id: 'i-5', product: P['p-5'], storageLocationId: 'sl-fridge', quantity: 1, unit: 'adet', expiresAt: daysFromNow(20), expiryStatus: 'normal', isFinished: false, unitPrice: 65.0 },
  { id: 'i-6', product: P['p-6'], storageLocationId: 'sl-fridge', quantity: 0, unit: 'kg', expiryStatus: 'none', isFinished: true, unitPrice: 189.9 },
  { id: 'i-7', product: P['p-9'], storageLocationId: 'sl-fridge', quantity: 1.2, unit: 'kg', expiresAt: daysFromNow(3), expiryStatus: 'normal', isFinished: false, unitPrice: 24.9 },
  { id: 'i-8', product: P['p-10'], storageLocationId: 'sl-fridge', quantity: 0.5, unit: 'kg', expiresAt: daysFromNow(1), expiryStatus: 'soon', isFinished: false, unitPrice: 18.5 },
  { id: 'i-9', product: P['p-13'], storageLocationId: 'sl-fridge', quantity: 1, unit: 'adet', expiresAt: daysFromNow(-3), expiryStatus: 'expired', isFinished: false, unitPrice: 14.9 },
  { id: 'i-10', product: P['p-25'], storageLocationId: 'sl-fridge', quantity: 1, unit: 'lt', expiresAt: daysFromNow(45), expiryStatus: 'normal', isFinished: false, unitPrice: 39.9 },
  { id: 'i-11', product: P['p-38'], storageLocationId: 'sl-fridge', quantity: 1, unit: 'adet', expiresAt: daysFromNow(180), expiryStatus: 'normal', isFinished: false, unitPrice: 129.9 },
  { id: 'i-12', product: P['p-40'], storageLocationId: 'sl-fridge', quantity: 0, unit: 'adet', expiryStatus: 'none', isFinished: true, unitPrice: 54.9 },

  // Dondurucu (sl-freezer)
  { id: 'i-13', product: P['p-29'], storageLocationId: 'sl-freezer', quantity: 1, unit: 'kg', expiresAt: daysFromNow(90), expiryStatus: 'normal', isFinished: false, unitPrice: 45.0 },
  { id: 'i-14', product: P['p-30'], storageLocationId: 'sl-freezer', quantity: 1, unit: 'adet', expiresAt: daysFromNow(120), expiryStatus: 'normal', isFinished: false, unitPrice: 52.9 },
  { id: 'i-15', product: P['p-31'], storageLocationId: 'sl-freezer', quantity: 1, unit: 'lt', expiresAt: daysFromNow(60), expiryStatus: 'normal', isFinished: false, unitPrice: 79.9 },
  { id: 'i-16', product: P['p-7'], storageLocationId: 'sl-freezer', quantity: 0.5, unit: 'kg', expiresAt: daysFromNow(3), expiryStatus: 'soon', isFinished: false, unitPrice: 249.9 },
  { id: 'i-17', product: P['p-8'], storageLocationId: 'sl-freezer', quantity: 1, unit: 'adet', expiresAt: daysFromNow(30), expiryStatus: 'normal', isFinished: false, unitPrice: 69.9 },
  { id: 'i-18', product: P['p-6'], storageLocationId: 'sl-freezer', quantity: 1, unit: 'kg', expiresAt: daysFromNow(-2), expiryStatus: 'expired', isFinished: false, unitPrice: 189.9 },

  // Kiler (sl-pantry)
  { id: 'i-19', product: P['p-17'], storageLocationId: 'sl-pantry', quantity: 1, unit: 'adet', expiryStatus: 'none', isFinished: false, unitPrice: 32.5 },
  { id: 'i-20', product: P['p-18'], storageLocationId: 'sl-pantry', quantity: 1, unit: 'kg', expiryStatus: 'none', isFinished: false, unitPrice: 89.9 },
  { id: 'i-21', product: P['p-19'], storageLocationId: 'sl-pantry', quantity: 1, unit: 'lt', expiryStatus: 'none', isFinished: false, unitPrice: 249.9 },
  { id: 'i-22', product: P['p-22'], storageLocationId: 'sl-pantry', quantity: 1, unit: 'kg', expiryStatus: 'none', isFinished: false, unitPrice: 34.9 },
  { id: 'i-23', product: P['p-39'], storageLocationId: 'sl-pantry', quantity: 1, unit: 'adet', expiresAt: daysFromNow(240), expiryStatus: 'normal', isFinished: false, unitPrice: 149.9 },

  // Atölye Rafı (sl-workshop, "other" kind)
  { id: 'i-24', product: { id: 'p-tool-1', name: 'El Feneri Pili', category: 'other' }, storageLocationId: 'sl-workshop', quantity: 4, unit: 'adet', expiryStatus: 'none', isFinished: false, unitPrice: 9.9 },
];

/** @type {InventoryItem[]} — "empty" mod ikizi: hiç ürün yok */
export const emptyInventory = [];
