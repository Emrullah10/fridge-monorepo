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

async function mountFilm() {
  const tier = document.documentElement.getAttribute('data-motion') || 'still';
  if (tier === 'still') return; // GSAP must never load - gate already prevents this, belt and suspenders.

  // Atmosphere shader mounts only in `full` (raw WebGL2, see Phase 6) -
  // lite/still keep the CSS gradient base from Atmosphere.astro and never
  // reach this branch, so zero shader JS ships to them. mountAtmosphere is
  // awaited first because gl.js is a dynamic import (see mount.js) -
  // the act builders need the resolved handle before they wire onUpdate.
  let atmosphere = null;
  if (tier === 'full') {
    const canvas = document.querySelector('[data-atmosphere-canvas]');
    if (canvas) atmosphere = await mountAtmosphere(canvas);
  }

  createRuntime(tier, (ctx) => {
    const cleanups = [];
    if (atmosphere) cleanups.push(() => atmosphere.destroy());

    const heroRoot = document.getElementById('hero');
    if (heroRoot) cleanups.push(buildHero({ root: heroRoot, ...ctx, atmosphere }));

    document.querySelectorAll('[data-act]').forEach((root) => {
      const key = root.getAttribute('data-act');
      if (key === 'hero') return;
      const builder = ACT_BUILDERS[key];
      if (builder) cleanups.push(builder({ root, ...ctx, atmosphere }));
    });

    // Layout can shift after acts mount in the full tier (font, pin) - one
    // refresh call re-validates pin/scrub positions.
    ctx.ScrollTrigger.refresh();

    return () => cleanups.forEach((fn) => typeof fn === 'function' && fn());
  });
}

mountFilm();
document.addEventListener('astro:page-load', mountFilm);
