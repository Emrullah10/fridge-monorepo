import { google } from 'googleapis';
import { log } from '@fridge/helper';

// Play'de yayınlanan gerçek sürümü okumak, edits API'sinin (draft/commit
// akışı) bir parçası değil — bir "edit" açıp hemen o edit içindeki
// production track'i okuyup bırakıyoruz, hiçbir şey commit edilmiyor.
// Google bu tek-kullanımlık edit'i bir süre sonra kendisi temizler.
const makePlayVersionAdapter = ({ serviceAccount, packageName }) => {
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const publisher = google.androidpublisher({ version: 'v3', auth });

  // Play, release adını "10 (1.0.1)" gibi "versionCode (versionName)" olarak
  // birleştirip döner (Flutter'ın pubspec "1.0.1+10"undan otomatik üretilir) —
  // ham haliyle mobile göndermek compareVersions'ı (saf x.y.z bekliyor)
  // bozar. Parantez içindeki versionName'i ayıklıyoruz; format beklenenden
  // farklıysa (parantez yok) tüm string'i olduğu gibi döneriz, en azından
  // "1.0.0" gibi bir semver formatı tutturma ihtimaline karşı.
  const extractVersionName = (releaseName) => {
    const match = releaseName?.match(/\(([\d.]+)\)/);
    return match ? match[1] : releaseName;
  };

  const fetchLatestVersion = async () => {
    const editRes = await publisher.edits.insert({ packageName });
    const editId = editRes.data.id;
    try {
      const trackRes = await publisher.edits.tracks.get({
        packageName,
        editId,
        track: 'production',
      });
      const releases = trackRes.data.releases || [];
      const activeRelease = releases.find((r) => r.status === 'completed') || releases[0];
      if (!activeRelease?.name) return null;
      return extractVersionName(activeRelease.name);
    } finally {
      // Edit'i commit etmiyoruz zaten ama Google'ın kotasını gereksiz
      // doldurmamak için silmeyi deniyoruz — başarısız olursa önemsiz,
      // yayınlanmamış edit'ler otomatik süresi doluyor.
      publisher.edits.delete({ packageName, editId }).catch(() => {});
    }
  };

  return { fetchLatestVersion };
};

export { makePlayVersionAdapter };
