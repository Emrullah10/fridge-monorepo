// Act 1 - Scan the receipt. Pinned, scrubbed (full tier). No pin in
// lite/still; lite plays a one-shot timeline on enter (see plan's motion
// tier table). The mock's own is-done/is-active classes advance across
// three timeline labels.
export function buildAct1Scan({ root, gsap, ScrollTrigger, tier }) {
  const scene = root.querySelector('[data-scan-scene]');
  const stages = Array.from(root.querySelectorAll('[data-stage]'));
  if (!scene) return () => {};

  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  tl.addLabel('prepare')
    .to(scene, { '--scan-y': '30%', duration: 1 }, 'prepare')
    .call(() => setStage(1), null, 'prepare')
    .addLabel('ocr')
    .to(scene, { '--scan-y': '65%', duration: 1 }, 'ocr')
    .call(() => setStage(2), null, 'ocr')
    .addLabel('parse')
    .to(scene, { '--scan-y': '100%', duration: 1 }, 'parse')
    .call(() => setStage(3), null, 'parse');

  function setStage(activeIndex) {
    stages.forEach((el, i) => {
      el.classList.toggle('is-done', i < activeIndex);
      el.classList.toggle('is-active', i === activeIndex);
    });
  }

  let scrollTrigger = null;
  if (tier === 'full') {
    scrollTrigger = ScrollTrigger.create({
      trigger: root,
      start: 'top top',
      end: '+=150%',
      pin: true,
      scrub: 1,
      animation: tl,
    });
  } else if (tier === 'lite') {
    // No pin, no ScrollSmoother: play once on enter.
    scrollTrigger = ScrollTrigger.create({
      trigger: root,
      start: 'top 70%',
      once: true,
      onEnter: () => tl.play(0),
    });
    tl.pause(0);
  }

  return () => {
    tl.kill();
    if (scrollTrigger) scrollTrigger.kill();
  };
}
