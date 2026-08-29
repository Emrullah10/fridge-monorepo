// [data-reveal] — saf IntersectionObserver, SIFIR GSAP. Her sayfada yüklenir
// (~600 B), alt sayfaların hareket kancası budur. Yapısal kural: DOM'un
// JS'siz son-durumu zaten doğru kompozisyon olduğu için burada da .fade-up'ın
// tersi yapılır — GSAP'siz katmanlarda son-durum CSS ile zaten görünür,
// bu script yalnızca `full`/`lite` katmanında ekstra bir giriş sağlar.
const SELECTOR = '[data-reveal]';

export function initReveal(root = document) {
  const targets = root.querySelectorAll(SELECTOR);
  if (!targets.length) return;

  if (typeof IntersectionObserver === 'undefined') {
    targets.forEach((el) => el.classList.add('is-revealed'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.2, rootMargin: '0px 0px -10% 0px' }
  );

  targets.forEach((el) => observer.observe(el));
  return observer;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initReveal());
  } else {
    initReveal();
  }
  document.addEventListener('astro:page-load', () => initReveal());
}
