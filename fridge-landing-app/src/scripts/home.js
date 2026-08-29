// Film yönetmeni — yalnızca `/` üzerinde, küçük bir kapıdan tek `import('./home.js')`
// ile yüklenir (bkz. plan "Kod bölme"). `still` katmanında bu dosya HİÇ
// indirilmez — gate script bunu kontrol eder (bkz. src/pages/index.astro).
import { createRuntime } from '@lib/motion/runtime.js';
import { buildHero } from '../motion/acts/hero.js';

function mountFilm() {
  const tier = document.documentElement.getAttribute('data-motion') || 'still';
  if (tier === 'still') return; // GSAP hiç indirilmemeli — gate zaten engeller, çift güvenlik.

  createRuntime(tier, ({ gsap, tier: resolvedTier }) => {
    const heroRoot = document.getElementById('hero');
    let cleanupHero = () => {};
    if (heroRoot) {
      cleanupHero = buildHero({ root: heroRoot, gsap, tier: resolvedTier });
    }
    return () => {
      cleanupHero();
    };
  });
}

mountFilm();
document.addEventListener('astro:page-load', mountFilm);
