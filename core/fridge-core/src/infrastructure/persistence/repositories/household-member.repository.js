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

    // Hane üyelerinin diyet profilleri — tarif önerisi/AI Chef alerjen/diyet
    // kısıtlarını buradan alır. Profili olmayan üyeler null döner.
    listDietProfiles: async (householdId) => {
      const { rows } = await rawQuery(
        `SELECT u.diet_profile
         FROM household_member hm
         JOIN app_user u ON u.id = hm.user_id
         WHERE hm.household_id = $1`,
        [householdId],
      );
      return rows.map((row) => row.diet_profile ?? null);
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

    // entitlements.js'in householdOwnerPlans girdisini besler — kullanıcının
    // üye olduğu HER alan için o alanın SAHİBİNİN (role='owner') abonelik
    // planını döner. subscription satırı yoksa (hiç abone olmamış sahip)
    // planı 'free' varsayılır — LEFT JOIN + COALESCE, subscription tablosuna
    // bağımlı bir INNER JOIN sahipsiz/free alanları listeden düşürmesin.
    // "premium" değeri sadece subscription.status ERİŞİM VEREN bir durumda
    // (active/in_grace/canceled-ama-dönem-bitmemiş) ise yazılır — canlı karar
    // burada değil entitlements.js'te merkezi kalsın diye ham status +
    // current_period_end döndürülür, çağıran (get-entitlements use-case)
    // resolvePlan ile aynı mantığı her sahip için ayrı ayrı çalıştırır.
    listOwnerSubscriptionsForUser: async (userId) => {
      const { rows } = await rawQuery(
        `SELECT hm.household_id,
                owner_sub.status AS owner_subscription_status,
                owner_sub.current_period_end AS owner_current_period_end,
                owner_user.is_guest AS owner_is_guest,
                owner_user.trial_ends_at AS owner_trial_ends_at
         FROM household_member hm
         JOIN household_member owner_hm
           ON owner_hm.household_id = hm.household_id AND owner_hm.role = 'owner'
         JOIN app_user owner_user ON owner_user.id = owner_hm.user_id
         LEFT JOIN subscription owner_sub ON owner_sub.user_id = owner_hm.user_id
         WHERE hm.user_id = $1`,
        [userId],
      );
      return rows.map((row) => ({
        householdId: row.household_id,
        ownerSubscriptionStatus: row.owner_subscription_status ?? null,
        ownerCurrentPeriodEnd: row.owner_current_period_end ?? null,
        // Sahip misafirse (kendi kendine sahip olduğu ilk alan) GUEST
        // planı uygulanmalı, FREE değil — aksi halde misafir kendi alanına
        // "free" limitleri (6 bölüm) uygulayıp GUEST'in 3'lük sınırını
        // aşabiliyordu (bkz. buglog).
        ownerIsGuest: row.owner_is_guest ?? false,
        ownerTrialEndsAt: row.owner_trial_ends_at ?? null,
      }));
    },
  };
};

export { makeHouseholdMemberRepository };
