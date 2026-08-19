import { ValidationError } from '@fridge/errors';
import { STORAGE_KINDS } from '../../../domain/storage-kinds.js';

const makeCreateStorageLocation = ({ storageLocationRepo }) => {
  return async ({ householdId, name, kind, icon = null, sortOrder }) => {
    const trimmedName = (name ?? '').trim();
    if (!trimmedName) {
      throw new ValidationError('Bölüm adı boş olamaz');
    }
    const safeKind = kind && STORAGE_KINDS.includes(kind) ? kind : 'other';

    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined || finalSortOrder === null) {
      const existing = await storageLocationRepo.listByHousehold(householdId);
      finalSortOrder = existing.reduce((max, loc) => Math.max(max, loc.sortOrder), -1) + 1;
    }

    return storageLocationRepo.create({
      householdId,
      name: trimmedName,
      kind: safeKind,
      icon,
      sortOrder: finalSortOrder,
    });
  };
};

export { makeCreateStorageLocation };
