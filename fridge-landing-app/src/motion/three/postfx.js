// EffectComposer + bloom (ekran parlaması) + SMAA (WebGL2 antialias yerine
// composited pipeline'da post-AA). `lite` bu dosyayı hiç import etmez —
// yalnızca stage.js'in çıplak renderer.render()'ı kullanılır (bkz. plan
// "full katmanında"). three'nin kendi examples/jsm modülleri — ek paket yok.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/**
 * @param {{ renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera }} stage
 */
export function createPostFX({ renderer, scene, camera }) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // Eşik yükseltildi (0.92 -> 1.0), güç ve yarıçap düşürüldü (0.28/0.6 ->
  // 0.16/0.4) — yalnızca GERÇEKTEN yanan yüzeyler (telefon ekranı,
  // MeshBasicMaterial+toneMapped:false) parlasın; kâğıt/kutu gibi mat
  // yüzeyler artık haleye dönüşmüyor (bkz. plan Bölüm D tablosu).
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.16, 0.4, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize(w, h) {
    composer.setSize(w, h);
  }

  function render() {
    composer.render();
  }

  function dispose() {
    composer.dispose();
  }

  return { composer, bloom, resize, render, dispose };
}
