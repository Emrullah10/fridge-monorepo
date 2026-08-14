const mapRow = (row) => row && ({
  id: row.id,
  householdId: row.household_id,
  canonicalName: row.canonical_name,
  categoryId: row.category_id,
  defaultUnit: row.default_unit,
  isGlobal: row.is_global,
});

const makeProductRepository = ({ rawQuery }) => {
  return {
    findById: async (id) => {
      const { rows } = await rawQuery('SELECT * FROM product WHERE id = $1', [id]);
      return mapRow(rows[0]);
    },

    create: async ({ householdId = null, canonicalName, categoryId = null, defaultUnit, isGlobal = false }) => {
      const { rows } = await rawQuery(
        `INSERT INTO product (household_id, canonical_name, category_id, default_unit, is_global)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [householdId, canonicalName, categoryId, defaultUnit, isGlobal],
      );
      return mapRow(rows[0]);
    },
  };
};

export { makeProductRepository };
