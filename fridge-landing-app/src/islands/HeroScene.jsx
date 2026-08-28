// Hero 3B yükleme kapısı — CLAUDE.md kural #4.
// KRİTİK: three.js/@react-three/fiber (~220KB gzip) burada STATİK import
// EDİLMEZ. HeroScene3D.jsx'i yalnızca gate geçtiğinde koşullu import() eder,
// böylece mobil/reduced-motion/düşük donanım ziyaretçiler bu JS'i hiç
// İNDİRMEZ (statik import olsaydı Astro yine de indirirdi, sadece render
// etmezdi — asıl performans kazanımı burada, indirmenin kendisini engellemekte).
import { useEffect, useState } from 'react';
import { shouldReduceMotion } from './shouldReduceMotion';

export default function HeroScene({ posterLight, posterDark }) {
  const [Scene3D, setScene3D] = useState(null);
  const [showPoster, setShowPoster] = useState(true);

  useEffect(() => {
    if (shouldReduceMotion()) {
      setShowPoster(true);
      return;
    }
    let cancelled = false;
    import('./HeroScene3D.jsx').then((mod) => {
      if (cancelled) return;
      setScene3D(() => mod.default);
      setShowPoster(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (showPoster || !Scene3D) {
    return (
      <picture className="hero-scene__poster">
        <source srcSet={posterDark} media="(prefers-color-scheme: dark)" />
        <img src={posterLight} alt="" aria-hidden="true" loading="eager" />
      </picture>
    );
  }

  return (
    <div className="hero-scene" role="img" aria-label="Fridge ürün simgeleri, dönen 3B sahne">
      <Scene3D />
    </div>
  );
}
