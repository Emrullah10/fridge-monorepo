// Act 3 - Sorted into sections. This is where Flip actually belongs: six
// cards move from a single stack into three storage columns ("same items,
// different layout", a discrete state change). onEnter -> Flip.getState ->
// remove .is-stacked -> Flip.from(state, { absolute: true, stagger: .06 }).
// The natural CSS state is ALREADY the sorted three-column layout, so
// still/lite render the correct final composition with zero JS; Flip only
// animates the transition INTO the state you'd already land on.
// MotionPath is cut entirely (the most generic motion in the toolkit).
// Atmosphere hook: entering this act pushes u_progress toward the freezer
// leg of the fog gradient (see gl.js - u_progress mixes key green into
// storage-freezer cyan past ~0.6).
export function buildAct3Sort({ root, gsap, ScrollTrigger, Flip, tier, atmosphere }) {
  const scene = root.querySelector('[data-sort-scene]');
  if (!scene || tier !== 'full') return () => {}; // lite/still: natural DOM is already correct.

  const cards = Array.from(scene.querySelectorAll('[data-flip-id]'));
  if (!cards.length) return () => {};

  // "Stacked" starting state: visually pile all cards on top of each other
  // (full tier only, applied via inline style - not a CSS class, since the
  // natural DOM is already the target composition).
  cards.forEach((card, i) => {
    gsap.set(card, { position: 'relative', top: -i * 4, zIndex: cards.length - i, opacity: i === 0 ? 1 : 0.4 });
  });

  let played = false;
  const st = ScrollTrigger.create({
    trigger: root,
    start: 'top 60%',
    once: true,
    onEnter: () => {
      if (played) return;
      played = true;
      const state = Flip.getState(cards);
      cards.forEach((card) => gsap.set(card, { clearProps: 'position,top,zIndex,opacity' }));
      Flip.from(state, {
        duration: 0.8,
        ease: 'cine',
        absolute: true,
        stagger: 0.06,
      });
      if (atmosphere) {
        gsap.to({ v: 0 }, {
          v: 1,
          duration: 1.2,
          ease: 'cine',
          onUpdate() {
            atmosphere.setUniform('u_progress', this.targets()[0].v);
          },
        });
      }
    },
  });

  return () => {
    st.kill();
  };
}
