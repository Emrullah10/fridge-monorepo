const mapRow = (row) => row && ({
  id: row.id,
  householdId: row.household_id,
  uploadedBy: row.uploaded_by,
  status: row.status,
  errorMessage: row.error_message,
  merchantName: row.merchant_name,
  purchasedAt: row.purchased_at,
  totalAmount: row.total_amount === null ? null : Number(row.total_amount),
  currency: row.currency,
  imagePath: row.image_path,
  imageBytes: row.image_bytes,
  imageSha256: row.image_sha256,
  imageDeletedAt: row.image_deleted_at,
  rawText: row.raw_text,
  ocrProvider: row.ocr_provider,
  parserProvider: row.parser_provider,
  parserModel: row.parser_model,
  attemptCount: row.attempt_count,
  processingStartedAt: row.processing_started_at,
  createdAt: row.created_at,
});

const makeReceiptScanRepository = ({ rawQuery }) => {
  return {
    create: async ({ householdId, uploadedBy, imagePath = null, imageBytes = null, imageSha256 = null }) => {
      const { rows } = await rawQuery(
        `INSERT INTO receipt_scan (household_id, uploaded_by, status, image_path, image_bytes, image_sha256)
         VALUES ($1, $2, 'uploaded', $3, $4, $5) RETURNING *`,
        [householdId, uploadedBy, imagePath, imageBytes, imageSha256],
      );
      return mapRow(rows[0]);
    },

    findById: async (id) => {
      const { rows } = await rawQuery('SELECT * FROM receipt_scan WHERE id = $1', [id]);
      return mapRow(rows[0]);
    },

    // Kademe kuyruğu: SKIP LOCKED sayesinde birden fazla worker aynı fişi kapmaz.
    claimNextUploaded: async () => {
      const { rows } = await rawQuery(
        `UPDATE receipt_scan SET status = 'processing', processing_started_at = now(),
                attempt_count = attempt_count + 1
         WHERE id = (
           SELECT id FROM receipt_scan
           WHERE status = 'uploaded'
           ORDER BY created_at
           LIMIT 1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING *`,
      );
      return mapRow(rows[0]);
    },

    markReviewPending: async (id, { rawText, ocrProvider, parserProvider, parserModel, merchantName, purchasedAt, totalAmount }) => {
      const { rows } = await rawQuery(
        `UPDATE receipt_scan SET
           status = 'review_pending', raw_text = $2, ocr_provider = $3,
           parser_provider = $4, parser_model = $5, merchant_name = $6,
           purchased_at = $7, total_amount = $8, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id, rawText, ocrProvider, parserProvider, parserModel, merchantName, purchasedAt, totalAmount],
      );
      return mapRow(rows[0]);
    },

    markFailed: async (id, errorMessage) => {
      const { rows } = await rawQuery(
        `UPDATE receipt_scan SET status = 'failed', error_message = $2, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id, errorMessage],
      );
      return mapRow(rows[0]);
    },

    markCompleted: async (id) => {
      const { rows } = await rawQuery(
        `UPDATE receipt_scan SET status = 'completed', updated_at = now() WHERE id = $1 RETURNING *`,
        [id],
      );
      return mapRow(rows[0]);
    },

    resetToUploaded: async (id) => {
      const { rows } = await rawQuery(
        `UPDATE receipt_scan SET status = 'uploaded', error_message = NULL, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id],
      );
      return mapRow(rows[0]);
    },

    markImageDeleted: async (id) => {
      await rawQuery(
        `UPDATE receipt_scan SET image_deleted_at = now(), image_path = NULL WHERE id = $1`,
        [id],
      );
    },

    listImagesOlderThan: async ({ householdId, cutoffDate }) => {
      const { rows } = await rawQuery(
        `SELECT * FROM receipt_scan
         WHERE household_id = $1 AND image_path IS NOT NULL AND created_at < $2`,
        [householdId, cutoffDate],
      );
      return rows.map(mapRow);
    },
  };
};

export { makeReceiptScanRepository };
