// Kalıcı film sahnesi — StudioScene.astro'daki tek canvas'a mount edilir,
// `#film` sarmalayıcısının kapsadığı TÜM perdeler boyunca yaşar (bkz. plan
// "Tek scrub'lı ana zaman çizelgesi"). hero.js'in eski mountHeroScene()'i
// bunun yerini alıyor — artık hero'ya özel değil, `seek(progress)` API'si
// ile herhangi bir 0->1 ilerlemesine tepki veriyor. Çağıran (src/scripts/
// home.js) bu ilerlemeyi tek bir ScrollTrigger'dan besler.
import * as THREE from 'three';
import { createStage } from './stage.js';
import { createPhone, loadScreenTexture } from './phone.js';
import { createPostFX } from './postfx.js';
import { createFloatingProps } from './props.js';
import { sampleChoreography, SCREEN_KEYS } from './choreography.js';
import { getSeed } from '@seed/index';

/**
 * @param {{ canvas: HTMLCanvasElement, theme?: 'dark'|'light' }} opts
 * @returns {Promise<{ seek: (progress: number) => void, setPointer: (x: number, y: number) => void, destroy: () => void }>}
 */
export async function mountFilmScene({ canvas, theme = 'dark' }) {
  const stage = createStage({ canvas });
  const postfx = createPostFX(stage);

  // Key ışık yoğunluğu düşürüldü (1.6 -> 1.15) ve konumu sıyırma açısına
  // çekildi (z 4.5 -> 2.0) — önceki cepheden aydınlatma, fişin neredeyse
  // beyaz kâğıt yüzeyini bloom eşiğini aşacak kadar parlatıyordu (bkz. plan
  // Bölüm D: "ayna gibi parlak beyaz ışık" şikâyeti, ölçülen luminans>0.97
  // piksel oranı kabul edilemez seviyedeydi).
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(3.2, 2.4, 2.0);
  stage.scene.add(key);

  const fill = new THREE.DirectionalLight(0x88d6af, 0.4);
  fill.position.set(-3.0, -1.0, 2.5);
  stage.scene.add(fill);

  const rim = new THREE.DirectionalLight(0xd0ffe3, 0.7);
  rim.position.set(-1.8, 2.2, -3.0);
  stage.scene.add(rim);

  const ambient = new THREE.AmbientLight(0xffffff, 0.25);
  stage.scene.add(ambient);

  // Zemin teması gölgesi — telefonun altında yumuşak bir radial gradyan dokusu.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const ctx2d = shadowCanvas.getContext('2d');
  const grad = ctx2d.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx2d.fillStyle = grad;
  ctx2d.fillRect(0, 0, 256, 256);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
  const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), shadowMat);
  shadowMesh.position.set(0.1, -2.3, -1.2);
  // stage.scene.add(shadowMesh) BURADA DEĞİL — gölge subjectGroup'a dahil
  // edilmeli ki özne hero'da sağa kayınca (subjectFrac) gölge de onunla
  // birlikte hareket etsin, aksi halde telefon kayar ama gölgesi ekran
  // merkezinde sabit kalırdı.

  // Perdeler arasında geçen tüm ekran dokuları önceden yüklenir (bkz.
  // choreography.js SCREEN_KEYS) — perde sınırında geçiş anında ağ isteği
  // beklemek film'i durdururdu.
  const textureCache = new Map();
  await Promise.all(
    SCREEN_KEYS.map(async (key) => {
      const tex = await loadScreenTexture(`/screens/${key}-${theme}-full.webp`);
      textureCache.set(key, tex);
    })
  );

  const initialScreen = textureCache.get(SCREEN_KEYS[0]);
  const phone = createPhone(initialScreen);
  // Fiş prop'u gerçek fiş metnini taşıyor — aynı seed kaynağı ActScan/
  // ActParse'ın kullandığı (bkz. plan Bölüm D: boş beyaz düzlem yerine).
  const propsGroup = createFloatingProps(getSeed('full').receipt.rawText);

  // Özne grubu (telefon + proplar) — hero'da onaylanan hibrit storyboard'a
  // göre sağ sütuna kaydırılıyor (bkz. choreography.js subjectFrac), Perde
  // 1'e girişte ekran merkezine dönüyor. `subjectGroup.position.x` her
  // karede FOV/kamera mesafesinden türetilen GERÇEK genişliğe göre
  // hesaplanır — sabit dünya birimi kullanılsaydı farklı viewport
  // genişliklerinde (1440 vs 1024) aynı görsel orana denk gelmezdi
  // (bkz. plan Bölüm C "duyarlı ofset").
  const subjectGroup = new THREE.Group();
  subjectGroup.add(shadowMesh);
  subjectGroup.add(phone.group);
  subjectGroup.add(propsGroup);
  stage.scene.add(subjectGroup);

  const clock = new THREE.Clock();
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let currentScreenKey = SCREEN_KEYS[0];
  let currentProgress = 0;

  function onPointerMove(e) {
    pointer.targetX = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.targetY = (e.clientY / window.innerHeight) * 2 - 1;
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  stage.setOnFrame(() => {
    const t = clock.getElapsedTime();
    pointer.x += (pointer.targetX - pointer.x) * 0.05;
    pointer.y += (pointer.targetY - pointer.y) * 0.05;

    const c = sampleChoreography(currentProgress);

    stage.camera.position.set(c.camX, c.camY, c.camZ);
    stage.camera.lookAt(0, 0, 0);

    // subjectFrac (-1..1) -> gerçek dünya x'i. FOV/aspect'ten türetilen
    // görünür yarı-genişlik, kameranın ÖZNEYE olan mesafesine göre (camZ -
    // öznenin kendi z'si, ki 0) hesaplanır — resize'da otomatik güncellenir
    // çünkü her karede yeniden hesaplanıyor (bkz. stage.js camera.aspect).
    const distanceToSubject = c.camZ; // özne z=0'da duruyor
    const visibleHalfHeight = distanceToSubject * Math.tan((stage.camera.fov * Math.PI) / 360);
    const visibleHalfWidth = visibleHalfHeight * stage.camera.aspect;
    subjectGroup.position.x = c.subjectFrac * visibleHalfWidth;

    phone.group.rotation.y = c.phoneRotY + pointer.x * 0.06 + Math.sin(t * 0.25) * 0.02;
    phone.group.rotation.x = c.phoneRotX - pointer.y * 0.03;
    phone.group.position.y = Math.sin(t * 0.4) * 0.05;

    if (c.screen !== currentScreenKey) {
      currentScreenKey = c.screen;
      const tex = textureCache.get(c.screen);
      if (tex) phone.setScreenTexture(tex);
    }

    propsGroup.userData.items.forEach((item, i) => {
      const offset = i * 2.1;
      item.position.y += Math.sin(t * 0.6 + offset) * 0.0015;
      item.rotation.y += 0.0025 * (i % 2 === 0 ? 1 : -1);
      item.rotation.x = Math.sin(t * 0.3 + offset) * 0.15;
    });
  });

  stage.setRenderOverride(() => postfx.render());
  stage.start();

  function handleResize() {
    postfx.resize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', handleResize, { passive: true });
  handleResize();

  /**
   * @param {number} progress 0..1 — film.js'in tek scrub kaynağından beslenir.
   */
  function seek(progress) {
    currentProgress = progress;
  }

  function destroy() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('resize', handleResize);
    postfx.dispose();
    phone.dispose();
    textureCache.forEach((tex) => tex.dispose());
    shadowTex.dispose();
    shadowMat.dispose();
    shadowMesh.geometry.dispose();
    stage.destroy();
  }

  return { seek, destroy };
}
