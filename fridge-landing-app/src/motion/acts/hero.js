// Hero girişi + scrub'lı wdth sıkışması. Saf fabrika: buildHero({ root, gsap, tier }).
// GSAP fontVariationSettings string'ini doğrudan interpolate edemez — proxy
// nesne + onUpdate kullanılır (bkz. plan "Hero").
export function buildHero({ root, gsap, tier }) {
  const titleEl = root.querySelector('[data-hero-title]');
  const lines = Array.from(root.querySelectorAll('[data-line]'));
  const eyebrow = root.querySelector('[data-hero-eyebrow]');
  const subtitle = root.querySelector('[data-hero-subtitle]');
  const cta = root.querySelector('[data-hero-cta]');
  const phone = root.querySelector('[data-hero-phone]');

  const tl = gsap.timeline({ defaults: { ease: 'cine' } });

  if (lines.length) {
    tl.from(lines, { yPercent: 110, stagger: 0.08, duration: 0.9 }, 0);
  }
  if (eyebrow) tl.from(eyebrow, { opacity: 0, y: 12, duration: 0.5 }, 0);
  if (subtitle) tl.from(subtitle, { opacity: 0, y: 16, duration: 0.6 }, 0.2);
  if (cta) tl.from(cta, { opacity: 0, y: 16, duration: 0.6 }, 0.3);
  if (phone) tl.from(phone, { opacity: 0, y: 24, duration: 0.8 }, 0.15);

  let scrubTween = null;
  // wdth sıkışması yalnızca `full` katmanında (scrub, pin gerektirmiyor ama
  // ağır bir sürekli onUpdate'tir — lite'ta atlanır, still'de GSAP hiç yok).
  if (tier === 'full' && titleEl) {
    const proxy = { wdth: 100 };
    scrubTween = gsap.to(proxy, {
      wdth: 80,
      ease: 'none',
      scrollTrigger: {
        trigger: root,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
      onUpdate() {
        titleEl.style.fontVariationSettings = `'wdth' ${proxy.wdth}`;
      },
    });
  }

  return () => {
    tl.kill();
    if (scrubTween) scrubTween.kill();
  };
}
