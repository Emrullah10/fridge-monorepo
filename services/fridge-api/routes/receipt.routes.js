import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '@fridge/helper';
import { requireAuth, requireHouseholdRole, rateLimiter } from '@fridge/middlewares';
import { NotFoundError, ValidationError } from '@fridge/errors';
import { assertOwnedByHousehold } from './helpers/assert-owned-by-household.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const MAX_RAW_TEXT_LENGTH = 20000;

// /scan-text her satırda parser'ı (Gemini API, ücretli) tetikliyor —
// doğrulanmamış/sınırsız bırakılırsa hem 500 hatası hem sınırsız API
// harcaması riski. dakikada 20 istek tek kullanıcı için cömert bir üst sınır.
const scanTextRateLimiter = rateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  keyFn: (req) => req.user?.id ?? req.ip,
});

const buildReceiptRouter = ({ container }) => {
  const router = Router({ mergeParams: true });
  const { useCases, repos } = container;

  router.use(requireAuth());
  router.use(requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'member' }));

  router.post('/scan', upload.single('image'), asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'image file is required' } });
    }
    const extension = req.file.originalname.split('.').pop() || 'jpg';
    const scan = await useCases.uploadReceiptScan({
      householdId: req.params.householdId,
      uploadedBy: req.user.id,
      imageBuffer: req.file.buffer,
      extension,
    });
    res.status(202).json({ scanId: scan.id, status: scan.status });
  }));

  router.post('/scan-text', scanTextRateLimiter, asyncHandler(async (req, res) => {
    const { rawText } = req.body ?? {};
    if (typeof rawText !== 'string' || rawText.trim().length === 0) {
      throw new ValidationError('rawText gerekli');
    }
    if (rawText.length > MAX_RAW_TEXT_LENGTH) {
      throw new ValidationError(`rawText ${MAX_RAW_TEXT_LENGTH} karakteri aşamaz`);
    }

    const scan = await useCases.uploadReceiptScanText({
      householdId: req.params.householdId,
      uploadedBy: req.user.id,
    });
    // Ham metni doğrudan işlenmiş kabul ediyoruz; kademe 1 atlandığı için
    // processReceiptScan'e rawText geçirilir (ocrPort mlkit-passthrough olmalı).
    await useCases.processReceiptScan({ scanId: scan.id, rawText });
    res.status(202).json({ scanId: scan.id, status: 'processing' });
  }));

  router.get('/:scanId/status', asyncHandler(async (req, res) => {
    const scan = await repos.receiptScanRepo.findById(req.params.scanId);
    assertOwnedByHousehold(scan, req.params.householdId, 'Receipt scan not found');
    res.json({ status: scan.status, errorMessage: scan.errorMessage });
  }));

  router.get('/:scanId', asyncHandler(async (req, res) => {
    const scan = await repos.receiptScanRepo.findById(req.params.scanId);
    assertOwnedByHousehold(scan, req.params.householdId, 'Receipt scan not found');
    const lineItems = await repos.receiptLineItemRepo.listByScanId(req.params.scanId);
    res.json({ scan, lineItems });
  }));

  router.post('/:scanId/retry', asyncHandler(async (req, res) => {
    const existing = await repos.receiptScanRepo.findById(req.params.scanId);
    assertOwnedByHousehold(existing, req.params.householdId, 'Receipt scan not found');
    const scan = await useCases.retryReceiptScan({ scanId: req.params.scanId });
    res.json({ scan });
  }));

  router.get('/:scanId/image', asyncHandler(async (req, res) => {
    const scan = await repos.receiptScanRepo.findById(req.params.scanId);
    assertOwnedByHousehold(scan, req.params.householdId, 'Receipt scan not found');
    if (!scan.imagePath) {
      return res.status(404).json({ error: { code: 'IMAGE_NOT_FOUND', message: 'Image not available' }, imageDeletedAt: scan.imageDeletedAt });
    }
    const buffer = await container.storagePort.read({ path: scan.imagePath });
    const extension = scan.imagePath.split('.').pop()?.toLowerCase();
    const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';
    res.set('Content-Type', contentType);
    res.send(buffer);
  }));

  router.delete('/:scanId/image', asyncHandler(async (req, res) => {
    const existing = await repos.receiptScanRepo.findById(req.params.scanId);
    assertOwnedByHousehold(existing, req.params.householdId, 'Receipt scan not found');
    const scan = await useCases.deleteReceiptImage({ scanId: req.params.scanId });
    res.json({ scan });
  }));

  router.patch('/:scanId/items/:itemId', asyncHandler(async (req, res) => {
    const scan = await repos.receiptScanRepo.findById(req.params.scanId);
    assertOwnedByHousehold(scan, req.params.householdId, 'Receipt scan not found');

    const lineItem = await repos.receiptLineItemRepo.findById(req.params.itemId);
    if (!lineItem || lineItem.receiptScanId !== req.params.scanId) {
      throw new NotFoundError('Line item not found');
    }

    const item = await useCases.correctLineItem({
      lineItemId: req.params.itemId,
      householdId: req.params.householdId,
      parsedName: req.body.parsedName,
      parsedBrand: req.body.parsedBrand,
      parsedQuantity: req.body.parsedQuantity,
      parsedUnit: req.body.parsedUnit,
      matchedProductId: req.body.matchedProductId,
    });
    res.json({ item });
  }));

  router.post('/:scanId/confirm', asyncHandler(async (req, res) => {
    const scan = await repos.receiptScanRepo.findById(req.params.scanId);
    assertOwnedByHousehold(scan, req.params.householdId, 'Receipt scan not found');

    const confirmed = await useCases.confirmReceiptScan({
      scanId: req.params.scanId,
      actorUserId: req.user.id,
      storageLocationId: req.body.storageLocationId,
      itemSelections: req.body.itemSelections,
    });
    res.json({ scan: confirmed });
  }));

  return router;
};

export { buildReceiptRouter };
