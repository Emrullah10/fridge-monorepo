// ScreenMarquee - NEVER autoplays (WCAG 2.2.2). Scroll-linked horizontal
// drift is set up only in `full`; `lite`/`still` already render two rows
// as a normal, static, flowing grid (see ScreenMarquee.astro CSS). This
// module opens up the second (aria-hidden) row as flex once it mounts.
export function buildScreenMarquee({ root, gsap, ScrollTrigger, tier }) {
  if (tier !== 'full') return () => {};

  const rows = Array.from(root.querySelectorAll('[data-marquee-row]'));
  if (rows.length < 2) return () => {};

  const [visibleRow, hiddenRow] = rows;
  gsap.set(hiddenRow, { display: 'flex' });

  const tweens = [
    gsap.to(visibleRow, {
      xPercent: -8,
      ease: 'none',
      scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: 1 },
    }),
    gsap.to(hiddenRow, {
      xPercent: 8,
      ease: 'none',
      scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: 1 },
    }),
  ];

  return () => {
    tweens.forEach((t) => t.kill());
    gsap.set(hiddenRow, { display: 'none', xPercent: 0 });
    gsap.set(visibleRow, { xPercent: 0 });
  };
}
