// requireCapability middleware'i tarafından, kota kontrolü GEÇTİKTEN sonra
// çağrılır — asenkron fiş işleme akışında (worker sonra çalışır) kotayı
// İSTEK ANINDA ayırır, terminal hata/0-sonuç durumunda release ile iade
// edilir (bkz. release-ai-usage.use-case.js, scan-processor.js).
const makeReserveAiUsage = ({ usageCounterRepo }) => {
  return async ({ refId, userId, feature }) => {
    return usageCounterRepo.reserve({ refId, userId, feature });
  };
};

export { makeReserveAiUsage };
