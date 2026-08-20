const mapRow = (row) => row && ({
  householdId: row.household_id,
  userId: row.user_id,
  role: row.role,
  joinedAt: row.joined_at,
});

const makeHouseholdMemberRepository = ({ rawQuery }) => {
  return {
    addMember: async ({ householdId, userId, role }) => {
      const { rows } = await rawQuery(
        `INSERT INTO household_member (household_id, user_id, role)
         VALUES ($1, $2, $3) RETURNING *`,
        [householdId, userId, role],
      );
      return mapRow(rows[0]);
    },

    findMembership: async ({ householdId, userId }) => {
      const { rows } = await rawQuery(
        `SELECT * FROM household_member WHERE household_id = $1 AND user_id = $2`,
        [householdId, userId],
      );
      return mapRow(rows[0]);
    },

    listMembers: async (householdId) => {
      const { rows } = await rawQuery(
        `SELECT hm.*, u.display_name, u.email
         FROM household_member hm
         JOIN app_user u ON u.id = hm.user_id
         WHERE hm.household_id = $1
         ORDER BY hm.joined_at`,
        [householdId],
      );
      return rows.map((row) => ({ ...mapRow(row), displayName: row.display_name, email: row.email }));
    },

    removeMember: async ({ householdId, userId }) => {
      await rawQuery(
        `DELETE FROM household_member WHERE household_id = $1 AND user_id = $2`,
        [householdId, userId],
      );
    },

    countMembers: async (householdId) => {
      const { rows } = await rawQuery(
        `SELECT COUNT(*)::int AS count FROM household_member WHERE household_id = $1`,
        [householdId],
      );
      return rows[0].count;
    },

    // Sahip ayrılırken sahipliği devredilecek en eski diğer üye —
    // delete-account.use-case.js'teki aynı desen (paylaşılan envanter/fiş
    // verisi kaybolmasın diye devir, silme değil).
    findOldestOtherMember: async ({ householdId, excludeUserId }) => {
      const { rows } = await rawQuery(
        `SELECT * FROM household_member
         WHERE household_id = $1 AND user_id != $2
         ORDER BY joined_at LIMIT 1`,
        [householdId, excludeUserId],
      );
      return mapRow(rows[0]);
    },

    updateRole: async ({ householdId, userId, role }) => {
      await rawQuery(
        `UPDATE household_member SET role = $3 WHERE household_id = $1 AND user_id = $2`,
        [householdId, userId, role],
      );
    },
  };
};

export { makeHouseholdMemberRepository };
