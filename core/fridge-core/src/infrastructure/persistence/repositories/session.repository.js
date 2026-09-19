const mapRow = (row) => row && ({
  id: row.id,
  userId: row.user_id,
  refreshTokenHash: row.refresh_token_hash,
  revokedAt: row.revoked_at,
  expiresAt: row.expires_at,
});

const makeSessionRepository = ({ rawQuery }) => {
  return {
    create: async ({ userId, refreshTokenHash, expiresAt }) => {
      const { rows } = await rawQuery(
        `INSERT INTO user_session (user_id, refresh_token_hash, expires_at)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [userId, refreshTokenHash, expiresAt],
      );
      return mapRow(rows[0]);
    },

    findActiveByTokenHash: async (refreshTokenHash) => {
      const { rows } = await rawQuery(
        `SELECT * FROM user_session
         WHERE refresh_token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
        [refreshTokenHash],
      );
      return mapRow(rows[0]);
    },

    revoke: async (id) => {
      await rawQuery('UPDATE user_session SET revoked_at = now() WHERE id = $1', [id]);
    },

    // Şifre sıfırlandığında çalınmış/eski oturumların hepsi düşmeli —
    // reset-password.use-case.js bunu şifre değişimiyle birlikte çağırır.
    revokeAllForUser: async (userId) => {
      await rawQuery(
        'UPDATE user_session SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [userId],
      );
    },

    // Tablo revoke edilen/süresi geçmiş satırları hiç SİLMİYOR (sadece
    // revoked_at set ediliyor) — bu yüzden 30 günlük refresh + her
    // yenilemede yeni satır ile sürekli büyür (bkz. plan §Faz 0, idx_user_
    // session_active_refresh_hash migration'ının aynı bulgusu). retention-
    // cleanup.js worker'ı tarafından periyodik çağrılır. 30 günlük tampon
    // pay: expired/revoked satır silinmeden önce biraz beklenir — audit/
    // destek talebi ("hesabıma girilmiş miydi") için kısa bir geçmiş kalsın.
    deleteExpiredAndRevoked: async ({ olderThanDays = 30 } = {}) => {
      const { rowCount } = await rawQuery(
        `DELETE FROM user_session
         WHERE (revoked_at IS NOT NULL OR expires_at <= now())
           AND created_at < now() - ($1 || ' days')::interval`,
        [olderThanDays],
      );
      return rowCount;
    },
  };
};

export { makeSessionRepository };
