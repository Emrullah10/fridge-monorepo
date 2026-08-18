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

// İkinci savunma hattı: normalize sonrası harf içermeyen veya çok kısa bir
// metin kaldıysa bu satır asla anlamlı bir alias olamaz. Gerçek olay
// (2026-08-18): "*9,90" fiyat düzeltmesinden sonra normalize "*" döndürdü,
// bu tek karakterlik alias sonraki HER fiyat satırına yanlışlıkla eşleşti
// ("Unknown" adlı çöp ürün 9 kez yeniden kullanıldı). Kaynak filtre
// (process-receipt-scan.use-case.js: isNonProductLine) bu tür satırları
// artık AI'a hiç göndermiyor, ama bu kontrol filtre bir gün yine bir şey
// kaçırırsa çöp alias birikmesini kökten engelliyor.
const isMeaninglessAliasText = (normalizedText) =>
  !normalizedText || normalizedText.length < 2 || !/[a-zçğıöşü]/.test(normalizedText);

const makeProductAliasRepository = ({ rawQuery }) => {
  return {
    // Kademe 1: household'a özel veya global tam eşleşme (household'a özel öncelikli).
    findExactMatch: async ({ householdId, rawText }) => {
      const normalizedText = normalizeAliasText(rawText);
      if (isMeaninglessAliasText(normalizedText)) return undefined;
      const { rows } = await rawQuery(
        `SELECT * FROM product_alias
         WHERE normalized_text = $2 AND (household_id = $1 OR household_id IS NULL)
         ORDER BY household_id NULLS LAST
         LIMIT 1`,
        [householdId, normalizedText],
      );
      return mapRow(rows[0]);
    },

    // Kademe 2: pg_trgm benzerlik araması.
    findBestTrigramMatch: async ({ householdId, rawText }) => {
      const normalizedText = normalizeAliasText(rawText);
      if (isMeaninglessAliasText(normalizedText)) return undefined;
      const { rows } = await rawQuery(
        `SELECT *, similarity(normalized_text, $2) AS sim
         FROM product_alias
         WHERE (household_id = $1 OR household_id IS NULL)
           AND similarity(normalized_text, $2) > $3
         ORDER BY sim DESC
         LIMIT 1`,
        [householdId, normalizedText, TRIGRAM_SIMILARITY_THRESHOLD],
      );
      return rows[0] && { ...mapRow(rows[0]), similarity: Number(rows[0].sim) };
    },

    // source: 'user_correction' (kullanıcı düzeltti) veya 'model' (AI otomatik
    // ürün oluşturdu, henüz kimse doğrulamadı). Confidence bu ayrımı yansıtır.
    upsertUserCorrection: async ({ householdId, rawText, productId, source = 'user_correction' }) => {
      const normalizedText = normalizeAliasText(rawText);
      if (isMeaninglessAliasText(normalizedText)) return undefined;
      const confidence = source === 'user_correction' ? 1.0 : 0.5;
      const { rows } = await rawQuery(
        `INSERT INTO product_alias (household_id, raw_text, normalized_text, product_id, source, confidence, hit_count)
         VALUES ($1, $2, $3, $4, $5, $6, 1)
         ON CONFLICT (household_id, normalized_text) WHERE household_id IS NOT NULL
         DO UPDATE SET product_id = EXCLUDED.product_id, source = EXCLUDED.source,
                        confidence = EXCLUDED.confidence, hit_count = product_alias.hit_count + 1, updated_at = now()
         RETURNING *`,
        [householdId, rawText, normalizedText, productId, source, confidence],
      );
      return mapRow(rows[0]);
    },
  };
};

export { makeProductAliasRepository, TRIGRAM_SIMILARITY_THRESHOLD, normalizeAliasText };
