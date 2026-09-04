const mapRow = (row) => row && ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  features: row.features ?? {},
  createdBy: row.created_by,
  receiptImageRetentionDays: row.receipt_image_retention_days,
});

const makeHouseholdRepository = ({ rawQuery }) => {
  return {
    create: async ({ name, kind = 'home', features = {}, createdBy }) => {
      const { rows } = await rawQuery(
        `INSERT INTO household (name, kind, features, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
        [name, kind, JSON.stringify(features), createdBy],
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

    // access-lock.js resolveLockedHouseholdIds'in "en eski açık kalır"
    // sırası household.count limitinin kendisiyle (household.routes.js:19,
    // ÜYELİKLERİ sayar) tutarlı olsun diye household_member.joined_at'e göre
    // sıralanır — household.created_at DEĞİL (bkz. plan §Faz C1 notu).
    findMembershipsWithJoinedAtByUserId: async (userId) => {
      const { rows } = await rawQuery(
        `SELECT h.*, hm.joined_at
         FROM household h
         JOIN household_member hm ON hm.household_id = h.id
         WHERE hm.user_id = $1
         ORDER BY hm.joined_at`,
        [userId],
      );
      return rows.map((row) => ({ ...mapRow(row), joinedAt: row.joined_at }));
    },

    findByCreatedBy: async (userId) => {
      const { rows } = await rawQuery('SELECT * FROM household WHERE created_by = $1', [userId]);
      return rows.map(mapRow);
    },

    // Kısmi güncelleme: verilmeyen alanlar (null) COALESCE ile korunur.
    // `features` çağıran tarafından tam obje olarak verilir (mevcut + değişen).
    updateProfile: async (id, { name, features }) => {
      const { rows } = await rawQuery(
        `UPDATE household SET name = COALESCE($2, name),
                              features = COALESCE($3, features),
                              updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id, name ?? null, features ? JSON.stringify(features) : null],
      );
      return mapRow(rows[0]);
    },

    updateSettings: async (id, { receiptImageRetentionDays }) => {
      const { rows } = await rawQuery(
        `UPDATE household SET receipt_image_retention_days = $2, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id, receiptImageRetentionDays],
      );
      return mapRow(rows[0]);
    },

    updateFeatures: async (id, features) => {
      const { rows } = await rawQuery(
        `UPDATE household SET features = $2, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id, JSON.stringify(features)],
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
