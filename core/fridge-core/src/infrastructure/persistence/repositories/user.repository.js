const mapRow = (row) => row && ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
  displayName: row.display_name,
  locale: row.locale,
  // {allergens: [], diet: 'none'|..., dailyKcalTarget: null} — null olabilir.
  dietProfile: row.diet_profile ?? null,
  isGuest: row.is_guest ?? false,
  guestDeviceId: row.guest_device_id ?? null,
  lastSeenAt: row.last_seen_at ?? null,
  trialStartedAt: row.trial_started_at ?? null,
  trialEndsAt: row.trial_ends_at ?? null,
  trialDeviceId: row.trial_device_id ?? null,
});

const makeUserRepository = ({ rawQuery }) => {
  return {
    findByEmail: async (email) => {
      const { rows } = await rawQuery('SELECT * FROM app_user WHERE email = $1', [email]);
      return mapRow(rows[0]);
    },

    findById: async (id) => {
      const { rows } = await rawQuery('SELECT * FROM app_user WHERE id = $1', [id]);
      return mapRow(rows[0]);
    },

    // Aynı cihaz için zaten bir misafir hesabı varsa onu döndürür — uygulama
    // kapatılıp açıldığında ya da 401 sonrası yeniden bağlanıldığında yeni
    // bir misafir yaratıp veri kaybettirmemek için.
    findByGuestDeviceId: async (deviceId) => {
      const { rows } = await rawQuery('SELECT * FROM app_user WHERE guest_device_id = $1', [deviceId]);
      return mapRow(rows[0]);
    },

    create: async ({ email, passwordHash, displayName, locale, isGuest = false, guestDeviceId = null }) => {
      const { rows } = await rawQuery(
        `INSERT INTO app_user (email, password_hash, display_name, locale, is_guest, guest_device_id, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         RETURNING *`,
        [email, passwordHash, displayName, locale, isGuest, guestDeviceId],
      );
      return mapRow(rows[0]);
    },

    // Misafir hesabı kalıcı hesaba yükseltir — AYNI satır UPDATE edilir,
    // household/inventory/receipt hiç taşınmaz (zaten aynı user_id).
    upgradeGuestToRegistered: async (id, { email, passwordHash, displayName }) => {
      const { rows } = await rawQuery(
        `UPDATE app_user SET
           email = $2, password_hash = $3, display_name = $4,
           is_guest = false, guest_device_id = NULL, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id, email, passwordHash, displayName],
      );
      return mapRow(rows[0]);
    },

    touchLastSeen: async (id) => {
      await rawQuery('UPDATE app_user SET last_seen_at = now() WHERE id = $1', [id]);
    },

    // Temizlik scripti (purge-stale-guests.js) için — migrate.js zincirinin
    // DIŞINDA, cerebrum 2026-08-26 deseni.
    findStaleGuests: async (olderThan) => {
      const { rows } = await rawQuery(
        `SELECT * FROM app_user WHERE is_guest = true AND (last_seen_at IS NULL OR last_seen_at < $1)`,
        [olderThan],
      );
      return rows.map(mapRow);
    },

    deleteById: async (id) => {
      await rawQuery('DELETE FROM app_user WHERE id = $1', [id]);
    },

    update: async (id, { displayName, locale, dietProfile }) => {
      const { rows } = await rawQuery(
        `UPDATE app_user SET
           display_name = $2,
           locale = $3,
           diet_profile = CASE WHEN $4::boolean THEN $5::jsonb ELSE diet_profile END,
           updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id, displayName, locale, dietProfile !== undefined, dietProfile === undefined ? null : JSON.stringify(dietProfile)],
      );
      return mapRow(rows[0]);
    },

    updatePassword: async (id, passwordHash) => {
      await rawQuery(
        `UPDATE app_user SET password_hash = $2, updated_at = now() WHERE id = $1`,
        [id, passwordHash],
      );
    },

    // 14 günlük ters deneme — register/upgrade-guest akışında bir kez
    // çağrılır (bkz. start-reverse-trial.use-case.js). trialDeviceId aynı
    // cihazın ikinci kez deneme almasını önlemek için ayrı sorgulanır
    // (findTrialByDeviceId) — burası sadece yazar, karar use-case'te.
    startTrial: async (id, { startedAt, endsAt, deviceId }) => {
      const { rows } = await rawQuery(
        `UPDATE app_user SET
           trial_started_at = $2, trial_ends_at = $3, trial_device_id = $4, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id, startedAt, endsAt, deviceId],
      );
      return mapRow(rows[0]);
    },

    // Bu cihaz (guest_device_id VEYA trial_device_id eşleşen) daha önce
    // deneme almış mı? start-reverse-trial suistimal koruması burada karar
    // vermez — sadece "geçmişte var mıydı" bilgisini döner, sessizce
    // ücretsiz kademede başlatma kararı use-case'te.
    findTrialByDeviceId: async (deviceId) => {
      if (!deviceId) return null;
      const { rows } = await rawQuery(
        `SELECT * FROM app_user
         WHERE trial_device_id = $1 OR guest_device_id = $1
         LIMIT 1`,
        [deviceId],
      );
      return mapRow(rows[0]);
    },
  };
};

export { makeUserRepository };
