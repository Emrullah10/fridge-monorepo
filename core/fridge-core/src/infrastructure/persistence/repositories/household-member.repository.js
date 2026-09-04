const mapRow = (row) => row && ({
  householdId: row.household_id,
  userId: row.user_id,
  role: row.role,
  joinedAt: row.joined_at,
});

const makeHouseholdMemberRepository = ({ rawQuery }) => {
  // listFamilySeatCandidates, findFamilySeatForUser tarafından çağrılıyor —
  // obje literal içinde `this` güvenilir olmadığı için (repo obje yayılımı/
  // destructuring ile kullanılabiliyor) referans doğrudan bu değişkene
  // verilir, obje döndükten sonra kendi kendine `this.` ile çağrılmaz.
  const listFamilySeatCandidates = async (sponsorUserId) => {
    const { rows } = await rawQuery(
      `SELECT DISTINCT ON (hm.user_id)
              hm.user_id,
              u.display_name,
              hm.household_id,
              h.created_at AS household_created_at,
              hm.joined_at
         FROM household_member hm
         JOIN household h ON h.id = hm.household_id
         JOIN app_user u ON u.id = hm.user_id
        WHERE hm.household_id IN (
          SELECT household_id FROM household_member
           WHERE user_id = $1 AND role = 'owner'
        )
        ORDER BY hm.user_id, h.created_at, hm.joined_at`,
      [sponsorUserId],
    );
    // Sıralama: sponsor daima 1. koltuk, sonra household.created_at, sonra
    // household_member.joined_at ASC (plan §"en eski açık kalır"). DISTINCT
    // ON zaten kullanıcı bazında tekilleştirdi (aynı kişi sponsorun birden
    // fazla alanının üyesiyse en eski household+joined_at kazanır) — burada
    // sadece nihai koltuk sırası kuruluyor.
    return rows
      .map((row) => ({
        userId: row.user_id,
        displayName: row.display_name,
        householdId: row.household_id,
        householdCreatedAt: row.household_created_at,
        joinedAt: row.joined_at,
      }))
      .sort((a, b) => {
        if (a.userId === sponsorUserId) return -1;
        if (b.userId === sponsorUserId) return 1;
        if (a.householdCreatedAt.getTime() !== b.householdCreatedAt.getTime()) {
          return a.householdCreatedAt.getTime() - b.householdCreatedAt.getTime();
        }
        return a.joinedAt.getTime() - b.joinedAt.getTime();
      });
  };

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

    // entitlements.js'in familySeat girdisini besler — kullanıcının üye
    // olduğu alanlardan, aboneliği plan_tier='family' olan sahiplerini bulup
    // listFamilySeatCandidates ile sırasını hesaplar. Birden fazla aile
    // sponsoruna bağlıysa (nadir — iki farklı alana davetliyse) İLK bulunanı
    // döner; hangisi kazanırsa kazansın kullanıcı zaten PREMIUM olur, kesin
    // bir öncelik kuralı gerekmez.
    //
    // Ham sponsor status/current_period_end/seats döndürülür — canlı "koltuk
    // aktif mi" kararı isSubscriptionCurrentlyActive + rank<=seats ile
    // SADECE entitlements.js'te verilir (listOwnerSubscriptionsForUser ile
    // aynı ilke, hexagonal kısıt: repo I/O yapar, karar vermez).
    findFamilySeatForUser: async (userId) => {
      const { rows } = await rawQuery(
        `SELECT owner_sub.user_id AS sponsor_user_id,
                owner_user.display_name AS sponsor_name,
                owner_sub.status AS sponsor_status,
                owner_sub.current_period_end AS sponsor_current_period_end,
                owner_sub.seats AS seats
           FROM household_member hm
           JOIN household_member owner_hm
             ON owner_hm.household_id = hm.household_id AND owner_hm.role = 'owner'
           JOIN app_user owner_user ON owner_user.id = owner_hm.user_id
           JOIN subscription owner_sub ON owner_sub.user_id = owner_hm.user_id
          WHERE hm.user_id = $1 AND owner_sub.plan_tier = 'family'`,
        [userId],
      );
      if (rows.length === 0) return null;

      const sponsor = rows[0];
      const candidates = await listFamilySeatCandidates(sponsor.sponsor_user_id);
      const rank = candidates.findIndex((c) => c.userId === userId) + 1; // 1-based, 0 = bulunamadı

      return {
        sponsorUserId: sponsor.sponsor_user_id,
        sponsorName: sponsor.sponsor_name,
        sponsorStatus: sponsor.sponsor_status,
        sponsorCurrentPeriodEnd: sponsor.sponsor_current_period_end,
        seats: sponsor.seats,
        rank: rank > 0 ? rank : null,
        // households.<id> girdisi entitlements.js'te familySeat.householdId
        // olarak kullanılıyor — ilk eşleşen aday satırının alanı yeterli,
        // UI metni için (bkz. yorum: "hangisi kazanırsa kazansın").
        householdId: candidates.find((c) => c.userId === userId)?.householdId ?? null,
      };
    },

    // Abonelik ekranındaki koltuk roster'ı — SADECE aile abonesi SAHİP
    // kendi ekranında çağırır. seats sınırının üstündekiler active:false
    // (kullanıcı kimin premium olup olmadığını görebilsin, gizlemeyiz).
    listFamilySeats: async ({ ownerUserId, seats }) => {
      const candidates = await listFamilySeatCandidates(ownerUserId);
      return candidates.map((c, index) => ({
        userId: c.userId,
        displayName: c.displayName,
        householdId: c.householdId,
        active: index < seats,
      }));
    },
  };
};

export { makeHouseholdMemberRepository };
