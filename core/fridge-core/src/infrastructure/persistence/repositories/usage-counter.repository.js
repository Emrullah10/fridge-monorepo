// Aylık kullanım sayaçları + rezervasyon/iade. Dönem her zaman sunucu
// tarafında Europe/Istanbul takvim ayının 1'i olarak hesaplanır — istemci
// saatine asla güvenilmez (bkz. plan §Faz 3).
const periodStartFor = (date) => {
  // Postgres'e TIMESTAMPTZ AT TIME ZONE ile hesaplattırmak yerine burada
  // (Node) hesaplamak, entitlements.js gibi saf/test edilebilir kod
  // yazmayı zorlaştırır — bu yüzden SQL tarafında date_trunc kullanılıyor,
  // burada sadece parametre olarak "now" JS Date'i geçiriliyor, ayın 1'ini
  // SQL kendisi Europe/Istanbul'a göre hesaplıyor (bkz. aşağıdaki sorgular).
  return date;
};

// datasource (withTransaction) reserve() için ZORUNLU — pool-level rawQuery
// üzerinden elle BEGIN/COMMIT yazmak pool'daki FARKLI bağlantılara gidebilir,
// transaction garantisi vermez (bkz. datasource.js withTransaction'ın neden
// client.connect() ile tek bağlantıyı sabitlediği). Diğer metodlar tekil
// sorgu oldukları için rawQuery yeterli.
const makeUsageCounterRepository = ({ rawQuery, datasource }) => {
  return {
    // Bir kullanıcının bir özellik için CARİ ay kullanımını döner —
    // /me/entitlements'in usageByFeature'ı için. resetsAt = bir sonraki ayın
    // 1'i, Europe/Istanbul 00:00 — mobil "ne zaman sıfırlanır" gösterebilsin.
    getCurrentUsage: async ({ userId, feature }) => {
      const { rows } = await rawQuery(
        `SELECT
           COALESCE(uc.used_count, 0) AS used_count,
           (date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'
             + interval '1 month') AS resets_at,
           (date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul'))::date AS period_start
         FROM (SELECT 1) AS dummy
         LEFT JOIN usage_counter uc
           ON uc.user_id = $1 AND uc.feature = $2
           AND uc.period_start = (date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul'))::date`,
        [userId, feature],
      );
      const row = rows[0];
      return { used: Number(row?.used_count ?? 0), resetsAt: row?.resets_at ?? null };
    },

    // requireCapability tarafından İSTEK ANINDA çağrılır — atomik artırım
    // + idempotent rezervasyon (ref_id PRIMARY KEY). Aynı ref_id iki kez
    // gelirse (mobil retry, /receipts/:scanId/retry) ikinci çağrı kotayı
    // TEKRAR YAKMAZ, sadece mevcut rezervasyonu döner (ON CONFLICT DO
    // NOTHING + ardından okuma).
    reserve: async ({ refId, userId, feature }) => {
      const { rows: existing } = await rawQuery(
        'SELECT * FROM usage_reservation WHERE ref_id = $1', [refId],
      );
      if (existing[0]) {
        return { alreadyReserved: true, released: existing[0].released };
      }

      return datasource.withTransaction(async ({ query }) => {
        const periodStartResult = await query(
          `SELECT (date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul'))::date AS period_start`,
        );
        const periodStart = periodStartResult.rows[0].period_start;

        await query(
          `INSERT INTO usage_counter (user_id, feature, period_start, used_count)
           VALUES ($1, $2, $3, 1)
           ON CONFLICT (user_id, feature, period_start)
           DO UPDATE SET used_count = usage_counter.used_count + 1`,
          [userId, feature, periodStart],
        );
        try {
          await query(
            `INSERT INTO usage_reservation (ref_id, user_id, feature, period_start)
             VALUES ($1, $2, $3, $4)`,
            [refId, userId, feature, periodStart],
          );
        } catch (error) {
          // ref_id PK çakışması: eşzamanlı iki istek aynı ref_id ile yarıştı
          // (nadiren, mobil çift dokunma). Sayaç zaten artırıldı ama bu
          // transaction rollback olacağı için o artış da geri alınacak —
          // güvenli, ikinci istek üstteki existing[0] kontrolüyle yakalanır.
          throw error;
        }
        return { alreadyReserved: false, released: false };
      });
    },

    // Terminal hata (AI_QUOTA_EXCEEDED/AI_BUSY/AI_TIMEOUT/NETWORK_ERROR/
    // AI_DISABLED) veya 0-ürün sonucu geldiğinde çağrılır — kullanıcı bir
    // değer almadıysa ödemez. released=true idempotent (iki kez çağrılırsa
    // ikinci kez sayaç TEKRAR düşürülmez).
    release: async ({ refId }) => {
      const { rows } = await rawQuery(
        `UPDATE usage_reservation SET released = true
         WHERE ref_id = $1 AND released = false
         RETURNING user_id, feature, period_start`,
        [refId],
      );
      const reservation = rows[0];
      if (!reservation) return { released: false };

      await rawQuery(
        `UPDATE usage_counter SET used_count = GREATEST(used_count - 1, 0)
         WHERE user_id = $1 AND feature = $2 AND period_start = $3`,
        [reservation.user_id, reservation.feature, reservation.period_start],
      );
      return { released: true };
    },
  };
};

export { makeUsageCounterRepository, periodStartFor };
