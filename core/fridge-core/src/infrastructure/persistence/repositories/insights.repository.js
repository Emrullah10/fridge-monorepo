// Para & israf paneli sorguları — hepsi stock_movement üzerinden tek tarama.
//
// stock_movement.unit_price hareket anında snapshot'landığı için (bkz.
// 15-inventory-price.sql), kalem sonradan silinse bile geçmiş doğru kalır.
// unit_price IS NULL satırlar toplamlara KATILMAZ, ayrıca "eksik fiyatlı N
// hareket" olarak raporlanır — sessizce 0 sayılmaz.

const num = (v) => (v === null || v === undefined ? 0 : Number(v));

const makeInsightsRepository = ({ rawQuery }) => {
  return {
    // from/to: ISO tarih (YYYY-MM-DD veya tam timestamp). to dahil değil (< to).
    getHouseholdInsights: async ({ householdId, from, to }) => {
      const params = [householdId, from, to];

      const totalsQ = rawQuery(
        `SELECT
           COALESCE(SUM(CASE WHEN reason IN ('consumed','recipe_used') AND unit_price IS NOT NULL
                             THEN abs(delta) * unit_price END), 0)                       AS saved,
           COALESCE(SUM(CASE WHEN reason IN ('expired','discarded') AND unit_price IS NOT NULL
                             THEN abs(delta) * unit_price END), 0)                       AS wasted,
           COALESCE(SUM(CASE WHEN reason = 'receipt' AND unit_price IS NOT NULL
                             THEN abs(delta) * unit_price END), 0)                       AS spent,
           COUNT(*) FILTER (WHERE reason IN ('consumed','recipe_used','expired','discarded')
                            AND unit_price IS NULL)                                      AS missing_price_count
         FROM stock_movement
         WHERE household_id = $1 AND created_at >= $2 AND created_at < $3`,
        params,
      );

      // Kategori kırılımı — israf + tüketim, ürünün kategorisine göre.
      const byCategoryQ = rawQuery(
        `SELECT
           COALESCE(pc.key, 'uncategorized')  AS category_key,
           COALESCE(SUM(CASE WHEN sm.reason IN ('consumed','recipe_used') THEN abs(sm.delta) * sm.unit_price END), 0) AS saved,
           COALESCE(SUM(CASE WHEN sm.reason IN ('expired','discarded')   THEN abs(sm.delta) * sm.unit_price END), 0) AS wasted
         FROM stock_movement sm
         LEFT JOIN product p ON p.id = sm.product_id
         LEFT JOIN product_category pc ON pc.id = p.category_id
         WHERE sm.household_id = $1 AND sm.created_at >= $2 AND sm.created_at < $3
           AND sm.unit_price IS NOT NULL
           AND sm.reason IN ('consumed','recipe_used','expired','discarded')
         GROUP BY COALESCE(pc.key, 'uncategorized')
         ORDER BY (COALESCE(SUM(CASE WHEN sm.reason IN ('expired','discarded') THEN abs(sm.delta) * sm.unit_price END), 0)) DESC`,
        params,
      );

      // Üye kırılımı — "kim ne kadar tüketti/israf etti". actor_user_id null
      // olabilir (sistem hareketi) → 'unknown' kovası.
      const byMemberQ = rawQuery(
        `SELECT
           sm.actor_user_id,
           u.display_name,
           COALESCE(SUM(CASE WHEN sm.reason IN ('consumed','recipe_used') THEN abs(sm.delta) * sm.unit_price END), 0) AS saved,
           COALESCE(SUM(CASE WHEN sm.reason IN ('expired','discarded')   THEN abs(sm.delta) * sm.unit_price END), 0) AS wasted
         FROM stock_movement sm
         LEFT JOIN app_user u ON u.id = sm.actor_user_id
         WHERE sm.household_id = $1 AND sm.created_at >= $2 AND sm.created_at < $3
           AND sm.unit_price IS NOT NULL
           AND sm.reason IN ('consumed','recipe_used','expired','discarded')
         GROUP BY sm.actor_user_id, u.display_name
         ORDER BY saved DESC`,
        params,
      );

      // En çok israf edilen ürünler (ilk 5).
      const topWastedQ = rawQuery(
        `SELECT
           p.canonical_name AS product_name,
           p.brand          AS product_brand,
           SUM(abs(sm.delta) * sm.unit_price) AS wasted,
           SUM(abs(sm.delta))                 AS quantity
         FROM stock_movement sm
         LEFT JOIN product p ON p.id = sm.product_id
         WHERE sm.household_id = $1 AND sm.created_at >= $2 AND sm.created_at < $3
           AND sm.unit_price IS NOT NULL
           AND sm.reason IN ('expired','discarded')
         GROUP BY p.canonical_name, p.brand
         ORDER BY wasted DESC
         LIMIT 5`,
        params,
      );

      const [totals, byCategory, byMember, topWasted] = await Promise.all([
        totalsQ, byCategoryQ, byMemberQ, topWastedQ,
      ]);

      const t = totals.rows[0];
      return {
        saved: num(t.saved),
        wasted: num(t.wasted),
        spent: num(t.spent),
        missingPriceCount: Number(t.missing_price_count),
        byCategory: byCategory.rows.map((r) => ({
          categoryKey: r.category_key,
          saved: num(r.saved),
          wasted: num(r.wasted),
        })),
        byMember: byMember.rows.map((r) => ({
          userId: r.actor_user_id,
          displayName: r.display_name ?? null,
          saved: num(r.saved),
          wasted: num(r.wasted),
        })),
        topWasted: topWasted.rows.map((r) => ({
          productName: r.product_name ?? null,
          productBrand: r.product_brand ?? null,
          wasted: num(r.wasted),
          quantity: num(r.quantity),
        })),
      };
    },
  };
};

export { makeInsightsRepository };
