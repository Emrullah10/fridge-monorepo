const mapRow = (row) => row && ({
  id: row.id,
  name: row.name,
  createdBy: row.created_by,
  receiptImageRetentionDays: row.receipt_image_retention_days,
});

const makeHouseholdRepository = ({ rawQuery }) => {
  return {
    create: async ({ name, createdBy }) => {
      const { rows } = await rawQuery(
        `INSERT INTO household (name, created_by) VALUES ($1, $2) RETURNING *`,
        [name, createdBy],
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

    updateSettings: async (id, { receiptImageRetentionDays }) => {
      const { rows } = await rawQuery(
        `UPDATE household SET receipt_image_retention_days = $2, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id, receiptImageRetentionDays],
      );
      return mapRow(rows[0]);
    },
  };
};

export { makeHouseholdRepository };
