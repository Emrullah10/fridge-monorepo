// Post-film - FeatureStrip. `full` gets a horizontal pin: the track slides
// horizontally driven by vertical scroll. `lite`/`still` never call this
// module - the natural CSS scroll-snap container already works (see
// FeatureStrip.astro).
export function buildFeatureStrip({ root, gsap, ScrollTrigger, tier }) {
  if (tier !== 'full') return () => {};

  const track = root.querySelector('[data-feature-track]');
  if (!track) return () => {};

  // Horizontal pin is set up ONLY in full so the Lighthouse
  // documentElement.scrollWidth check stays clean; the track's native
  // overflow-x:auto also exists in full but is disabled while pinned
  // (cleaned up via JS).
  const originalOverflow = track.style.overflowX;
  track.style.overflowX = 'visible';

  const scrollAmount = () => track.scrollWidth - root.clientWidth;

  const st = ScrollTrigger.create({
    trigger: root,
    start: 'top top',
    end: () => `+=${scrollAmount()}`,
    pin: true,
    scrub: 1,
    invalidateOnRefresh: true,
    animation: gsap.to(track, { x: () => -scrollAmount(), ease: 'none' }),
  });

  return () => {
    st.kill();
    track.style.overflowX = originalOverflow;
  };
}
