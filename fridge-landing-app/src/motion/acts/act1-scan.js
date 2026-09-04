// Act 1 - Scan the receipt. `full` katmanında bu perdenin CSS telefonu
// artık görünmez (kalıcı 3B sahne onun yerine geçti — bkz.
// _cinema.scss `#film .act__phone { opacity: 0 }`), bu yüzden `full`'de
// kendi pin/scrub'ı KALDIRILDI — film.js tek scrub'lı ana zaman çizelgesi
// kamerayı sürüyor. Do-Not-Repeat: bu pin kaldırılmadan `#film`'in toplam
// yüksekliği ~1200px fazla kalıyordu (GSAP `pin-spacer`'ı `end: '+=150%'`
// kadar ekstra boşluk ekliyordu), bu da FeatureStrip'in pinlenmiş yatay
// kaydırmasının klavye-Tab odak konumlandırmasını bozuyordu (e2e/
// keyboard.spec.js — flake değil, tutarlı başarısızdı, ölçülerek izole
// edildi). `lite`'ta hâlâ tek seferlik enter'da oynatılan bir zaman
// çizelgesi var - CSS telefon orada görünür.
export function buildAct1Scan({ root, gsap, ScrollTrigger, tier, atmosphere }) {
  const scene = root.querySelector('[data-scan-scene]');
  const stages = Array.from(root.querySelectorAll('[data-stage]'));
  if (!scene) return () => {};

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    onUpdate: () => {
      if (atmosphere) atmosphere.setUniform('u_sweep', tl.progress());
    },
  });
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
  if (tier === 'lite') {
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
