import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeCreateHousehold } from '../../../src/application/use-cases/household/create-household.use-case.js';

const makeFakes = () => {
  const created = [];
  const members = [];
  const locations = [];

  const householdRepo = {
    create: async ({ name, kind, features, createdBy }) => {
      const row = { id: 'hh-1', name, kind, features, createdBy };
      created.push(row);
      return row;
    },
  };
  const householdMemberRepo = {
    addMember: async (input) => { members.push(input); },
  };
  const storageLocationRepo = {
    create: async (input) => { locations.push(input); return input; },
  };

  return { created, members, locations, householdRepo, householdMemberRepo, storageLocationRepo };
};

describe('createHousehold — tür seçimi kalktıktan sonra', () => {
  test('kind verilmezse "other"e düşer, yemek kapalı, 3 mutfak bölümü açılır', async () => {
    const fakes = makeFakes();
    const createHousehold = makeCreateHousehold(fakes);

    const hh = await createHousehold({ name: 'Sığınak', ownerUserId: 'u-1' });

    assert.equal(hh.kind, 'other');
    assert.equal(hh.features.food, false);
    assert.deepEqual(
      fakes.locations.map((l) => l.kind),
      ['fridge', 'freezer', 'pantry'],
    );
    assert.deepEqual(
      fakes.locations.map((l) => l.name),
      ['Buzdolabı', 'Dondurucu', 'Kiler'],
    );
    assert.equal(fakes.locations[0].householdId, 'hh-1');
  });

  test('features.icon string ise features nesnesine yazilir', async () => {
    const fakes = makeFakes();
    const createHousehold = makeCreateHousehold(fakes);

    const hh = await createHousehold({
      name: 'Dağ Evi',
      ownerUserId: 'u-1',
      features: { icon: 'cabin_rounded' },
    });

    assert.equal(hh.features.icon, 'cabin_rounded');
  });

  test('features.icon string değilse yazılmaz, hata fırlatmaz', async () => {
    const fakes = makeFakes();
    const createHousehold = makeCreateHousehold(fakes);

    const hh = await createHousehold({
      name: 'Kutu',
      ownerUserId: 'u-1',
      features: { icon: 42 },
    });

    assert.equal(hh.features.icon, undefined);
  });

  test('features.food açıkça true verilirse korunur (kullanici switch ile acti)', async () => {
    const fakes = makeFakes();
    const createHousehold = makeCreateHousehold(fakes);

    const hh = await createHousehold({
      name: 'Ofis Mutfağı',
      ownerUserId: 'u-1',
      features: { food: true },
    });

    assert.equal(hh.features.food, true);
  });

  test('misafir yolu: kind "home" açıkça verilince yemek açık gelir', async () => {
    const fakes = makeFakes();
    const createHousehold = makeCreateHousehold(fakes);

    const hh = await createHousehold({ name: 'Evim', kind: 'home', ownerUserId: 'u-1' });

    assert.equal(hh.kind, 'home');
    assert.equal(hh.features.food, true);
  });
});
