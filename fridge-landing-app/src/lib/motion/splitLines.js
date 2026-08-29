// Hero başlığı için satır bölme yardımcısı. `titleLines` bir DİZİ olarak
// tutulur (bkz. plan i18n bölümü): SplitText konteyner genişliğine bağlıdır
// ve resize'da yeniden böler; istenen kırılmaları veri olarak yazıp ayrı
// <span>'lere render etmek hero tipografisini her viewport'ta deterministik
// yapar ve hiç JS gerektirmez (dolayısıyla runtime'da SplitText KULLANILMAZ).
//
// Bu modül yalnızca DOM'da zaten render edilmiş [data-line] span'lerini GSAP
// animasyonu için toplar — metne dokunmaz (check-i18n.mjs kuralı).

/**
 * @param {HTMLElement} root
 * @returns {HTMLElement[]}
 */
export function collectLines(root) {
  return Array.from(root.querySelectorAll('[data-line]'));
}
