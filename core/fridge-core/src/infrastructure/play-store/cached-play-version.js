// Her /app-config isteğinde Play'e gitmek gereksiz ve yavaş — sonucu bir
// süre bellekte tutuyoruz. Play API hata verirse (kota, geçici kesinti)
// eski değeri korumak, sürüm kontrolünü aniden kör bırakmaktan iyidir.
const makeCachedPlayVersion = ({ adapter, ttlMs = 6 * 60 * 60 * 1000, fallbackVersion }) => {
  let cached = fallbackVersion;
  let fetchedAt = 0;

  const getLatestVersion = async () => {
    const isStale = Date.now() - fetchedAt > ttlMs;
    if (!isStale) return cached;

    try {
      const version = await adapter.fetchLatestVersion();
      if (version) {
        cached = version;
        fetchedAt = Date.now();
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('play_version_fetch_failed', error.message);
      // fetchedAt'ı ilerletmiyoruz — bir sonraki istekte tekrar denenir,
      // ama o ana kadar son bilinen (veya fallback) değer dönülmeye devam eder.
    }
    return cached;
  };

  return { getLatestVersion };
};

export { makeCachedPlayVersion };
