const mapRow = (row) => row && ({
  userId: row.user_id,
  type: row.type,
  pushEnabled: row.push_enabled,
});

const makeNotificationPreferenceRepository = ({ rawQuery }) => {
  return {
    listByUser: async (userId) => {
      const { rows } = await rawQuery(
        'SELECT * FROM notification_preference WHERE user_id = $1',
        [userId],
      );
      return rows.map(mapRow);
    },

    upsert: async ({ userId, type, pushEnabled }) => {
      const { rows } = await rawQuery(
        `INSERT INTO notification_preference (user_id, type, push_enabled)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, type) DO UPDATE SET push_enabled = EXCLUDED.push_enabled
         RETURNING *`,
        [userId, type, pushEnabled],
      );
      return mapRow(rows[0]);
    },

    // Tercih satırı YOKSA varsayılan açık kabul edilir — yeni bir bildirim
    // tipi eklendiğinde kullanıcının tek tek opt-in etmesi gerekmesin diye.
    // Bu yüzden burada dönen liste "açıkça false yapılmamış" kullanıcı
    // kimlikleridir, tabloda satırı olmayanlar dahil.
    filterEnabledUserIds: async ({ userIds, type }) => {
      if (userIds.length === 0) return [];
      const { rows } = await rawQuery(
        `SELECT id FROM unnest($1::uuid[]) AS id
         WHERE id NOT IN (
           SELECT user_id FROM notification_preference
           WHERE type = $2 AND push_enabled = false
         )`,
        [userIds, type],
      );
      return rows.map((row) => row.id);
    },
  };
};

export { makeNotificationPreferenceRepository };
