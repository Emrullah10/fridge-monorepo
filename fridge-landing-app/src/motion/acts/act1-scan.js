// Bölüm 1 — Fişi çek. Pinli, scrub'lı (full katmanı). `lite`/`still`'de pin
// yok; `lite` girişte tek seferlik timeline oynatır (bkz. plan hareket
// katmanları tablosu). Maketin kendi is-done/is-active sınıfları üç
// timeline etiketinde ilerler.
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
    // pin yok, ScrollSmoother yok: girişte bir kez oynat.
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
