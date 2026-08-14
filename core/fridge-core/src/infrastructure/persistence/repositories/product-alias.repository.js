const mapRow = (row) => row && ({
  id: row.id,
  householdId: row.household_id,
  rawText: row.raw_text,
  normalizedText: row.normalized_text,
  productId: row.product_id,
  source: row.source,
  confidence: Number(row.confidence),
  hitCount: row.hit_count,
});

const TRIGRAM_SIMILARITY_THRESHOLD = 0.4;

// Fiş satırındaki fiyat ve KDV işaretleri her alışverişte değişir; bunlar
// alias anahtarında kalırsa "COCA COLA 2.5LT 45,00" ile "... 52,00" ayrı
// kayıtlar olur ve öğrenme boşa gider. Eşleştirme bu yüzden fiyattan
// arındırılmış, sadeleştirilmiş metin üzerinden yapılır.
const normalizeAliasText = (rawText) =>
  (rawText ?? '')
    .replace(/%\s*\d+/g, ' ')            // KDV oranı: "%8"
    .replace(/\d+[.,]\d{2}\s*$/g, ' ')   // satır sonundaki fiyat: "45,00"
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('tr-TR');

const makeProductAliasRepository = ({ rawQuery }) => {
  return {
    // Kademe 1: household'a özel veya global tam eşleşme (household'a özel öncelikli).
    findExactMatch: async ({ householdId, rawText }) => {
      const { rows } = await rawQuery(
        `SELECT * FROM product_alias
         WHERE normalized_text = $2 AND (household_id = $1 OR household_id IS NULL)
         ORDER BY household_id NULLS LAST
         LIMIT 1`,
        [householdId, normalizeAliasText(rawText)],
      );
      return mapRow(rows[0]);
    },

    // Kademe 2: pg_trgm benzerlik araması.
    findBestTrigramMatch: async ({ householdId, rawText }) => {
      const { rows } = await rawQuery(
        `SELECT *, similarity(normalized_text, $2) AS sim
         FROM product_alias
         WHERE (household_id = $1 OR household_id IS NULL)
           AND similarity(normalized_text, $2) > $3
         ORDER BY sim DESC
         LIMIT 1`,
        [householdId, normalizeAliasText(rawText), TRIGRAM_SIMILARITY_THRESHOLD],
      );
      return rows[0] && { ...mapRow(rows[0]), similarity: Number(rows[0].sim) };
    },

    upsertUserCorrection: async ({ householdId, rawText, productId }) => {
      const normalizedText = normalizeAliasText(rawText);
      const { rows } = await rawQuery(
        `INSERT INTO product_alias (household_id, raw_text, normalized_text, product_id, source, confidence, hit_count)
         VALUES ($1, $2, $3, $4, 'user_correction', 1.0, 1)
         ON CONFLICT (household_id, normalized_text) WHERE household_id IS NOT NULL
         DO UPDATE SET product_id = EXCLUDED.product_id, hit_count = product_alias.hit_count + 1, updated_at = now()
         RETURNING *`,
        [householdId, rawText, normalizedText, productId],
      );
      return mapRow(rows[0]);
    },
  };
};

export { makeProductAliasRepository, TRIGRAM_SIMILARITY_THRESHOLD, normalizeAliasText };
