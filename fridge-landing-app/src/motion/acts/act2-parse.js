// Act 2 - AI parses it. Flip is NOT used (see plan rationale: different
// DOM/box/content, and every refresh invalidates the captured geometry).
// Instead: data-matched manual FLIP. Each line pair does a single
// getBoundingClientRect, cached via invalidateOnRefresh. Motion happens
// only on the position channel - that's the one channel selling "the raw
// line became a card"; the shape change is sold by cross-fade, not geometry.
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

// Character set is supplied by the CALLER via a data-scramble-chars
// attribute - this file must stay free of language-specific characters
// (see check-i18n.mjs rule 3: motion modules never touch copy).
const FALLBACK_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function buildAct2Parse({ root, gsap, ScrollTrigger, tier }) {
  gsap.registerPlugin(ScrambleTextPlugin);

  const rows = Array.from(root.querySelectorAll('[data-line-id]'));
  const scrambleTargets = Array.from(root.querySelectorAll('[data-scramble-target]'));
  const cleanups = [];

  if (tier === 'full') {
    // For each pair: the card starts offset above the raw line (yPercent),
    // and scrubs back to 0 as scroll progresses.
    const tweens = rows.map((row) => {
      const card = row.querySelector('.parse-scene__card');
      const raw = row.querySelector('.parse-scene__raw');
      if (!card || !raw) return null;
      return gsap.fromTo(
        card,
        { yPercent: -18, opacity: 0.3 },
        {
          yPercent: 0,
          opacity: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: row,
            start: 'top 85%',
            end: 'top 40%',
            scrub: true,
            invalidateOnRefresh: true,
          },
        }
      );
    });
    cleanups.push(() => tweens.forEach((t) => t && t.kill()));
  } else if (tier === 'lite') {
    rows.forEach((row) => {
      const card = row.querySelector('.parse-scene__card');
      if (!card) return;
      const st = ScrollTrigger.create({
        trigger: row,
        start: 'top 85%',
        once: true,
        onEnter: () => gsap.from(card, { yPercent: -12, opacity: 0, duration: 0.5, ease: 'cine' }),
      });
      cleanups.push(() => st.kill());
    });
  }

  // ScrambleText - character set is read from the DOM's data-scramble-chars
  // attribute (see plan: a Turkish charset as a small delight + latin-ext
  // proof). Never wrapped in aria-live (the static text is already accessible).
  if (tier !== 'still' && scrambleTargets.length) {
    scrambleTargets.forEach((el) => {
      const original = el.textContent;
      const chars = el.getAttribute('data-scramble-chars') || FALLBACK_CHARS;
      const st = ScrollTrigger.create({
        trigger: el,
        start: 'top 85%',
        once: true,
        onEnter: () => {
          gsap.to(el, {
            duration: 0.8,
            scrambleText: {
              text: original,
              chars,
              revealDelay: 0.1,
            },
          });
        },
      });
      cleanups.push(() => st.kill());
    });
  }

  return () => cleanups.forEach((fn) => fn());
}
