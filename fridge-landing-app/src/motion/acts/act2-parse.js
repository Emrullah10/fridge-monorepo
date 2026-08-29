// Bölüm 2 — Yapay zekâ ayrıştırır. Flip KULLANILMAZ (bkz. plan gerekçesi).
// Veriyle eşleştirilmiş elle-FLIP: her satır çifti için tek getBoundingClientRect,
// invalidateOnRefresh'te önbelleklenir. Yalnızca konum kanalında hareket —
// "satır karta dönüştü" hissini satan tek kanal bu; biçim değişimini geometri
// değil çapraz geçiş (opacity) satar.
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

// Karakter kumesi CAGIRAN tarafindan verilir (data-scramble-chars ozniteligi
// uzerinden) — bu dosya check-i18n.mjs kuraliyla Turkce'ye ozgu karakter
// icermemeli (bkz. plan i18n kural 3: hareket modulleri metne dokunmaz).
const FALLBACK_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function buildAct2Parse({ root, gsap, ScrollTrigger, tier }) {
  gsap.registerPlugin(ScrambleTextPlugin);

  const rows = Array.from(root.querySelectorAll('[data-line-id]'));
  const scrambleTargets = Array.from(root.querySelectorAll('[data-scramble-target]'));
  const cleanups = [];

  if (tier === 'full') {
    // Her çift için offset hesapla: kart, ham satırın üzerine ötelenmiş
    // başlar (yPercent -100 kadar), scrub ilerledikçe 0'a döner.
    const tweens = rows.map((row) => {
      const card = row.querySelector('.parse-scene__card');
      const raw = row.querySelector('.parse-scene__raw');
      if (!card || !raw) return null;
      return gsap.fromTo(
        card,
        { yPercent: -18, opacity: 0.3 },
        {
          yPercent: 0,
          opacity: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: row,
            start: 'top 85%',
            end: 'top 40%',
            scrub: true,
            invalidateOnRefresh: true,
          },
        }
      );
    });
    cleanups.push(() => tweens.forEach((t) => t && t.kill()));
  } else if (tier === 'lite') {
    rows.forEach((row) => {
      const card = row.querySelector('.parse-scene__card');
      if (!card) return;
      const st = ScrollTrigger.create({
        trigger: row,
        start: 'top 85%',
        once: true,
        onEnter: () => gsap.from(card, { yPercent: -12, opacity: 0, duration: 0.5, ease: 'cine' }),
      });
      cleanups.push(() => st.kill());
    });
  }

  // ScrambleText — karakter kumesi DOM'daki data-scramble-chars ozniteliginden
  // okunur (bkz. plan: Turkce karakter setiyle kucuk bir keyif + latin-ext
  // kaniti). aria-live'a ASLA sarilmaz (statik metin zaten erisilebilir).
  if (tier !== 'still' && scrambleTargets.length) {
    scrambleTargets.forEach((el) => {
      const original = el.textContent;
      const chars = el.getAttribute('data-scramble-chars') || FALLBACK_CHARS;
      const st = ScrollTrigger.create({
        trigger: el,
        start: 'top 85%',
        once: true,
        onEnter: () => {
          gsap.to(el, {
            duration: 0.8,
            scrambleText: {
              text: original,
              chars,
              revealDelay: 0.1,
            },
          });
        },
      });
      cleanups.push(() => st.kill());
    });
  }

  return () => cleanups.forEach((fn) => fn());
}
