// CustomEase tanımları — _atmosphere.scss'teki --ease-cine ile eşleşir.
// GSAP CustomEase eklentisi ücretsizdir (Webflow açtı) ve node_modules/gsap
// içinde zaten mevcuttur (bkz. plan "Doğrulanmış zemin").
import { CustomEase } from 'gsap/CustomEase';

let registered = false;

/**
 * CustomEase'i bir kez kaydeder ve "cine" adını tanımlar — CSS'teki
 * `--ease-cine: cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) ile birebir aynı
 * eğri, GSAP tarafında da aynı isimle kullanılabilsin diye.
 * @param {typeof import('gsap').gsap} gsap
 */
export function registerEases(gsap) {
  if (registered) return;
  gsap.registerPlugin(CustomEase);
  CustomEase.create('cine', 'M0,0 C0.16,1 0.3,1 1,1');
  registered = true;
}

export const EASE_CINE = 'cine';
