// Bölüm 3 — Bölümlere düşer. Flip'in gerçek yeri burası: altı kart tek
// yığından üç depolama sütununa geçiyor ("aynı öğeler, farklı yerleşim",
// kesikli durum değişimi). onEnter -> Flip.getState -> .is-stacked kaldır ->
// Flip.from(state, { absolute: true, stagger: .06 }). Doğal CSS durumu
// zaten sıralanmış üç sütun, yani still/lite sıfır JS ile doğru son
// kompozisyonu görür; Flip yalnızca zaten varacağın duruma geçişi oynatır.
// MotionPath tamamen kesilir (destedeki en jenerik hareket).
export function buildAct3Sort({ root, gsap, ScrollTrigger, Flip, tier }) {
  const scene = root.querySelector('[data-sort-scene]');
  if (!scene || tier !== 'full') return () => {}; // lite/still: doğal DOM zaten doğru.

  const cards = Array.from(scene.querySelectorAll('[data-flip-id]'));
  if (!cards.length) return () => {};

  // "Stacked" başlangıç durumu: tüm kartları tek bir görsel yığın gibi
  // üst üste bindir (yalnızca full'de, JS ile eklenen bir sınıf — doğal
  // DOM zaten hedef kompozisyon olduğu için bu sınıf CSS'te tanımlı değil,
  // burada satır-içi stil ile uygulanır).
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
    },
  });

  return () => {
    st.kill();
  };
}
