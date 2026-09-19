// Cihaz mockup çerçeveleri — ekran deliği koordinatları TEK KAYNAK.
// Koordinatlar mockup PNG'sinin alfa kanalı merkezden dışa taranarak
// ölçülmüştür (bkz. public/devices/LICENSE.txt). Yüzde cinsindendir çünkü
// çerçeve CSS'te width:100% ile ölçekleniyor (DeviceShot.astro).

/**
 * @typedef {Object} DeviceDef
 * @property {string} frame - public/ altındaki çerçeve görseli yolu
 * @property {number} frameW - çerçeve PNG'sinin gerçek piksel genişliği
 * @property {number} frameH - çerçeve PNG'sinin gerçek piksel yüksekliği
 * @property {{x:number,y:number,w:number,h:number}} screen - ekran deliği, % cinsinden
 * @property {string} radius - ekran deliğinin köşe yuvarlaması (CSS birimiyle)
 * @property {'ios'|'android'} platform
 */

/** @type {Record<string, DeviceDef>} */
export const devices = {
  'iphone-17-pro-max': {
    frame: '/devices/iphone-17-pro-max.webp',
    frameW: 389,
    frameH: 800,
    screen: { x: 4.88, y: 7.5, w: 90.23, h: 90.0 },
    radius: '11%',
    platform: 'ios',
  },
  'pixel-10': {
    frame: '/devices/pixel-10.webp',
    frameW: 379,
    frameH: 800,
    screen: { x: 5.28, y: 7.38, w: 88.65, h: 89.62 },
    radius: '9%',
    platform: 'android',
  },
};

export function getDevice(key) {
  const d = devices[key];
  if (!d) throw new Error(`Bilinmeyen cihaz: ${key}. devices.js'e bakın.`);
  return d;
}
