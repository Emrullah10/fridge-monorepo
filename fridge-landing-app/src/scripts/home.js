// Film director - loaded only on `/`, via a tiny gate as a single
// `import('./home.js')` (see plan "code splitting"). This file is NEVER
// downloaded in the `still` tier - the gate script enforces that (see
// src/pages/index.astro).
import { createRuntime } from '@lib/motion/runtime.js';
import { buildHero } from '../motion/acts/hero.js';
import { buildAct1Scan } from '../motion/acts/act1-scan.js';
import { buildAct2Parse } from '../motion/acts/act2-parse.js';
import { buildAct3Sort } from '../motion/acts/act3-sort.js';
import { buildAct4Money } from '../motion/acts/act4-money.js';
import { buildFeatureStrip } from '../motion/acts/featureStrip.js';
import { buildScreenMarquee } from '../motion/acts/screenMarquee.js';
import { mountAtmosphere } from '../motion/atmosphere/mount.js';

const ACT_BUILDERS = {
  scan: buildAct1Scan,
  parse: buildAct2Parse,
  sort: buildAct3Sort,
  money: buildAct4Money,
  'feature-strip': buildFeatureStrip,
  marquee: buildScreenMarquee,
};

// Kalıcı film sahnesi modül-seviyesi singleton — StudioScene.astro
// `transition:persist` taşıyor, yani `/` İÇİNDE kalan gezinmelerde (ör.
// scroll sonrası aynı sayfaya dönüş, ileri/geri) canvas/WebGL bağlamı
// YENİDEN MONT EDİLMEZ. Ama StudioScene yalnızca ana sayfanın
// Marketing.astro çağrısında render ediliyor — `/`'den başka bir sayfaya
// geçilince hedef DOM'da eşleşen persist öğesi olmadığı için Astro
// ClientRouter bu öğeyi swap'ta GERÇEKTEN kaldırır (transition:persist
// yalnızca HER İKİ sayfada da aynı öğe varsa korur). Bu yüzden singleton,
// astro:before-swap'ta [data-studio-canvas] DOM'dan gerçekten gidiyorsa
// sıfırlanır — aksi halde `/`'e geri dönüşte ensureFilmScene() artık
// var olmayan eski promise'i döner ve yeni canvas hiç mount edilmez.
let filmScenePromise = null;
let filmSceneHandle = null;
let beforeSwapHooked = false;

function hookFilmSceneReset() {
  if (beforeSwapHooked) return;
  beforeSwapHooked = true;
  document.addEventListener('astro:before-swap', (event) => {
    const survives = event.newDocument?.querySelector('[data-studio-canvas]');
    if (!survives && filmSceneHandle) {
      filmSceneHandle.destroy();
      filmSceneHandle = null;
      filmScenePromise = null;
      document.documentElement.removeAttribute('data-film-ready');
    }
  });
}

async function ensureFilmScene() {
  hookFilmSceneReset();
  if (filmScenePromise) return filmScenePromise;
  const canvas = document.querySelector('[data-studio-canvas]');
  if (!canvas) return null;
  filmScenePromise = import('../motion/three/film.js')
    .then(({ mountFilmScene }) => mountFilmScene({ canvas, theme: 'dark' }))
    .then((handle) => {
      filmSceneHandle = handle;
      canvas.setAttribute('data-ready', 'true');
      document.documentElement.setAttribute('data-film-ready', 'true');
      return handle;
    })
    .catch((err) => {
      // Sessiz düşmüyoruz — WebGL/doku hatası devtools'ta görünür olmalı,
      // aksi halde "3B neden görünmüyor" hata ayıklaması imkânsızlaşır.
      console.error('[film.js] sahne mont edilemedi, DOM maketlerine düşülüyor:', err);
      // WebGL başarısız olursa (context alınamadı, doku 404 vb.) DOM
      // maketleri zaten görünür kalır — _cinema.scss'in `full` gizleme
      // kuralı `html[data-motion='full']`'e bağlı, film'in kendisine değil;
      // ama pratikte film başarısız olsa da tier hâlâ 'full' kalıyor. Bu
      // nadir düşüş senaryosunda telefon geçici olarak görünmez olabilir —
      // kabul edilebilir risk (WebGL2 zaten resolveMotionTier()'da kontrol
      // ediliyor, bu noktaya gelen tarayıcılarda context açılması neredeyse
      // her zaman başarılı).
      filmScenePromise = null;
      return null;
    });
  return filmScenePromise;
}

