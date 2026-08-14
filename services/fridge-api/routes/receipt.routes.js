import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '@fridge/helper';
import { requireAuth, requireHouseholdRole } from '@fridge/middlewares';
import { NotFoundError } from '@fridge/errors';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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

  router.post('/scan-text', asyncHandler(async (req, res) => {
    const scan = await useCases.uploadReceiptScanText({
      householdId: req.params.householdId,
      uploadedBy: req.user.id,
    });
    // Ham metni doğrudan işlenmiş kabul ediyoruz; kademe 1 atlandığı için
    // processReceiptScan'e rawText geçirilir (ocrPort mlkit-passthrough olmalı).
    await useCases.processReceiptScan({ scanId: scan.id, rawText: req.body.rawText });
    res.status(202).json({ scanId: scan.id, status: 'processing' });
  }));

  router.get('/:scanId/status', asyncHandler(async (req, res) => {
    const scan = await repos.receiptScanRepo.findById(req.params.scanId);
    if (!scan) throw new NotFoundError('Receipt scan not found');
    res.json({ status: scan.status, errorMessage: scan.errorMessage });
  }));

  router.get('/:scanId', asyncHandler(async (req, res) => {
    const scan = await repos.receiptScanRepo.findById(req.params.scanId);
    if (!scan) throw new NotFoundError('Receipt scan not found');
    const lineItems = await repos.receiptLineItemRepo.listByScanId(req.params.scanId);
    res.json({ scan, lineItems });
  }));

  router.post('/:scanId/retry', asyncHandler(async (req, res) => {
    const scan = await useCases.retryReceiptScan({ scanId: req.params.scanId });
    res.json({ scan });
  }));

  router.get('/:scanId/image', asyncHandler(async (req, res) => {
    const scan = await repos.receiptScanRepo.findById(req.params.scanId);
    if (!scan) throw new NotFoundError('Receipt scan not found');
    if (!scan.imagePath) {
      return res.status(404).json({ imageDeletedAt: scan.imageDeletedAt });
    }
    const buffer = await container.storagePort.read({ path: scan.imagePath });
    res.set('Content-Type', 'image/jpeg');
    res.send(buffer);
  }));

  router.delete('/:scanId/image', asyncHandler(async (req, res) => {
    const scan = await useCases.deleteReceiptImage({ scanId: req.params.scanId });
    res.json({ scan });
  }));

  router.patch('/:scanId/items/:itemId', asyncHandler(async (req, res) => {
    const item = await useCases.correctLineItem({
      lineItemId: req.params.itemId,
      householdId: req.params.householdId,
      parsedName: req.body.parsedName,
      parsedQuantity: req.body.parsedQuantity,
      parsedUnit: req.body.parsedUnit,
      matchedProductId: req.body.matchedProductId,
    });
    res.json({ item });
  }));

  router.post('/:scanId/confirm', asyncHandler(async (req, res) => {
    const scan = await useCases.confirmReceiptScan({
      scanId: req.params.scanId,
      actorUserId: req.user.id,
      storageLocationId: req.body.storageLocationId,
      itemSelections: req.body.itemSelections,
    });
    res.json({ scan });
  }));

  return router;
};

export { buildReceiptRouter };
