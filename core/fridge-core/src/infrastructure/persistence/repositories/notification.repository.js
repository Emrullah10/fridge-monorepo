const mapRow = (row) => row && ({
  id: row.id,
  userId: row.user_id,
  householdId: row.household_id,
  type: row.type,
  title: row.title,
  body: row.body,
  data: row.data,
  readAt: row.read_at,
  createdAt: row.created_at,
});

const makeNotificationRepository = ({ rawQuery }) => {
  return {
    // dedupeKey çakışırsa satır sessizce atlanır (retry/çift tetikleme
    // koruması, bkz. uq_notification_dedupe partial unique index) — bu
    // yüzden dönen dizi girilen `rows` ile birebir uzunlukta olmayabilir.
    createMany: async (rows) => {
      if (rows.length === 0) return [];
      const values = [];
      const params = [];
      rows.forEach((row, index) => {
        const base = index * 7;
        values.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`,
        );
        params.push(
          row.userId,
          row.householdId ?? null,
          row.type,
          row.title,
          row.body,
          JSON.stringify(row.data ?? {}),
          row.dedupeKey ?? null,
        );
      });
      const { rows: inserted } = await rawQuery(
        `INSERT INTO notification (user_id, household_id, type, title, body, data, dedupe_key)
         VALUES ${values.join(', ')}
         ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
         RETURNING *`,
        params,
      );
      return inserted.map(mapRow);
    },

    listByUser: async (userId, { limit = 30, before } = {}) => {
      const conditions = ['user_id = $1'];
      const params = [userId];
      if (before) {
        conditions.push(`created_at < $${params.length + 1}`);
        params.push(before);
      }
      params.push(limit);
      const { rows } = await rawQuery(
        `SELECT * FROM notification WHERE ${conditions.join(' AND ')}
         ORDER BY created_at DESC LIMIT $${params.length}`,
        params,
      );
      return rows.map(mapRow);
    },

    countUnread: async (userId) => {
      const { rows } = await rawQuery(
        'SELECT count(*)::int AS count FROM notification WHERE user_id = $1 AND read_at IS NULL',
        [userId],
      );
      return rows[0].count;
    },

    // Her zaman user_id ile scope'lu — başka kullanıcının bildirimini
    // id tahmin ederek okunmuş işaretlemeyi (IDOR) engeller.
    markRead: async ({ userId, ids }) => {
      if (ids && ids.length > 0) {
        await rawQuery(
          'UPDATE notification SET read_at = now() WHERE user_id = $1 AND id = ANY($2::uuid[]) AND read_at IS NULL',
          [userId, ids],
        );
      } else {
        await rawQuery(
          'UPDATE notification SET read_at = now() WHERE user_id = $1 AND read_at IS NULL',
          [userId],
        );
      }
    },
  };
};

export { makeNotificationRepository };
