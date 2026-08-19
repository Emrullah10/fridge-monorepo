import { NotFoundError, ValidationError } from '@fridge/errors';
import { STORAGE_KINDS } from '../../../domain/storage-kinds.js';

const makeUpdateStorageLocation = ({ storageLocationRepo }) => {
  return async ({ locationId, householdId, name, kind, icon, sortOrder }) => {
    const location = await storageLocationRepo.findById(locationId);
    if (!location || location.householdId !== householdId) {
      throw new NotFoundError('Storage location not found');
    }

    let safeName;
    if (name !== undefined) {
      safeName = name.trim();
      if (!safeName) {
        throw new ValidationError('Bölüm adı boş olamaz');
      }
    }

    const warnings = [];
    if (kind !== undefined) {
      if (!STORAGE_KINDS.includes(kind)) {
        throw new ValidationError('Geçersiz bölüm türü');
      }
      // Fiş tarama önerisi (suggestStorageKind) yalnızca fridge/freezer/pantry
      // üretir. Kullanıcı bölümü bunların dışına taşırsa öneri artık buraya
      // otomatik gelmez — engellenmez, sadece bilgilendirilir.
      const wasSuggestable = ['fridge', 'freezer', 'pantry'].includes(location.kind);
      const stillSuggestable = ['fridge', 'freezer', 'pantry'].includes(kind);
      if (wasSuggestable && !stillSuggestable) {
        warnings.push('Bu bölümün türü artık fiş tarama önerilerinde otomatik önerilmeyecek.');
      }
    }

    const updated = await storageLocationRepo.update(locationId, {
      name: safeName,
      kind,
      icon,
      sortOrder,
    });

    return { location: updated, warnings };
  };
};

export { makeUpdateStorageLocation };
