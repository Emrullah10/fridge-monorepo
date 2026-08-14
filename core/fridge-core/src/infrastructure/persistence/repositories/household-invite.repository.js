const mapRow = (row) => row && ({
  id: row.id,
  householdId: row.household_id,
  code: row.code,
  invitedEmail: row.invited_email,
  invitedBy: row.invited_by,
  status: row.status,
  expiresAt: row.expires_at,
});

const makeHouseholdInviteRepository = ({ rawQuery }) => {
  return {
    create: async ({ householdId, code, invitedEmail, invitedBy, expiresAt }) => {
      const { rows } = await rawQuery(
        `INSERT INTO household_invite (household_id, code, invited_email, invited_by, expires_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [householdId, code, invitedEmail, invitedBy, expiresAt],
      );
      return mapRow(rows[0]);
    },

    findByCode: async (code) => {
      const { rows } = await rawQuery('SELECT * FROM household_invite WHERE code = $1', [code]);
      return mapRow(rows[0]);
    },

    updateStatus: async (id, status) => {
      await rawQuery('UPDATE household_invite SET status = $2 WHERE id = $1', [id, status]);
    },
  };
};

export { makeHouseholdInviteRepository };
