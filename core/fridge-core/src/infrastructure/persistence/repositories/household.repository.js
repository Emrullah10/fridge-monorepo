const mapRow = (row) => row && ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  createdBy: row.created_by,
  receiptImageRetentionDays: row.receipt_image_retention_days,
});

const makeHouseholdRepository = ({ rawQuery }) => {
  return {
    create: async ({ name, kind = 'home', createdBy }) => {
      const { rows } = await rawQuery(
        `INSERT INTO household (name, kind, created_by) VALUES ($1, $2, $3) RETURNING *`,
        [name, kind, createdBy],
      );
      return mapRow(rows[0]);
    },

    findById: async (id) => {
      const { rows } = await rawQuery('SELECT * FROM household WHERE id = $1', [id]);
      return mapRow(rows[0]);
    },

    findByUserId: async (userId) => {
      const { rows } = await rawQuery(
        `SELECT h.* FROM household h
         JOIN household_member hm ON hm.household_id = h.id
         WHERE hm.user_id = $1
         ORDER BY h.created_at`,
        [userId],
      );
      return rows.map(mapRow);
    },

    findByCreatedBy: async (userId) => {
      const { rows } = await rawQuery('SELECT * FROM household WHERE created_by = $1', [userId]);
      return rows.map(mapRow);
    },

    updateSettings: async (id, { receiptImageRetentionDays }) => {
      const { rows } = await rawQuery(
        `UPDATE household SET receipt_image_retention_days = $2, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id, receiptImageRetentionDays],
      );
      return mapRow(rows[0]);
    },

    transferOwnership: async (id, newOwnerUserId) => {
      const { rows } = await rawQuery(
        `UPDATE household SET created_by = $2, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id, newOwnerUserId],
      );
      return mapRow(rows[0]);
    },

    deleteById: async (id) => {
      await rawQuery('DELETE FROM household WHERE id = $1', [id]);
    },
  };
};

export { makeHouseholdRepository };
