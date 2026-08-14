const mapRow = (row) => row && ({
  id: row.id,
  householdId: row.household_id,
  name: row.name,
  kind: row.kind,
  sortOrder: row.sort_order,
});

const makeStorageLocationRepository = ({ rawQuery }) => {
  return {
    create: async ({ householdId, name, kind, sortOrder = 0 }) => {
      const { rows } = await rawQuery(
        `INSERT INTO storage_location (household_id, name, kind, sort_order)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [householdId, name, kind, sortOrder],
      );
      return mapRow(rows[0]);
    },

    listByHousehold: async (householdId) => {
      const { rows } = await rawQuery(
        `SELECT * FROM storage_location WHERE household_id = $1 ORDER BY sort_order`,
        [householdId],
      );
      return rows.map(mapRow);
    },

    findById: async (id) => {
      const { rows } = await rawQuery('SELECT * FROM storage_location WHERE id = $1', [id]);
      return mapRow(rows[0]);
    },
  };
};

export { makeStorageLocationRepository };
