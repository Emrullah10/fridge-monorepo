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
  };
};

export { makeSessionRepository };
