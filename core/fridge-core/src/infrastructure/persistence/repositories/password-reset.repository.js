const mapRow = (row) => row && ({
  id: row.id,
  userId: row.user_id,
  codeHash: row.code_hash,
  attempts: row.attempts,
  consumedAt: row.consumed_at,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
});

const makePasswordResetRepository = ({ rawQuery }) => {
  return {
    create: async ({ userId, codeHash, expiresAt }) => {
      const { rows } = await rawQuery(
        `INSERT INTO password_reset_token (user_id, code_hash, expires_at)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [userId, codeHash, expiresAt],
      );
      return mapRow(rows[0]);
    },

    // reset-password.use-case.js kodu bu satırla karşılaştırır — kullanıcının
    // en güncel, henüz tüketilmemiş, süresi dolmamış token'ı.
    findActiveByUserId: async (userId) => {
      const { rows } = await rawQuery(
        `SELECT * FROM password_reset_token
         WHERE user_id = $1 AND consumed_at IS NULL AND expires_at > now()
         ORDER BY created_at DESC LIMIT 1`,
        [userId],
      );
      return mapRow(rows[0]);
    },

    incrementAttempts: async (id) => {
      await rawQuery('UPDATE password_reset_token SET attempts = attempts + 1 WHERE id = $1', [id]);
    },

    markConsumed: async (id) => {
      await rawQuery('UPDATE password_reset_token SET consumed_at = now() WHERE id = $1', [id]);
    },

    // Yeni kod istenince eski tüketilmemiş token'lar geçersiz kalsın —
    // request-password-reset.use-case.js her çağrıda invalidate eder.
    invalidateAllForUser: async (userId) => {
      await rawQuery(
        `UPDATE password_reset_token SET consumed_at = now()
         WHERE user_id = $1 AND consumed_at IS NULL`,
        [userId],
      );
    },
  };
};

export { makePasswordResetRepository };
