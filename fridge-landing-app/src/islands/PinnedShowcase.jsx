// Pinned sahne: masaüstünde telefon CSS `position: sticky` ile sabit kalır, sağdaki
// adımlar kaydıkça ekran içeriği değişir. GSAP pin KULLANILMIYOR — pin kökünün
// padding'i, sticky header ve Lenis ile hizasızlaşıp telefonu ekran dışına taşıyordu.
// Sticky tamamen CSS'te (PinnedShowcaseSection.astro); bu ada yalnız
// "hangi adım aktif" bilgisini IntersectionObserver ile yönetir.
//
// Katmanlar:
//   - prefers-reduced-motion → data-pinned hiç set edilmez, dikey statik liste
//   - <900px viewport → pin yok, dikey liste
//   - masaüstü → data-pinned='true' + aktif adım gözlemi
import { useEffect, useRef } from 'react';

export default function PinnedShowcase({ stepCount }) {
  const markerRef = useRef(null);

  useEffect(() => {
    const root = markerRef.current?.closest('.pinned-showcase');
    if (!root || typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.innerWidth < 900) return;

    root.dataset.pinned = 'true';

    const frames = root.querySelectorAll('.pinned-showcase__frame');
    const steps = root.querySelectorAll('.pinned-showcase__step');
    const setActive = (active) => {
      frames.forEach((el, i) => {
        el.dataset.active = String(i === active);
        el.setAttribute('aria-hidden', String(i !== active));
      });
      steps.forEach((el, i) => {
        el.dataset.active = String(i === active);
      });
      root.style.setProperty('--pin-progress', String((active + 1) / steps.length));
    };
    setActive(0);

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Array.from(steps).indexOf(e.target));
        });
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    steps.forEach((el) => io.observe(el));

    return () => {
      io.disconnect();
      delete root.dataset.pinned;
    };
  }, [stepCount]);

  // Astro client:visible bu elementin görünürlüğünü gözlemler: 0×0 / display:none olmamalı.
  return (
    <span
      className="pinned-showcase__marker"
      ref={markerRef}
      style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    />
  );
}
