import { marketing as marketingTr } from '@i18n/marketing.tr';
import { marketing as marketingEn } from '@i18n/marketing.en';
import { appStrings as appTr } from '@i18n/app-strings.tr';
import { appStrings as appEn } from '@i18n/app-strings.en';

/** @typedef {'tr' | 'en'} Locale */

export const marketingDict = { tr: marketingTr, en: marketingEn };
export const appDict = { tr: appTr, en: appEn };

/**
 * @param {Locale} locale
 * @param {string} path
 * @returns {string}
 */
export function localePath(locale, path) {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (locale === 'tr') return clean;
  return `/en${clean === '/' ? '' : clean}`;
}
