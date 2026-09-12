// Para & israf paneli. Varsayılan dönem: içinde bulunulan takvim ayı.
// from/to verilirse onlar kullanılır (to dahil değil).
const makeGetHouseholdInsights = ({ insightsRepo, clock }) => {
  return async ({ householdId, from, to }) => {
    let fromDate = from;
    let toDate = to;

    // BUG (2026-09-12 düzeltildi): `from` dolu + `to` boşken (mobil "son N
    // gün" seçimlerinin eski davranışı) bu blok ikisini de "içinde
    // bulunulan ay"a göre dolduruyordu — `toDate` şimdi DEĞİL, ayın 1'i +
    // 1 ay oluyordu. "Son 90 gün" etiketiyle gerçekte sorgulanan aralık
    // uyuşmuyordu. Artık `from` tek başına doluysa `to` = şimdi.
    if (fromDate && !toDate) {
      toDate = clock.now().toISOString();
    } else if (!fromDate || !toDate) {
      const now = clock.now();
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth();
      fromDate = fromDate ?? new Date(Date.UTC(y, m, 1)).toISOString();
      toDate = toDate ?? new Date(Date.UTC(y, m + 1, 1)).toISOString();
    }

    const data = await insightsRepo.getHouseholdInsights({
      householdId,
      from: fromDate,
      to: toDate,
    });

    return { period: { from: fromDate, to: toDate }, ...data };
  };
};

export { makeGetHouseholdInsights };
