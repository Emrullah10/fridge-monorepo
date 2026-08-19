const mapRow = (row) => row && ({
  id: row.id,
  userId: row.user_id,
  token: row.token,
  platform: row.platform,
  deviceId: row.device_id,
  locale: row.locale,
});

const makeDeviceTokenRepository = ({ rawQuery }) => {
  return {
    // token UNIQUE ve user_id devredilebilir: aynı cihaz başka bir hesaba
    // giriş yaparsa FCM aynı token'ı verir — upsert user_id'yi ELE GEÇİRİR,
    // aksi halde eski kullanıcı yeni kullanıcının cihazına bildirim alır.
    upsert: async ({ userId, token, platform = 'android', deviceId = null, locale = 'tr' }) => {
      const { rows } = await rawQuery(
        `INSERT INTO device_token (user_id, token, platform, device_id, locale)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (token) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           platform = EXCLUDED.platform,
           device_id = EXCLUDED.device_id,
           locale = EXCLUDED.locale,
           last_seen_at = now()
         RETURNING *`,
        [userId, token, platform, deviceId, locale],
      );
      return mapRow(rows[0]);
    },

    listByUserIds: async (userIds) => {
      if (userIds.length === 0) return [];
      const { rows } = await rawQuery(
        'SELECT * FROM device_token WHERE user_id = ANY($1::uuid[])',
        [userIds],
      );
      return rows.map(mapRow);
    },

    deleteByTokens: async (tokens) => {
      if (tokens.length === 0) return;
      await rawQuery('DELETE FROM device_token WHERE token = ANY($1::text[])', [tokens]);
    },

    deleteByToken: async ({ userId, token }) => {
      await rawQuery('DELETE FROM device_token WHERE token = $1 AND user_id = $2', [token, userId]);
    },
  };
};

export { makeDeviceTokenRepository };
