// Hareket katmanı yüklemleri. Beş ayrı endişe, tek boolean'a sıkıştırılmaz
// (bkz. cerebrum.md Do-Not-Repeat: eski shouldReduceMotion() 768px altındaki
// TÜM cihazlarda animasyonu kapatıyordu — mobil trafiğin çoğu bu yüzden hiç
// hareket görmüyordu). Sonuç `resolveMotionTier()` ile <html data-motion> olarak
// açılışta çözülür (bkz. src/scripts/shell.js ilk-boya öncesi script).

let liveReducedMotion = null;
let webgl2Cache = null;

/**
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * `change` olayını dinleyip callback'i günceller — kullanıcı sistem ayarını
 * sayfa açıkken değiştirebilir (özellikle demo/sunum senaryolarında).
 * @param {(reduced: boolean) => void} callback
 * @returns {() => void} unsubscribe
 */
export function watchReducedMotion(callback) {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handler = (e) => callback(e.matches);
  mq.addEventListener('change', handler);
  liveReducedMotion = mq.matches;
  return () => mq.removeEventListener('change', handler);
}

/**
 * @returns {boolean} dar/dokunmatik viewport — pin'in URL çubuğu zıplamasına
 * maruz kaldığı sınıf.
 */
export function isNarrow() {
  if (typeof window === 'undefined') return true;
  const narrowViewport = window.innerWidth < 900;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  return narrowViewport || coarsePointer;
}

/**
 * @returns {boolean} zayıf cihaz — düşük çekirdek sayısı veya düşük bellek.
 */
export function isLowPower() {
  if (typeof window === 'undefined') return true;
  const cores = navigator.hardwareConcurrency;
  const mem = navigator.deviceMemory;
  if (cores && cores < 4) return true;
  if (mem && mem < 4) return true;
  return false;
}

/**
 * WebGL2 desteği — memoize edilir (her katman çözümünde yeniden bağlam
 * açmaz), `failIfMajorPerformanceCaveat` yazılım render'ı eler, `finally`
 * içinde `loseContext()` ile bağlam sızıntısı önlenir (bkz. eski
 * shouldReduceMotion.js: context hiç serbest bırakılmıyordu).
 * @returns {boolean}
 */
export function supportsWebGL2() {
  if (webgl2Cache !== null) return webgl2Cache;
  if (typeof document === 'undefined') return (webgl2Cache = false);
  const canvas = document.createElement('canvas');
  let gl = null;
  try {
    gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    webgl2Cache = !!gl;
  } catch {
    webgl2Cache = false;
  } finally {
    if (gl) {
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
  }
  return webgl2Cache;
}

/**
 * @returns {boolean} Kullanıcı Data Saver açmış — Save-Data header/`connection.saveData`.
 */
export function saveData() {
  if (typeof navigator === 'undefined') return false;
  return !!(navigator.connection && navigator.connection.saveData);
}

/**
 * Beş yüklemi tek katmana indirger.
 * `still`  — prefers-reduced-motion: reduce. GSAP hiç indirilmez.
 * `lite`   — dar/dokunmatik veya zayıf cihaz veya saveData. Pin/ScrollSmoother/WebGL yok.
 * `full`   — masaüstü + hareket serbest + güçlü cihaz. Tüm sinema.
 * @returns {'still'|'lite'|'full'}
 */
export function resolveMotionTier() {
  if (prefersReducedMotion()) return 'still';
  if (isNarrow() || isLowPower() || saveData()) return 'lite';
  return 'full';
}
