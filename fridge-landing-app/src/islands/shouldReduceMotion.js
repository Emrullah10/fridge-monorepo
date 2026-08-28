// Hero 3B / ağır animasyonlar için yükleme kapısı — CLAUDE.md kural #4.
// Herhangi biri doğruysa 3B/ağır animasyon hiç mount edilmez, statik poster gösterilir.
export function shouldReduceMotion() {
  if (typeof window === 'undefined') return true;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  if (window.innerWidth < 768) return true;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return true;
  if (navigator.deviceMemory && navigator.deviceMemory < 4) return true;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
  } catch {
    return true;
  }
  return false;
}
