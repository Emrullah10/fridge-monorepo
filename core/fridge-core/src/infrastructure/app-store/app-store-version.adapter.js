// Apple, Play'in androidpublisher'ına denk bir "yayınlanan sürümü oku" API'si
// sunmuyor ama iTunes Lookup public endpoint'i aynı işi kimlik doğrulaması
// gerektirmeden görüyor (Siren gibi paketlerin de kullandığı yöntem).
// play-version.adapter.js ile AYNI arayüzü ({ fetchLatestVersion }) uygular,
// bu yüzden makeCachedPlayVersion buraya da değişiklik yapılmadan sarılabilir.
const makeAppStoreVersionAdapter = ({ bundleId, country = 'tr' }) => {
  const fetchLatestVersion = async () => {
    const url = `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(bundleId)}&country=${encodeURIComponent(country)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`itunes_lookup_http_${response.status}`);
    }
    const data = await response.json();
    // resultCount 0 = uygulama bu bundleId ile App Store'da henüz yayında
    // değil (örn. sadece TestFlight'ta). Bu bir hata değil, beklenen bir
    // ara durum — null dönülür, cachedPlayVersion fallback'ine düşer.
    if (!data.resultCount || !data.results?.[0]?.version) {
      return null;
    }
    // iTunes version alanı zaten temiz semver ("1.0.5") döner, Play'deki
    // gibi versionCode ile birleşmiyor — extractVersionName benzeri bir
    // ayıklamaya gerek yok.
    return data.results[0].version;
  };

  return { fetchLatestVersion };
};

export { makeAppStoreVersionAdapter };
