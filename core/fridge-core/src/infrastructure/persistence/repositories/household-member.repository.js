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
         WHERE hm.household_id = $1`,
        [householdId],
      );
      return rows.map((row) => ({ ...mapRow(row), displayName: row.display_name, email: row.email }));
    },
  };
};

export { makeHouseholdMemberRepository };
