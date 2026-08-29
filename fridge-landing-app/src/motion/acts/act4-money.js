// Bölüm 4 — Para görünür. Pinsiz. DrawSVG yalnızca "biriken" çizgisini
// çizer; kategori çubukları scaleY (DrawSVG sadece stroke animasyonu yapar
// — araç grafik tipini seçmesin). Son değer sunucuda DOM'a zaten yazılı
// (bkz. ActMoney.astro) — burada yalnızca 0'dan o değere sayan bir görsel
// katman eklenir, gerçek metin asla kaybolmaz (yapısal kural).
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

export function buildAct4Money({ root, gsap, ScrollTrigger, tier }) {
  gsap.registerPlugin(DrawSVGPlugin);

  const scene = root.querySelector('[data-money-scene]');
  if (!scene) return () => {};

  const counters = Array.from(scene.querySelectorAll('[data-counter]'));
  const line = scene.querySelector('[data-draw-line]');
  const bars = Array.from(scene.querySelectorAll('[data-money-bar]'));
  const cleanups = [];

  if (line) gsap.set(line, { drawSVG: '0%' });
  bars.forEach((bar) => gsap.set(bar, { scaleY: 0 }));

  let played = false;
  const st = ScrollTrigger.create({
    trigger: scene,
    start: 'top 75%',
    once: true,
    onEnter: () => {
      if (played) return;
      played = true;

      counters.forEach((el) => {
        const target = parseFloat(el.getAttribute('data-counter-target') || '0');
        const finalText = el.textContent;
        const proxy = { v: 0 };
        gsap.to(proxy, {
          v: target,
          duration: 1.2,
          ease: 'cine',
          onUpdate() {
            el.textContent = proxy.v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
          },
          onComplete() {
            // Gercek deger (formatCurrency ile sunucuda uretilen) her zaman
            // son karede geri yazilir — sayac sadece gorsel bir katman.
            el.textContent = finalText;
          },
        });
      });

      if (line) {
        gsap.to(line, { drawSVG: '100%', duration: 1.4, ease: 'cine' });
      }
      bars.forEach((bar, i) => {
        const scale = parseFloat(bar.getAttribute('data-bar-scale') || '1');
        gsap.to(bar, { scaleY: scale, duration: 0.8, ease: 'cine', delay: i * 0.05 });
      });
    },
  });
  cleanups.push(() => st.kill());

  return () => cleanups.forEach((fn) => fn());
}
