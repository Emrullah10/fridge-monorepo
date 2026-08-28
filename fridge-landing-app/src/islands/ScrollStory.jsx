// GSAP ScrollTrigger anlatısı — 4 adım, pinlenmiş. Her adımın son karesi
// CSS-only olarak da anlamlı kalır (progressive enhancement); JS
// yüklenmeden/reduced-motion'da sayfa yine okunabilir (statik liste görünür).
import { useEffect, useRef, useState } from 'react';
import { shouldReduceMotion } from './shouldReduceMotion';

const STEPS = [
  { icon: '🧾', titleTr: 'Fişi çek', titleEn: 'Scan the receipt', bodyTr: 'Market fişinin fotoğrafını çek, tarama çizgisi ürünleri okur.', bodyEn: 'Snap a photo of your receipt, the scan line reads the items.' },
  { icon: '✨', titleTr: 'Yapay zekâ ayrıştırır', titleEn: 'AI parses it', bodyTr: 'Fiş satırları ürün adı, marka ve fiyata ayrışır.', bodyEn: 'Receipt lines split into product name, brand, and price.' },
  { icon: '🗄️', titleTr: 'Bölümlere düşer', titleEn: 'Sorted into sections', bodyTr: 'Her ürün doğru bölüme — buzdolabı, dondurucu, kiler.', bodyEn: 'Every item lands in the right place — fridge, freezer, pantry.' },
  { icon: '💰', titleTr: 'Para görünür', titleEn: 'See the numbers', bodyTr: 'Ne kadar biriktirdiğini, ne kadar israf ettiğini anında gör.', bodyEn: 'See exactly what you saved and wasted, instantly.' },
];

export default function ScrollStory({ locale = 'tr' }) {
  const containerRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (shouldReduceMotion()) return; // statik liste hâli zaten JSX'te render edilir
    let ctx;
    let cancelled = false;

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([gsapMod, stMod]) => {
      if (cancelled || !containerRef.current) return;
      const gsap = gsapMod.default;
      const ScrollTrigger = stMod.default;
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        const panels = gsap.utils.toArray('.scroll-story__panel');
        panels.forEach((panel, i) => {
          ScrollTrigger.create({
            trigger: panel,
            start: 'top center',
            end: 'bottom center',
            onEnter: () => setActiveStep(i),
            onEnterBack: () => setActiveStep(i),
          });
        });
      }, containerRef);

      setAnimated(true);
    });

    return () => {
      cancelled = true;
      if (ctx) ctx.revert();
    };
  }, []);

  return (
    <div className="scroll-story" ref={containerRef} data-animated={animated}>
      {STEPS.map((step, i) => (
        <div className="scroll-story__panel" key={i} data-active={i === activeStep}>
          <span className="scroll-story__icon" aria-hidden="true">{step.icon}</span>
          <p className="scroll-story__title">{locale === 'tr' ? step.titleTr : step.titleEn}</p>
          <p className="scroll-story__body">{locale === 'tr' ? step.bodyTr : step.bodyEn}</p>
        </div>
      ))}
    </div>
  );
}
