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

const ACT_BUILDERS = {
  scan: buildAct1Scan,
  parse: buildAct2Parse,
  sort: buildAct3Sort,
  money: buildAct4Money,
  'feature-strip': buildFeatureStrip,
  marquee: buildScreenMarquee,
};

function mountFilm() {
  const tier = document.documentElement.getAttribute('data-motion') || 'still';
  if (tier === 'still') return; // GSAP must never load - gate already prevents this, belt and suspenders.

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

    // Layout can shift after acts mount in the full tier (font, pin) - one
    // refresh call re-validates pin/scrub positions.
    ctx.ScrollTrigger.refresh();

    return () => cleanups.forEach((fn) => typeof fn === 'function' && fn());
  });
}

mountFilm();
document.addEventListener('astro:page-load', mountFilm);
