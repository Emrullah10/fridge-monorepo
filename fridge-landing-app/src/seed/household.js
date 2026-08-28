/**
 * @typedef {'fridge'|'freezer'|'pantry'|'other'} StorageKind
 * @typedef {Object} StorageLocation
 * @property {string} id
 * @property {StorageKind} kind
 * @property {string} name
 * @property {number} itemCount
 * @typedef {Object} Member
 * @property {string} id
 * @property {string} displayName
 * @property {string} avatarInitial
 * @property {boolean} [isGuest]
 * @typedef {Object} Household
 * @property {string} id
 * @property {string} name
 * @property {string} inviteCode
 * @property {Member[]} members
 * @property {StorageLocation[]} storageLocations
 */

/** @type {Household} */
export const household = {
  id: 'hh-1',
  name: 'Kalender Evi',
  inviteCode: 'KLNDR42',
  members: [
    { id: 'u-1', displayName: 'Elif', avatarInitial: 'E' },
    { id: 'u-2', displayName: 'Deniz', avatarInitial: 'D' },
    { id: 'u-3', displayName: 'Misafir', avatarInitial: 'M', isGuest: true },
  ],
  storageLocations: [
    { id: 'sl-fridge', kind: 'fridge', name: 'Buzdolabı', itemCount: 12 },
    { id: 'sl-freezer', kind: 'freezer', name: 'Dondurucu', itemCount: 6 },
    { id: 'sl-pantry', kind: 'pantry', name: 'Kiler', itemCount: 8 },
    { id: 'sl-workshop', kind: 'other', name: 'Atölye Rafı', itemCount: 3 },
  ],
};

/** @type {Household} — "empty" mod ikizi: hiç üye/bölüm yok, yeni kullanıcı hâli */
export const emptyHousehold = {
  id: 'hh-empty',
  name: '',
  inviteCode: '',
  members: [],
  storageLocations: [],
};
