// Prosedürel telefon: alüminyum kasa (MeshPhysicalMaterial, fırçalanmış
// metal) + cam ön yüz (clearcoat) + ekran düzlemi (WebP doku, SRGBColorSpace,
// MeshBasicMaterial — bloom'un yakalayabilmesi için ışığa tepkisiz/parlak).
// Ölçüler telefonun gerçek en/boy oranını (390:844, PhoneFrame.astro ile
// aynı) korur, dünya birimi olarak yükseklik 3.4 sabitlenir.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const ASPECT = 390 / 844;
const HEIGHT = 3.4;
const WIDTH = HEIGHT * ASPECT;
const DEPTH = 0.18;
const BEZEL = 0.055;

/**
 * @param {THREE.Texture} screenTexture
 * @returns {{ group: THREE.Group, setScreenTexture: (tex: THREE.Texture) => void, screenMesh: THREE.Mesh, dispose: () => void }}
 */
export function createPhone(screenTexture) {
  const group = new THREE.Group();

  // Kasa — fırçalanmış alüminyum his: yüksek metalness, orta roughness.
  const bodyGeo = new RoundedBoxGeometry(WIDTH, HEIGHT, DEPTH, 6, 0.22);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a2d30,
    metalness: 0.85,
    roughness: 0.28,
    clearcoat: 0.3,
    clearcoatRoughness: 0.3,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // Ekran düzlemi — dokunun kendisi (MeshBasicMaterial: ışıktan bağımsız,
  // her zaman "yanık" görünüyor, bloom pass ekran parlamasını buradan alır).
  const screenGeo = new THREE.PlaneGeometry(WIDTH - BEZEL * 2, HEIGHT - BEZEL * 2);
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false });
  const screenMesh = new THREE.Mesh(screenGeo, screenMat);
  screenMesh.position.z = DEPTH / 2 + 0.002;
  group.add(screenMesh);

  // Cam ön yüz — ekranın hemen üzerinde ince bir clearcoat katmanı,
  // kenar yansımaları/parıltı burada oluşuyor.
  const glassGeo = new THREE.PlaneGeometry(WIDTH - BEZEL * 0.6, HEIGHT - BEZEL * 0.6);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.06,
    metalness: 0,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    transmission: 0.9,
    ior: 1.5,
    thickness: 0.02,
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.z = DEPTH / 2 + 0.006;
  group.add(glass);

  // Ekran ışığının kasaya taşması — RectAreaLight, gerçek stüdyo çekimlerinde
  // ekranın kendi çevresini hafifçe aydınlatması gibi.
  const screenGlow = new THREE.RectAreaLight(0xd0ffe3, 0.5, WIDTH * 0.9, HEIGHT * 0.9);
  screenGlow.position.z = DEPTH / 2 + 0.3;
  screenGlow.rotation.y = Math.PI;
  group.add(screenGlow);

  function setScreenTexture(tex) {
    screenMat.map = tex;
    screenMat.needsUpdate = true;
  }

  function dispose() {
    bodyGeo.dispose();
    bodyMat.dispose();
    screenGeo.dispose();
    screenMat.dispose();
    glassGeo.dispose();
    glassMat.dispose();
  }

  return { group, setScreenTexture, screenMesh, dispose, WIDTH, HEIGHT, DEPTH };
}

/**
 * Ekran dokusunu yükler — sRGB renk uzayı zorunlu, aksi halde doku solgun/
 * gri çıkar (bkz. cerebrum.md: WebGLRenderer.outputColorSpace ile eşleşmeyen
 * doku renk uzayı sistematik olarak soluk renkler üretiyordu).
 * @param {string} url
 * @returns {Promise<THREE.Texture>}
 */
export function loadScreenTexture(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = false;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        resolve(tex);
      },
      undefined,
      reject
    );
  });
}
