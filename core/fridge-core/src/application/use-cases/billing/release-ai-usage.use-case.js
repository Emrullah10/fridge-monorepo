// Kota yakmayan durumlar için çağrılır: AI_QUOTA_EXCEEDED, AI_BUSY,
// AI_TIMEOUT, NETWORK_ERROR, AI_DISABLED, ve fiş taramada 0 ürün bulunması.
// Kullanıcı bir değer almadıysa ödemez (plan §Faz 3). İdempotent — released
// zaten true ise ikinci çağrı sayaç düşürmez (usage-counter.repository.js).
const makeReleaseAiUsage = ({ usageCounterRepo }) => {
  return async ({ refId }) => {
    return usageCounterRepo.release({ refId });
  };
};

export { makeReleaseAiUsage };
