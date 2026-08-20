const mapRow = (row) => row && ({
  id: row.id,
  householdId: row.household_id,
  code: row.code,
  invitedEmail: row.invited_email,
  invitedBy: row.invited_by,
  status: row.status,
  expiresAt: row.expires_at,
  isShared: row.is_shared,
});

const makeHouseholdInviteRepository = ({ rawQuery }) => {
  return {
    create: async ({ householdId, code, invitedEmail, invitedBy, expiresAt, isShared = false }) => {
      const { rows } = await rawQuery(
        `INSERT INTO household_invite (household_id, code, invited_email, invited_by, expires_at, is_shared)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [householdId, code, invitedEmail, invitedBy, expiresAt, isShared],
      );
      return mapRow(rows[0]);
    },

    findByCode: async (code) => {
      const { rows } = await rawQuery('SELECT * FROM household_invite WHERE code = $1', [code]);
      return mapRow(rows[0]);
    },

    // Alanın kalıcı davet kodu — davet dialogu her açıldığında bu aranır,
    // varsa döndürülür (create-invite.use-case.js). Süresi geçmiş olsa bile
    // (accept sırasında ayrıca kontrol edilir) burada dönebilir; caller
    // süre kontrolünü kendisi yapar.
    findActiveSharedByHousehold: async (householdId) => {
      const { rows } = await rawQuery(
        `SELECT * FROM household_invite WHERE household_id = $1 AND is_shared AND status = 'pending' LIMIT 1`,
        [householdId],
      );
      return mapRow(rows[0]);
    },

    updateStatus: async (id, status) => {
      await rawQuery('UPDATE household_invite SET status = $2 WHERE id = $1', [id, status]);
    },

    // "Kodu yenile": mevcut paylaşımlı kodu iptal eder ki create-invite bir
    // sonraki çağrıda yenisini üretebilsin (aktif kod olmayınca üretim yolu).
    revokeSharedByHousehold: async (householdId) => {
      await rawQuery(
        `UPDATE household_invite SET status = 'revoked' WHERE household_id = $1 AND is_shared AND status = 'pending'`,
        [householdId],
      );
    },

    deleteByInvitedBy: async (userId) => {
      await rawQuery('DELETE FROM household_invite WHERE invited_by = $1', [userId]);
    },
  };
};

export { makeHouseholdInviteRepository };
