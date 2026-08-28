// Para, tarih, SKT durumu — DESIGN_SPEC.md §1.3'teki renk mantığının hesaplayıcısı.

/**
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * @param {string} isoDate
 * @param {'tr'|'en'} [locale]
 * @returns {string}
 */
export function formatDate(isoDate, locale = 'tr') {
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(isoDate));
}

/**
 * DESIGN_SPEC §1.3: 4+ gün kaldı veya SKT yok -> normal, 0-3 gün -> yaklaşıyor, geçmiş -> geçmiş.
 * @param {string|undefined} expiresAt
 * @returns {'normal'|'soon'|'expired'|'none'}
 */
export function computeExpiryStatus(expiresAt) {
  if (!expiresAt) return 'none';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(expiresAt);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'expired';
  if (diffDays <= 3) return 'soon';
  return 'normal';
}

/**
 * @param {'normal'|'soon'|'expired'|'none'} status
 * @returns {string} CSS custom property adı (--on-surface-variant vb.)
 */
export function expiryStatusColorVar(status) {
  switch (status) {
    case 'soon':
      return 'var(--status-warning)';
    case 'expired':
      return 'var(--error)';
    default:
      return 'var(--on-surface-variant)';
  }
}
