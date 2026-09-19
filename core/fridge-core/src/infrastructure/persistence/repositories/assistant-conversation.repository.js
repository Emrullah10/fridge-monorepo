const mapConversation = (row) => row && ({
  id: row.id,
  userId: row.user_id,
  householdId: row.household_id,
  title: row.title,
  mode: row.mode,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapMessage = (row) => row && ({
  id: row.id,
  conversationId: row.conversation_id,
  role: row.role,
  content: row.content,
  parts: row.parts ?? null,
  meta: row.meta ?? null,
  createdAt: row.created_at,
});

// chef-chat.repository.js'in yerine geçer. Sohbetler kullanıcıya ait (hane
// üyeleri birbirininkini görmez, bkz. plan §A2) — bu yüzden listeleme/
// sahiplik kontrolleri household_id DEĞİL user_id ile yapılır.
const makeAssistantConversationRepository = ({ rawQuery }) => {
  return {
    create: async ({ userId, householdId = null, mode = 'general' }) => {
      const { rows } = await rawQuery(
        `INSERT INTO assistant_conversation (user_id, household_id, mode)
         VALUES ($1, $2, $3) RETURNING *`,
        [userId, householdId, mode],
      );
      return mapConversation(rows[0]);
    },

    findById: async (id) => {
      const { rows } = await rawQuery('SELECT * FROM assistant_conversation WHERE id = $1', [id]);
      return mapConversation(rows[0]);
    },

    // Çekmece listesi — kullanıcı bazlı, en son güncellenen üstte.
    listByUser: async (userId) => {
      const { rows } = await rawQuery(
        `SELECT * FROM assistant_conversation WHERE user_id = $1 ORDER BY updated_at DESC`,
        [userId],
      );
      return rows.map(mapConversation);
    },

    update: async (id, { title, householdId, mode }) => {
      const { rows } = await rawQuery(
        `UPDATE assistant_conversation SET
           title = CASE WHEN $2::boolean THEN $3 ELSE title END,
           household_id = CASE WHEN $4::boolean THEN $5 ELSE household_id END,
           mode = COALESCE($6, mode),
           updated_at = now()
         WHERE id = $1 RETURNING *`,
        [
          id,
          title !== undefined, title ?? null,
          householdId !== undefined, householdId ?? null,
          mode ?? null,
        ],
      );
      return mapConversation(rows[0]);
    },

    // conversation.title NULL ise AI'ın ürettiği başlığı yazar — send-
    // assistant-message.use-case.js'de touch() ile birlikte tek UPDATE'e
    // birleşmiş olarak da çağrılabilir; burada ayrı ve basit tutulur.
    setTitleIfMissing: async (id, title) => {
      const { rows } = await rawQuery(
        `UPDATE assistant_conversation SET title = COALESCE(title, $2), updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id, title],
      );
      return mapConversation(rows[0]);
    },

    touch: async (id) => {
      await rawQuery('UPDATE assistant_conversation SET updated_at = now() WHERE id = $1', [id]);
    },

    delete: async (id) => {
      await rawQuery('DELETE FROM assistant_conversation WHERE id = $1', [id]);
    },

    // Mesajlar — en yeni [limit] mesajı KRONOLOJİK sırada döndürür (prompt
    // geçmişi eskiden yeniye ister), chef-chat.repository.js:15-26 deseni.
    listRecentMessages: async ({ conversationId, limit = 20 }) => {
      const { rows } = await rawQuery(
        `SELECT * FROM (
           SELECT * FROM assistant_message
           WHERE conversation_id = $1
           ORDER BY created_at DESC
           LIMIT $2
         ) t ORDER BY created_at ASC`,
        [conversationId, limit],
      );
      return rows.map(mapMessage);
    },

    listAllMessages: async (conversationId) => {
      const { rows } = await rawQuery(
        `SELECT * FROM assistant_message WHERE conversation_id = $1 ORDER BY created_at ASC`,
        [conversationId],
      );
      return rows.map(mapMessage);
    },

    findMessageById: async (id) => {
      const { rows } = await rawQuery('SELECT * FROM assistant_message WHERE id = $1', [id]);
      return mapMessage(rows[0]);
    },

    appendMessage: async ({ conversationId, role, content, parts = null, meta = null }) => {
      const { rows } = await rawQuery(
        `INSERT INTO assistant_message (conversation_id, role, content, parts, meta)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [conversationId, role, content, parts ? JSON.stringify(parts) : null, meta ? JSON.stringify(meta) : null],
      );
      return mapMessage(rows[0]);
    },
  };
};

export { makeAssistantConversationRepository };
