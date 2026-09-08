// boot.js'ten ayrıştırıldı — Express'e bağımlı olmayan saf mantık,
// container mock'uyla doğrudan test edilebilir.
//
// ?platform=ios ile iOS'a özel değerler (iTunes Lookup üzerinden okunan
// cachedAppStoreVersion + App Store URL'i) döner. Param yoksa (eski
// istemciler dahil) mevcut Android davranışı değişmeden korunur — yanıt
// şeması her iki durumda da aynı 3 alan.
const buildAppConfigHandler = (container) => async (req, res) => {
  const isIos = req.query.platform === 'ios';
  res.json({
    latestVersion: isIos
      ? await container.cachedAppStoreVersion.getLatestVersion()
      : await container.cachedPlayVersion.getLatestVersion(),
    minSupportedVersion: isIos
      ? container.config.appMinSupportedVersionIos
      : container.config.appMinSupportedVersion,
    storeUrl: isIos ? container.config.appStoreUrlIos : container.config.appStoreUrl,
  });
};

export { buildAppConfigHandler };
