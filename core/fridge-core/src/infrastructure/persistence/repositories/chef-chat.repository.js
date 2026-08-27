const mapRow = (row) => row && ({
  id: row.id,
  householdId: row.household_id,
  userId: row.user_id,
  role: row.role,
  content: row.content,
  createdAt: row.created_at,
});

const makeChefChatRepository = ({ rawQuery }) => {
  return {
    // En yeni [limit] mesajı KRONOLOJİK sırada döndürür (prompt geçmişi eskiden
    // yeniye ister). limit tek turda gönderilecek bağlamı sınırlar — çok uzun
    // geçmiş hem token maliyeti hem alaka kaybı.
    listRecent: async ({ householdId, limit = 20 }) => {
      const { rows } = await rawQuery(
        `SELECT * FROM (
           SELECT * FROM chef_chat_message
           WHERE household_id = $1
           ORDER BY created_at DESC
           LIMIT $2
         ) t ORDER BY created_at ASC`,
        [householdId, limit],
      );
      return rows.map(mapRow);
    },

    append: async ({ householdId, userId = null, role, content }) => {
      const { rows } = await rawQuery(
        `INSERT INTO chef_chat_message (household_id, user_id, role, content)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [householdId, userId, role, content],
      );
      return mapRow(rows[0]);
    },

    clear: async (householdId) => {
      await rawQuery('DELETE FROM chef_chat_message WHERE household_id = $1', [householdId]);
    },
  };
};

export { makeChefChatRepository };
