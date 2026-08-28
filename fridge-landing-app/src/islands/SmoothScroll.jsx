// Lenis yumuşak scroll — sadece client:visible ile hidrate olur ve
// reduced-motion'da hiç kurulmaz (CLAUDE.md kural: hafif alt sayfalar).
import { useEffect } from 'react';
import { shouldReduceMotion } from './shouldReduceMotion';

export default function SmoothScroll() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let lenis;
    let rafId;
    let cancelled = false;

    import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return;
      lenis = new Lenis({ duration: 1.1, smoothWheel: true });
      function raf(time) {
        lenis.raf(time);
        rafId = requestAnimationFrame(raf);
      }
      rafId = requestAnimationFrame(raf);
    });

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (lenis) lenis.destroy();
    };
  }, []);

  return null;
}
