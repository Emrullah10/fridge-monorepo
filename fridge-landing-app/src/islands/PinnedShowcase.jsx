// Apple ürün sayfası mantığı: telefon ortada sabit (pinned), scroll ettikçe
// ekranındaki görsel değişiyor, yanında adımın metni beliriyor. Eski
// ScrollStory.jsx'in yerini alır (o dört paneli ≥700px'te yan yana grid
// olarak gösteriyordu — hiç scroll etmiyordu, Apple mantığının zıddıydı).
//
// Görseller Astro tarafında (server-side, DeviceShot.astro ile) render edilip
// bu adaya `slot` olarak geçiriliyor — React içinde Astro bileşeni
// render edilemeyeceği için bu ada sadece görünürlük durumunu yönetiyor,
// DOM'u kendisi üretmiyor (bkz. Showcase.astro kullanım şekli).
//
// Üç katman, kritik ilke: doğal DOM durumu zaten doğru kompozisyon —
// GSAP hiç çalışmasa bile sayfa eksiksiz ve okunur (CLAUDE.md kural #4 ruhu):
//   - prefers-reduced-motion → GSAP hiç indirilmez, dikey statik liste
//   - <900px viewport → pin yok (mobilde pin scroll'u bozar), dikey liste
//   - masaüstü + hareket serbest → pin + scrub ile tam sahne
import { useEffect, useRef, useState } from 'react';

function prefersReducedMotion() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function PinnedShowcase({ stepCount }) {
  const markerRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    // Bu ada bir <span> işaretçisi — asıl DOM (frame'ler, step'ler) Astro
    // tarafında server-render edildi ve en yakın .pinned-showcase atasında
    // duruyor. Adanın işi sadece görünürlük durumunu yönetmek.
    const root = markerRef.current?.closest('.pinned-showcase');
    if (!root) return;
    root.querySelectorAll('.pinned-showcase__frame').forEach((el, i) => {
      el.dataset.active = String(i === activeStep);
      el.setAttribute('aria-hidden', String(i !== activeStep));
    });
    root.querySelectorAll('.pinned-showcase__step').forEach((el, i) => {
      el.dataset.active = String(i === activeStep);
    });
  }, [activeStep]);

  useEffect(() => {
    const root = markerRef.current?.closest('.pinned-showcase');
    if (!root) return;
    if (prefersReducedMotion()) return;
    if (typeof window === 'undefined' || window.innerWidth < 900) return;

    let ctx;
    let cancelled = false;

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([gsapMod, stMod]) => {
      if (cancelled) return;
      const gsap = gsapMod.default;
      const ScrollTrigger = stMod.default;
      gsap.registerPlugin(ScrollTrigger);

      // KRİTİK SIRALAMA: data-pinned='true' GSAP'ten ÖNCE, senkron olarak
      // set edilmeli. React state (setPinned) asenkron akar; ScrollTrigger.create
      // pin hedefinin O ANKİ computed style'ını (display:none/flex) okuyup
      // spacer'ı ona göre donduruyor. State güncellemesi sonradan gelirse
      // GSAP stage'i hâlâ display:none sanıp spacer'ı öyle kurmuş oluyor.
      root.dataset.pinned = 'true';

      ctx = gsap.context(() => {
        const stepEls = gsap.utils.toArray('.pinned-showcase__step', root);
        const total = stepEls.length || stepCount;

        ScrollTrigger.create({
          trigger: root,
          start: 'top top',
          end: `+=${total * 100}%`,
          pin: root.querySelector('.pinned-showcase__stage'),
          scrub: 0.3,
        });

        stepEls.forEach((el, i) => {
          ScrollTrigger.create({
            trigger: el,
            start: 'top center',
            end: 'bottom center',
            onEnter: () => setActiveStep(i),
            onEnterBack: () => setActiveStep(i),
          });
        });
      }, root);
    });

    return () => {
      cancelled = true;
      if (ctx) ctx.revert();
    };
  }, [stepCount]);

  // `hidden` KULLANMA (display:none) VE sıfır boyut da verme: Astro'nun
  // client:visible'ı bu elementin kendi getBoundingClientRect'ini gözlemliyor
  // (IntersectionObserver) — 0×0 bir element "hiç görünmüyor" sayılır ve
  // hydration hiç tetiklenmez. Bunun yerine .pinned-showcase__stage'in
  // TAMAMINI kaplayan, görsel olarak fark edilmeyen (pointer-events:none,
  // opacity:0) bir katman kullanılıyor — gerçek boyutu var, gerçekten
  // viewport'a girip çıkıyor.
  return (
    <span
      className="pinned-showcase__marker"
      ref={markerRef}
      style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    />
  );
}
