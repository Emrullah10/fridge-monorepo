// Film yönetmeni — yalnızca `/` üzerinde, küçük bir kapıdan tek `import('./home.js')`
// ile yüklenir (bkz. plan "Kod bölme"). `still` katmanında bu dosya HİÇ
// indirilmez — gate script bunu kontrol eder (bkz. src/pages/index.astro).
import { createRuntime } from '@lib/motion/runtime.js';
import { buildHero } from '../motion/acts/hero.js';
import { buildAct1Scan } from '../motion/acts/act1-scan.js';
import { buildAct2Parse } from '../motion/acts/act2-parse.js';
import { buildAct3Sort } from '../motion/acts/act3-sort.js';
import { buildAct4Money } from '../motion/acts/act4-money.js';

const ACT_BUILDERS = {
  scan: buildAct1Scan,
  parse: buildAct2Parse,
  sort: buildAct3Sort,
  money: buildAct4Money,
};

function mountFilm() {
  const tier = document.documentElement.getAttribute('data-motion') || 'still';
  if (tier === 'still') return; // GSAP hiç indirilmemeli — gate zaten engeller, çift güvenlik.

  createRuntime(tier, (ctx) => {
    const cleanups = [];

    const heroRoot = document.getElementById('hero');
    if (heroRoot) cleanups.push(buildHero({ root: heroRoot, ...ctx }));

    document.querySelectorAll('[data-act]').forEach((root) => {
      const key = root.getAttribute('data-act');
      if (key === 'hero') return;
      const builder = ACT_BUILDERS[key];
      if (builder) cleanups.push(builder({ root, ...ctx }));
    });

    // full katmanında bölüm yüklendikten sonra layout değişebilir (font,
    // pin) — bir kez refresh tetiklemek pin/scrub konumlarını doğrular.
    ctx.ScrollTrigger.refresh();

    return () => cleanups.forEach((fn) => typeof fn === 'function' && fn());
  });
}

mountFilm();
document.addEventListener('astro:page-load', mountFilm);
