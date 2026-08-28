import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeUpdateHouseholdProfile } from '../../../src/application/use-cases/household/update-household-profile.use-case.js';

const makeFakes = (existing = { id: 'hh-1', name: 'Eski Ad', kind: 'home', features: { food: true, icon: 'home_rounded' } }) => {
  const calls = [];
  const householdRepo = {
    findById: async (id) => (id === existing.id ? existing : null),
    updateProfile: async (id, patch) => {
      calls.push({ id, patch });
      return {
        ...existing,
        name: patch.name ?? existing.name,
        features: patch.features ?? existing.features,
      };
    },
  };
  return { calls, householdRepo };
};

describe('updateHouseholdProfile', () => {
  test('sadece isim verilince ikon korunur', async () => {
    const fakes = makeFakes();
    const update = makeUpdateHouseholdProfile(fakes);

    const hh = await update({ householdId: 'hh-1', name: 'Yeni Ad' });

    assert.equal(hh.name, 'Yeni Ad');
    assert.equal(hh.features.icon, 'home_rounded');
    assert.equal(fakes.calls[0].patch.features, undefined);
  });

  test('sadece ikon verilince isim ve yemek korunur', async () => {
    const fakes = makeFakes();
    const update = makeUpdateHouseholdProfile(fakes);

    const hh = await update({ householdId: 'hh-1', icon: 'cabin_rounded' });

    assert.equal(hh.name, 'Eski Ad');
    assert.equal(hh.features.icon, 'cabin_rounded');
    assert.equal(hh.features.food, true);
  });

  test('boş isim ValidationError fırlatır', async () => {
    const fakes = makeFakes();
    const update = makeUpdateHouseholdProfile(fakes);

    await assert.rejects(
      () => update({ householdId: 'hh-1', name: '   ' }),
      { name: 'ValidationError' },
    );
  });

  test('olmayan household NotFoundError fırlatır', async () => {
    const fakes = makeFakes();
    const update = makeUpdateHouseholdProfile(fakes);

    await assert.rejects(
      () => update({ householdId: 'yok', name: 'X' }),
      { name: 'NotFoundError' },
    );
  });
});
