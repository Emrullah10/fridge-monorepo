// Act 4 - See the numbers. Unpinned. DrawSVG animates only the "saved"
// trend line; category bars use scaleY (DrawSVG only animates stroke - it
// shouldn't dictate the chart type). The final value is already
// server-rendered (see ActMoney.astro) - this only adds a visual counting
// overlay on top, the real text never disappears (structural rule).
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
            // The real value (produced server-side via formatCurrency) is
            // always restored on the final frame - the counter is purely visual.
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
