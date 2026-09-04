// Kamera/telefon/ekran-dokusu koreografisi — 0->1 ilerlemeyi sahne durumuna
// eşler. Anahtar kareler arasında lerp yapan saf fonksiyonlar; GSAP'e veya
// DOM'a bağımlı değil (film.js bunu çağırır, choreography'nin kendisi test
// edilebilir/yeniden kullanılabilir kalır). Değerler stage.js'teki kamera
// kalibrasyonuyla (FOV 32, phone HEIGHT 3.4) tutarlı — bkz. plan "Koreografi"
// tablosu.
const KEYFRAMES = [
  // t: ilerleme noktası, screen: bu anda gösterilecek doku anahtarı.
  // subjectFrac: öznenin (telefon+proplar grubu) o karedeki yatay konumu,
  // görünür frustum yarı-genişliğinin KESRİ olarak (-1..1, 0=ekran merkezi,
  // +1=sağ kenar) — dünya birimi DEĞİL, film.js her karede gerçek genişliğe
  // çevirir (bkz. plan Bölüm C "duyarlı ofset"). Onaylanan hibrit storyboard:
  // hero'da özne sağ sütunda (subjectFrac ~0.42), Perde 1'e girişte (t 0->0.18)
  // ekran merkezine (0) lerp olur ve kamera oradan itibaren "devralır".
  { t: 0.0, camZ: 10.5, camX: 0, camY: 0, subjectFrac: 0.42, phoneRotY: 0.35, phoneRotX: -0.06, screen: 'household-home' },
  { t: 0.18, camZ: 7.5, camX: 0, camY: 0.1, subjectFrac: 0, phoneRotY: 0.08, phoneRotX: -0.02, screen: 'household-home' },
  { t: 0.22, camZ: 7.5, camX: 0, camY: 0.1, subjectFrac: 0, phoneRotY: 0.08, phoneRotX: -0.02, screen: 'receipt-scan' },
  { t: 0.42, camZ: 6.8, camX: -0.6, camY: 0.05, subjectFrac: 0, phoneRotY: -0.05, phoneRotX: 0, screen: 'receipt-scan' },
  { t: 0.46, camZ: 6.8, camX: -0.6, camY: 0.05, subjectFrac: 0, phoneRotY: -0.05, phoneRotX: 0, screen: 'receipt-review' },
  { t: 0.66, camZ: 7.2, camX: 0.7, camY: -0.1, subjectFrac: 0, phoneRotY: 0.15, phoneRotX: 0.03, screen: 'receipt-review' },
  { t: 0.7, camZ: 7.2, camX: 0.7, camY: -0.1, subjectFrac: 0, phoneRotY: 0.15, phoneRotX: 0.03, screen: 'inventory' },
  { t: 0.88, camZ: 10.5, camX: 0, camY: 0, subjectFrac: 0, phoneRotY: 0.25, phoneRotX: -0.04, screen: 'inventory' },
  { t: 0.92, camZ: 10.5, camX: 0, camY: 0, subjectFrac: 0, phoneRotY: 0.25, phoneRotX: -0.04, screen: 'insights' },
  { t: 1.0, camZ: 11.5, camX: 0, camY: -0.15, subjectFrac: 0, phoneRotY: 0.3, phoneRotX: -0.05, screen: 'insights' },
];

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * @param {number} progress 0..1
 * @returns {{ camZ: number, camX: number, camY: number, phoneRotY: number, phoneRotX: number, screen: string }}
 */
export function sampleChoreography(progress) {
  const p = clamp01(progress);
  let a = KEYFRAMES[0];
  let b = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (p >= KEYFRAMES[i].t && p <= KEYFRAMES[i + 1].t) {
      a = KEYFRAMES[i];
      b = KEYFRAMES[i + 1];
      break;
    }
  }
  const span = b.t - a.t;
  const localT = span > 0 ? (p - a.t) / span : 0;

  return {
    camZ: lerp(a.camZ, b.camZ, localT),
    camX: lerp(a.camX, b.camX, localT),
    camY: lerp(a.camY, b.camY, localT),
    subjectFrac: lerp(a.subjectFrac, b.subjectFrac, localT),
    phoneRotY: lerp(a.phoneRotY, b.phoneRotY, localT),
    phoneRotX: lerp(a.phoneRotX, b.phoneRotX, localT),
    // Doku anahtarı ara değer almaz — perde sınırında değişen ayrık durum
    // (film.js bu geçişte malzeme çapraz geçişi/kısa fade uygular).
    screen: localT < 0.5 ? a.screen : b.screen,
  };
}

export const SCREEN_KEYS = [...new Set(KEYFRAMES.map((k) => k.screen))];
