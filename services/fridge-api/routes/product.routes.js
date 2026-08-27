import { Router } from 'express';
import { asyncHandler } from '@fridge/helper';
import { requireAuth, requireHouseholdRole } from '@fridge/middlewares';

const buildProductRouter = ({ container }) => {
  const router = Router({ mergeParams: true });
  const { repos, useCases } = container;

  router.use(requireAuth());
  router.use(requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'viewer' }));

  // Barkod -> ürün. Katalogda yoksa Open Food Facts'ten çekip yaratır.
  // found:false ise mobil manuel ekleme ekranını barkodla önden doldurur.
  router.get('/barcode/:code', asyncHandler(async (req, res) => {
    const result = await useCases.lookupBarcode({ barcode: req.params.code });
    res.json(result);
  }));

  // Ürün seçici (fiş düzeltme, manuel envanter ekleme) burayı kullanır.
  // Boş q ile en yeni/global ürünler listelenir.
  router.get('/', asyncHandler(async (req, res) => {
    const products = await repos.productRepo.search({
      householdId: req.params.householdId,
      query: req.query.q ?? '',
    });
    res.json({ products });
  }));

  // Fiş onay ekranındaki kategori düzenleme dropdown'ı bunu kullanır
  // (bkz. correct-line-item.use-case.js categoryKey).
  router.get('/categories', asyncHandler(async (req, res) => {
    const categories = await repos.productCategoryRepo.listAll();
    res.json({ categories });
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const product = await repos.productRepo.create({
      householdId: req.params.householdId,
      canonicalName: req.body.canonicalName,
      defaultUnit: req.body.defaultUnit ?? 'piece',
      source: 'user',
    });
    res.status(201).json({ product });
  }));

  return router;
};

export { buildProductRouter };
