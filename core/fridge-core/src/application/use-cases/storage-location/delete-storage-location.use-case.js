import { NotFoundError, ValidationError } from '@fridge/errors';
import { LocationNotEmptyError } from '../../../domain/errors/index.js';

// inventory_item.storage_location_id ON DELETE CASCADE ile tanımlı — düz
// silme kullanıcının envanterini sessizce yok eder. Bu yüzden strateji
// açıkça belirtilmedikçe dolu bir bölüm silinmez.
const makeDeleteStorageLocation = ({ storageLocationRepo, makeStorageLocationRepo, datasource }) => {
  return async ({ locationId, householdId, strategy, targetLocationId }) => {
    const location = await storageLocationRepo.findById(locationId);
    if (!location || location.householdId !== householdId) {
      throw new NotFoundError('Storage location not found');
    }

    // "En az bir bölüm" kısıtı kaldırıldı — alan tamamen boşaltılabilir
    // (istemci boş-durum ekranıyla yönlendirir). Dolu son bölüm için istemci
    // strategy:'force' onayı ister.
    const itemCount = await storageLocationRepo.countInventoryItems(locationId);

    if (itemCount > 0 && strategy !== 'move' && strategy !== 'force') {
      throw new LocationNotEmptyError(itemCount);
    }

    if (itemCount > 0 && strategy === 'move') {
      if (!targetLocationId) {
        throw new ValidationError('Taşıma için hedef bölüm belirtilmeli');
      }
      const target = await storageLocationRepo.findById(targetLocationId);
      if (!target || target.householdId !== householdId) {
        throw new NotFoundError('Target storage location not found');
      }
      if (targetLocationId === locationId) {
        throw new ValidationError('Hedef bölüm silinen bölümle aynı olamaz');
      }

      await datasource.withTransaction(async ({ query }) => {
        const txRepo = makeStorageLocationRepo({ rawQuery: query });
        await txRepo.moveAllToLocation({ fromId: locationId, toId: targetLocationId });
        await txRepo.delete(locationId);
      });
      return;
    }

    // strategy === 'force' (itemCount > 0) ya da itemCount === 0 — doğrudan sil.
    await storageLocationRepo.delete(locationId);
  };
};

export { makeDeleteStorageLocation };
