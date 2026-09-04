// Webhook idempotency + denetim izi. event_id PRIMARY KEY olduğu için aynı
// olay iki kez (RevenueCat retry, ağ tekrarı) geldiğinde ikinci INSERT
// ON CONFLICT DO NOTHING ile sessizce yutulur — apply-billing-event
// use-case'i bunu kontrol edip "zaten işlendi" olarak erken döner.
const makeBillingEventRepository = ({ rawQuery }) => {
  return {
    // true dönerse bu olay İLK KEZ kaydedildi (işlenmeli), false dönerse
    // daha önce görülmüş (atla).
    recordIfNew: async ({ eventId, userId, type, payload }) => {
      const { rows } = await rawQuery(
        `INSERT INTO billing_event (event_id, user_id, type, payload)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (event_id) DO NOTHING
         RETURNING event_id`,
        [eventId, userId, type, payload],
      );
      return rows.length > 0;
    },
  };
};

export { makeBillingEventRepository };