async function mountFilm() {
  const tier = document.documentElement.getAttribute('data-motion') || 'still';
  if (tier === 'still') return; // GSAP must never load - gate already prevents this, belt and suspenders.

  let atmosphere = null;
  if (tier === 'full') {
    const canvas = document.querySelector('[data-atmosphere-canvas]');
    if (canvas) {
      // Atmosfer hiçbir koşulda film sahnesinin mont edilmesini engellememeli
      // — bu ikisi bağımsız katmanlar (bkz. yukarıdaki Do-Not-Repeat notu).
      try {
        atmosphere = await mountAtmosphere(canvas);
      } catch (err) {
        console.error('[atmosphere] mont edilemedi, sis katmanı olmadan devam ediliyor:', err);
      }
    }
  }

  // Kalıcı film sahnesi yalnızca `/` üzerinde ve `full`'de var — StudioScene
  // yalnızca ana sayfanın Marketing.astro çağrısında `studioScene` prop'uyla
  // render ediliyor, bu yüzden diğer sayfalarda [data-studio-canvas] hiç yok.
  let film = null;
  if (tier === 'full') {
    film = await ensureFilmScene();
  }

  createRuntime(tier, (ctx) => {
    const cleanups = [];
    // ÖNCEDEN atmosphere.destroy() burada her astro:before-swap'ta
    // çağrılıyordu — ama Atmosphere.astro TÜM sayfalarda koşulsuz render
    // ediliyor (transition:persist), canvas hiçbir zaman DOM'dan gitmiyor.
    // destroy() WEBGL_lose_context çağırıyor (bkz. gl.js) ve kaybedilen bir
    // WebGL bağlamı asla geri alınamaz — `/`'e dönüşte mountAtmosphere()
    // aynı canvas'ta yeniden getContext('webgl2') deneyip senkron throw
    // ediyordu, bu da mountFilm()'i ensureFilmScene()'e ULAŞMADAN
    // patlatıyordu (bkz. plan Bölüm A doğrulama notu — film hiç mont
    // olmuyordu). Kendi IntersectionObserver/visibilitychange duraklatması
    // zaten yeterli yaşam döngüsü — burada destroy'a gerek yok.
    const heroRoot = document.getElementById('hero');
    if (heroRoot) cleanups.push(buildHero({ root: heroRoot, ...ctx, atmosphere }));

    document.querySelectorAll('[data-act]').forEach((root) => {
      const key = root.getAttribute('data-act');
      if (key === 'hero') return;
      const builder = ACT_BUILDERS[key];
      if (builder) cleanups.push(builder({ root, ...ctx, atmosphere }));
    });

    // Tek scrub'lı ana zaman çizelgesi — #film'in yüksekliği boyunca 0->1
    // ilerlemeyi film sahnesine besler (bkz. plan "Tek scrub'lı ana zaman
    // çizelgesi"). Perde bazlı ayrı pin/scrub YOK; kamera/telefon/doku
    // durumu tamamen bu tek ilerlemenin fonksiyonu (choreography.js).
    if (film) {
      const filmRoot = document.querySelector('[data-film]');
      const studioCanvas = document.querySelector('[data-studio-canvas]');
      if (filmRoot) {
        const st = ctx.ScrollTrigger.create({
          trigger: filmRoot,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1,
          onUpdate: (self) => film.seek(self.progress),
          // #film bittikten sonra (FeatureStrip/Marquee/Metrics/FinalCta)
          // kalıcı sahne hâlâ position:fixed olduğu için görünür kalırdı —
          // StudioScene.astro'nun kendi opacity geçişini burada tetikliyoruz
          // (bkz. plan "Süreklilik" doğrulaması — post-film bölümlerle
          // çakışma tespit edilip düzeltildi).
          onLeave: () => studioCanvas?.classList.add('is-past-film'),
          onEnterBack: () => studioCanvas?.classList.remove('is-past-film'),
        });
        cleanups.push(() => st.kill());
      }

      // Her perdenin sabit-konumlu altyazısı (.act__copy, _cinema.scss)
      // yalnızca KENDİ section'ı görünür alanın ortasındayken görünür —
      // toggleClass'ın `onEnter`/`onLeaveBack` karşılığı, aksi halde birden
      // fazla altyazı aynı anda görünüp üst üste biner (bkz. _cinema.scss
      // Do-Not-Repeat notu). ActMoney kendi normal-akış CSS istisnasına
      // sahip olduğu için buraya dahil edilmiyor.
      document.querySelectorAll('#film .act:not(.act--money) .act__copy').forEach((copyEl) => {
        const sectionRoot = copyEl.closest('.act');
        if (!sectionRoot) return;
        const subtitleSt = ctx.ScrollTrigger.create({
          trigger: sectionRoot,
          // Dar pencere (section'ın orta %50'si) — geniş `top center/bottom
          // center` komşu perdelerin pencereleriyle çakışıyordu (Do-Not-Repeat:
          // ActSort'un altyazısı ActMoney'nin normal-akış içeriğine
          // taşıyordu, iki komşu perde arasındaki geçiş bandında).
          start: 'top 35%',
          end: 'bottom 65%',
          toggleClass: { targets: copyEl, className: 'is-active-subtitle' },
        });
        cleanups.push(() => subtitleSt.kill());
      });
    }

    // Layout can shift after acts mount in the full tier (font, pin) - one
    // refresh call re-validates pin/scrub positions.
    ctx.ScrollTrigger.refresh();

    return () => cleanups.forEach((fn) => typeof fn === 'function' && fn());
  });
}

mountFilm();
document.addEventListener('astro:page-load', mountFilm);

// Film sahnesi başka bir sayfaya geçince YAŞAMAYA DEVAM EDER (StudioScene
// transition:persist) ama artık kimse seek() çağırmıyor demek DEĞİL —
// #film DOM'dan gidince yukarıdaki ScrollTrigger zaten teardownRuntime()
// ile öldürülüyor. Sahneyi görünür bırakmak StudioScene'in kendi CSS'i
// (position:fixed, z-index:0) — Header/Footer gibi diğer sayfalarda da
// arkada durur, ama diğer sayfalarda Marketing çağrısı `studioScene` hiç
// geçmediği için StudioScene DOM'da yok, bu yüzden sorun oluşmuyor.
