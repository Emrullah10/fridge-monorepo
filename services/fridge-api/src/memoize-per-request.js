// Faz 0 performans turu: bir istek içinde requireUnlockedHousehold +
// requireCapability/requireStructuralLimit/requirePlanFeature aynı userId
// için getEntitlements'ı 2-3 KEZ çağırabiliyor — her çağrı 4-5 paralel DB
// sorgusu (bkz. get-entitlements.use-case.js Promise.all). Bu sarmalayıcı,
// sonucu SADECE o HTTP isteğinin ömrü boyunca (req üzerinde) saklar.
//
// Bu bir CACHE DEĞİL — request'ler arası hiçbir şey paylaşılmaz, bayatlama
// riski sıfır (aynı isteğin ömrü içinde plan/kota zaten değişemez, çünkü
// değiştiren tek şey requireCapability'nin KENDİSİNİN rezervasyonu ve o da
// SONRAKİ isteğe yansır). getEntitlements üçüncü parametre olarak `req`
// alacak şekilde çağrılmalı (middleware'ler zaten böyle çağırıyor, bkz.
// require-capability.js/require-structural-limit.js/require-plan-feature.js/
// require-unlocked-household.js) — req verilmezse (ör. route'un kendisi
// elle çağırıyorsa) memoization atlanır, doğrudan asıl fonksiyona düşer.
const REQUEST_CACHE_KEY = Symbol('getEntitlementsPerRequestCache');

const memoizeGetEntitlementsPerRequest = (getEntitlements) => {
  return (args, req) => {
    if (!req) return getEntitlements(args);

    if (!req[REQUEST_CACHE_KEY]) req[REQUEST_CACHE_KEY] = new Map();
    const cache = req[REQUEST_CACHE_KEY];

    // Anahtar userId+platform: aynı istekte teorik olarak farklı bir userId
    // için çağrılmaz ama platform sabit olduğu için (req.clientPlatform,
    // istek boyunca değişmez) bu pratikte hep aynı anahtara düşer — yine de
    // yanlışlıkla farklı userId ile çağrılırsa YANLIŞ kullanıcının sonucunu
    // asla döndürmemesi için anahtara dahil edildi.
    const key = `${args.userId}:${args.platform ?? 'android'}`;
    if (cache.has(key)) return cache.get(key);

    const promise = getEntitlements(args);
    cache.set(key, promise);
    return promise;
  };
};

export { memoizeGetEntitlementsPerRequest };
