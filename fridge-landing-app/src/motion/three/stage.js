// WebGL sahne iskeleti — renderer, kamera, stüdyo ortam ışığı (PMREM +
// RoomEnvironment), resize/IO/visibilitychange yaşam döngüsü. Yalnızca
// `full` katmanında, hero.js'ten dinamik import() ile (bkz. gl.js/mount.js
// deseni — atmosfer shader'ının aynı "lazy + tier-gated" ilkesi burada da
// geçerli). DPR ≤ 1.75 kelepçeli (mobil GPU'da bile full tier'a düşen
// masaüstü-benzeri cihazlarda aşırı dolgu maliyetini önler).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

// phone.js RectAreaLight kullanıyor (ekran ışığının kasaya taşması) — bu
// init olmadan ışık ya hiç render olmuyor ya da yanlış hesaplanıyor
// (bkz. three.js dokümantasyonu, RectAreaLightUniformsLib.js başlığı).
RectAreaLightUniformsLib.init();

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {{
 *   renderer: THREE.WebGLRenderer,
 *   scene: THREE.Scene,
 *   camera: THREE.PerspectiveCamera,
 *   render: () => void,
 *   start: () => void,
 *   stop: () => void,
 *   destroy: () => void,
 * }}
 */
export function createStage({ canvas }) {
  const scene = new THREE.Scene();
  scene.background = null;

  // FOV 32 / mesafe 10.5 -> z=0'da görünür yükseklik ~6.0 dünya birimi;
  // telefon yüksekliği 3.4 olduğu için etrafında ~%75 boşluk kalıyor —
  // süzülen objelerin (fiş/kutu/kavanoz) görünür olması için gerekli pay.
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0, 10.5);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  // Stüdyo softbox yansımaları — HDR indirmeden, three'nin kendi
  // prosedürel RoomEnvironment'ı ile. "Gerçekçi değil" şikâyetinin en büyük
  // tek kaldıracı: cam/metal malzemeler bu olmadan düz/plastik görünüyordu.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;

  let rafId = null;
  let running = false;
  let dpr = Math.min(window.devicePixelRatio || 1, 1.75);

  function resize() {
    const parent = canvas.parentElement;
    const w = parent ? parent.clientWidth : window.innerWidth;
    const h = parent ? parent.clientHeight : window.innerHeight;
    if (w === 0 || h === 0) return;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(resize);
  if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);
  resize();

  let onFrame = null; // director.js buraya kamera/nesne güncellemesi bağlar
  let renderOverride = null; // postfx.js composer.render() ile değiştirir

  function render() {
    if (onFrame) onFrame();
    if (renderOverride) renderOverride();
    else renderer.render(scene, camera);
  }

  function loop() {
    if (!running) return;
    render();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    loop();
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function destroy() {
    stop();
    resizeObserver.disconnect();
    pmrem.dispose();
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          Object.values(m).forEach((v) => v?.isTexture && v.dispose());
          m.dispose();
        });
      }
    });
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return {
    renderer,
    scene,
    camera,
    render,
    start,
    stop,
    destroy,
    setOnFrame(fn) {
      onFrame = fn;
    },
    setRenderOverride(fn) {
      renderOverride = fn;
    },
  };
}
