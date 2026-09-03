const mapRow = (row) => row && ({
  id: row.id,
  userId: row.user_id,
  store: row.store,
  productId: row.product_id,
  purchaseToken: row.purchase_token,
  rcAppUserId: row.rc_app_user_id,
  status: row.status,
  autoRenewing: row.auto_renewing,
  currentPeriodEnd: row.current_period_end,
  canceledAt: row.canceled_at,
  cancelReason: row.cancel_reason,
  environment: row.environment,
  lastEventAt: row.last_event_at,
  raw: row.raw,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// user_id UNIQUE olduğu için her kullanıcının en fazla bir abonelik satırı
// vardır — plan/aylık→yıllık geçişte aynı satır UPSERT edilir (yeni satır
// açılmaz), purchase_token güncellenir. Bu, entitlements.js'in "tek
// subscription objesi" varsayımıyla uyumlu.
const makeSubscriptionRepository = ({ rawQuery }) => {
  return {
    findByUserId: async (userId) => {
      const { rows } = await rawQuery('SELECT * FROM subscription WHERE user_id = $1', [userId]);
      return mapRow(rows[0]);
    },

    findByPurchaseToken: async (purchaseToken) => {
      const { rows } = await rawQuery('SELECT * FROM subscription WHERE purchase_token = $1', [purchaseToken]);
      return mapRow(rows[0]);
    },

    // apply-billing-event.use-case.js webhook her geldiğinde bunu çağırır.
    // ON CONFLICT (user_id) DO UPDATE — kullanıcı ürün değiştirse (aylık↔
    // yıllık) veya resubscribe etse bile TEK satır kalır, geçmiş satırlar
    // billing_event tablosunda (event_id PK, ayrı) zaten denetim izi olarak
    // duruyor.
    upsert: async ({
      userId, store, productId, purchaseToken, rcAppUserId, status,
      autoRenewing, currentPeriodEnd, canceledAt, cancelReason, environment, raw,
    }) => {
      const { rows } = await rawQuery(
        `INSERT INTO subscription
           (user_id, store, product_id, purchase_token, rc_app_user_id, status,
            auto_renewing, current_period_end, canceled_at, cancel_reason, environment,
            last_event_at, raw, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now(), $12, now())
         ON CONFLICT (user_id) DO UPDATE SET
           store = EXCLUDED.store,
           product_id = EXCLUDED.product_id,
           purchase_token = EXCLUDED.purchase_token,
           rc_app_user_id = EXCLUDED.rc_app_user_id,
           status = EXCLUDED.status,
           auto_renewing = EXCLUDED.auto_renewing,
           current_period_end = EXCLUDED.current_period_end,
           canceled_at = EXCLUDED.canceled_at,
           cancel_reason = EXCLUDED.cancel_reason,
           environment = EXCLUDED.environment,
           last_event_at = now(),
           raw = EXCLUDED.raw,
           updated_at = now()
         RETURNING *`,
        [userId, store, productId, purchaseToken, rcAppUserId, status,
          autoRenewing, currentPeriodEnd, canceledAt, cancelReason, environment, raw],
      );
      return mapRow(rows[0]);
    },

    // Gecelik mutabakat cron'u — dönemi bugün+1 gün içinde bitecek TÜM
    // aktif/grace/canceled abonelikleri döner, her biri için RevenueCat'ten
    // taze durum çekilip yeniden upsert edilir (kaçan webhook'un ağı).
    listExpiringSoon: async ({ withinHours = 24 } = {}) => {
      const { rows } = await rawQuery(
        `SELECT * FROM subscription
         WHERE status IN ('active','in_grace','canceled')
           AND current_period_end IS NOT NULL
           AND current_period_end < now() + ($1 || ' hours')::interval`,
        [withinHours],
      );
      return rows.map(mapRow);
    },
  };
};

export { makeSubscriptionRepository };
