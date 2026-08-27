import { ValidationError } from '@fridge/errors';

// Barkoddan ürün çözer. Sıra:
//   1. Katalogda barkodlu ürün var mı (findByBarcode) -> döndür (matched)
//   2. Open Food Facts'te var mı -> yeni product yarat (source 'user',
//      barkod + besin değeriyle) -> döndür (created)
//   3. Hiçbiri -> { found: false, barcode } (mobil manuel ekleme ekranını
//      barkodla önden doldurur)
//
// Yeni ürün burada YARATILIYOR (generate-ai-recipes'in aksine) çünkü barkod
// GÜVENİLİR bir kimlik — kirlenme döngüsü riski yok, aynı barkod hep aynı
// üründür. category_id null bırakılır; kullanıcı fiş onayındaki gibi sonradan
// düzeltebilir.
const makeLookupBarcode = ({ productRepo, barcodeLookupPort }) => {
  return async ({ barcode }) => {
    const clean = String(barcode ?? '').replace(/\D/g, '');
    if (clean.length < 8) {
      throw new ValidationError('Geçersiz barkod');
    }

    const existing = await productRepo.findByBarcode(clean);
    if (existing) {
      return { found: true, source: 'catalog', product: existing };
    }

    const off = await barcodeLookupPort.lookup(clean);
    if (!off) {
      return { found: false, barcode: clean };
    }

    const created = await productRepo.create({
      canonicalName: off.name,
      brand: off.brand,
      defaultUnit: 'piece',
      source: 'user',
      barcode: clean,
      nutrition: off.nutrition,
    });

    return { found: true, source: 'openfoodfacts', product: created, packText: off.packText };
  };
};

export { makeLookupBarcode };
