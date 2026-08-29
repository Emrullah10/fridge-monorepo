// Tekil hareket çalışma zamanı: eklenti kaydı, ScrollSmoother yaşam döngüsü,
// ClientRouter kancaları. Bkz. plan "Kabuk ameliyatı — ScrollSmoother'ın bedeli".
//
// SIRA ZORUNLU: ScrollTrigger `pinType:'transform'`'u yalnızca smoother DAHA
// ÖNCE oluşturulduysa seçer. Bu yüzden createRuntime() önce ScrollSmoother'ı
// (varsa) kurar, SONRA çağıran bölümleri kurar.
//
// Karar: ScrollSmoother yalnızca `full` katmanında, `smooth: 1.0`,
// `normalizeScroll: false` ile kurulur. `lite`/`still`'de hiç kurulmaz —
// bölümler ScrollTrigger'ı doğrudan kullanır, o umursamaz.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { Flip } from 'gsap/Flip';
import { registerEases } from './eases.js';

let pluginsRegistered = false;
let smoother = null;
let activeCleanups = [];

function registerPlugins() {
  if (pluginsRegistered) return;
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother, Flip);
  registerEases(gsap);
  pluginsRegistered = true;
}

/**
 * @param {'still'|'lite'|'full'} tier
 * @returns {ScrollSmoother|null}
 */
function setupSmoother(tier) {
  if (tier !== 'full') return null;
  if (!document.querySelector('#smooth-wrapper') || !document.querySelector('#smooth-content')) {
    return null;
  }
  return ScrollSmoother.create({
    wrapper: '#smooth-wrapper',
    content: '#smooth-content',
    smooth: 1.0,
    normalizeScroll: false,
    effects: true, // data-speed / data-lag bedava kazanç
  });
}

/**
 * Tüm ScrollTrigger'ları ve ScrollSmoother'ı öldürür — astro:before-swap'ta
 * çağrılır, aksi halde ölü öğeleri pinleyen zombi tetikleyiciler kalır.
 */
export function teardownRuntime() {
  for (const cleanup of activeCleanups) {
    try {
      cleanup();
    } catch {
      /* no-op */
    }
  }
  activeCleanups = [];
  ScrollTrigger.getAll().forEach((st) => st.kill());
  if (smoother) {
    smoother.kill();
    smoother = null;
  }
}

/**
 * @param {'still'|'lite'|'full'} tier
 * @param {(ctx: { gsap: typeof gsap, ScrollTrigger: typeof ScrollTrigger, Flip: typeof Flip, tier: string, smoother: ScrollSmoother|null }) => (() => void)|void} setup
 *   Çağıran, bölümlerini kurar ve isteğe bağlı bir temizleme fonksiyonu döner.
 */
export function createRuntime(tier, setup) {
  registerPlugins();
  smoother = setupSmoother(tier); // ÖNCE smoother, SONRA bölümler (sıra zorunlu).
  const cleanup = setup({ gsap, ScrollTrigger, Flip, tier, smoother });
  if (typeof cleanup === 'function') activeCleanups.push(cleanup);

  // ClientRouter kancaları: Astro <body>'yi değiştirir, ölü öğeleri pinleyen
  // zombi tetikleyiciler kalmasın diye before-swap'ta her şey öldürülür,
  // page-load'da yeniden kurulur (çağıran taraf bunu tekrar createRuntime
  // çağırarak yapar — bkz. src/scripts/home.js).
  document.addEventListener('astro:before-swap', teardownRuntime, { once: true });

  return { smoother, teardown: teardownRuntime };
}

export { gsap, ScrollTrigger, Flip };
