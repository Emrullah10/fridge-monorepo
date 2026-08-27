// Open Food Facts barkod araması — ücretsiz, API anahtarı gerektirmez.
// https://world.openfoodfacts.org/api/v2/product/<barcode>.json
//
// Bulunamazsa null döner (hata değil — çoğu Türk marketi ürünü OFF'ta yok,
// bu normal). Ağ hatası da yutulur ve null döner: barkod araması bir
// KOLAYLIK, başarısızlığı akışı bloklamamalı (kullanıcı elle girer).
const makeOpenFoodFactsLookup = ({ fetchFn = fetch, userAgent = 'FridgeApp/1.0 (hi@fridge)' } = {}) => {
  return {
    lookup: async (barcode) => {
      const clean = String(barcode).replace(/\D/g, '');
      if (clean.length < 8) return null;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      try {
        const res = await fetchFn(
          `https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=product_name,product_name_tr,brands,quantity,nutriments`,
          { headers: { 'User-Agent': userAgent }, signal: controller.signal },
        );
        if (!res.ok) return null;
        const body = await res.json();
        if (body.status !== 1 || !body.product) return null;

        const p = body.product;
        const name = (p.product_name_tr || p.product_name || '').trim();
        if (!name) return null;

        const n = p.nutriments ?? {};
        // OFF besin değerleri "_100g" son ekiyle 100g/100ml başına gelir.
        const hasKcal = typeof n['energy-kcal_100g'] === 'number';
        const nutrition = hasKcal
          ? {
            kcal: Math.round(n['energy-kcal_100g']),
            protein: n.proteins_100g ?? null,
            carb: n.carbohydrates_100g ?? null,
            fat: n.fat_100g ?? null,
            basis: '100g',
          }
          : null;

        return {
          barcode: clean,
          name,
          brand: (p.brands || '').split(',')[0].trim() || null,
          packText: (p.quantity || '').trim() || null,
          nutrition,
        };
      } catch {
        return null;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
};

export { makeOpenFoodFactsLookup };
