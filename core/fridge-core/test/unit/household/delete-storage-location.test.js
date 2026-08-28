import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeDeleteStorageLocation } from '../../../src/application/use-cases/storage-location/delete-storage-location.use-case.js';

const makeFakes = ({ itemCount = 0 } = {}) => {
  const deleted = [];
  const storageLocationRepo = {
    findById: async (id) => ({ id, householdId: 'hh-1' }),
    countInventoryItems: async () => itemCount,
    delete: async (id) => { deleted.push(id); },
  };
  return { deleted, storageLocationRepo };
};

describe('deleteStorageLocation — son bölüm kısıtı kalktıktan sonra', () => {
  test('tek/son bölüm boşsa silinebilir (artık LastLocationError yok)', async () => {
    const fakes = makeFakes({ itemCount: 0 });
    const del = makeDeleteStorageLocation(fakes);

    await del({ locationId: 'loc-1', householdId: 'hh-1' });

    assert.deepEqual(fakes.deleted, ['loc-1']);
  });

  test('dolu bölüm strateji olmadan LocationNotEmptyError fırlatır', async () => {
    const fakes = makeFakes({ itemCount: 5 });
    const del = makeDeleteStorageLocation(fakes);

    await assert.rejects(
      () => del({ locationId: 'loc-1', householdId: 'hh-1' }),
      (err) => {
        assert.equal(err.name, 'LocationNotEmptyError');
        assert.equal(err.itemCount, 5);
        return true;
      },
    );
    assert.deepEqual(fakes.deleted, []);
  });

  test('dolu son bölüm strategy:"force" ile silinir (taşınacak yer yok)', async () => {
    const fakes = makeFakes({ itemCount: 5 });
    const del = makeDeleteStorageLocation(fakes);

    await del({ locationId: 'loc-1', householdId: 'hh-1', strategy: 'force' });

    assert.deepEqual(fakes.deleted, ['loc-1']);
  });
});
