// Süzülen 3B objeler — fiş, süt kutusu, yumurta kartonu. Primitive'lerden,
// PBR malzemeli; ayrı model dosyası indirmez (bütçe: sıfır ek asset isteği).
import * as THREE from 'three';

/**
 * Fiş üstüne basılan gerçek metin — seed.receipt.rawText'ten (aynı veri
 * kaynağı ActScan/ActParse'ın kullandığı). Boş bir beyaz düzlem yerine
 * gerçek market fişi görünmesi hem "ayna gibi parlak beyaz ışık" şikâyetini
 * kökten çözüyor (kâğıt artık dolu/kırık beyaz, bloom'u aşan tek düz yüzey
 * değil) hem de hikâyeye hizmet ediyor (bkz. plan Bölüm D).
 * @param {string} rawText
 * @returns {THREE.CanvasTexture}
 */
function createReceiptTexture(rawText) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Kırık beyaz kâğıt tonu — saf beyaz (#fff) DEĞİL, bloom'u tek başına
  // aşmayan bir zemin (bkz. plan tablosu: 0xf4f1e8 -> ~0xcfc9ba yönünde).
  ctx.fillStyle = '#d8d3c2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Hafif kağıt gren dokusu — düz tek renk yerine ince gürültü.
  const grain = ctx.createImageData(canvas.width, canvas.height);
  for (let i = 0; i < grain.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    grain.data[i] = grain.data[i + 1] = grain.data[i + 2] = 128 + n;
    grain.data[i + 3] = 8;
  }
  ctx.putImageData(grain, 0, 0);

  ctx.fillStyle = '#2a2a26';
  ctx.textBaseline = 'top';
  ctx.font = '600 30px monospace';
  ctx.fillText('MİGROS', 40, 50);
  ctx.font = '26px monospace';
  const lines = rawText.split('\n');
  let y = 110;
  for (const line of lines) {
    ctx.fillText(line, 40, y, canvas.width - 80);
    y += 38;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Fiş — hafifçe kıvrılmış bir düzlem (kağıt hissi), üstünde gerçek fiş metni.
 * @param {string} rawText seed.receipt.rawText
 * @returns {THREE.Mesh}
 */
export function createReceipt(rawText) {
  const geo = new THREE.PlaneGeometry(0.55, 1.1, 12, 24);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    // Hafif silindirik kıvrım — kağıdın düz durmaması.
    pos.setZ(i, Math.sin(x * 2.4) * 0.035);
  }
  geo.computeVertexNormals();
  // UV'ler PlaneGeometry'de zaten 0..1 — CanvasTexture doğrudan oturuyor.

  const texture = createReceiptTexture(rawText);
  const mat = new THREE.MeshPhysicalMaterial({
    map: texture,
    roughness: 0.88,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.kind = 'receipt';
  return mesh;
}

/**
 * Süt kutusu — dikdörtgen prizma, mat karton malzeme. Renk tonu koyulaştırıldı
 * (bkz. plan Bölüm D) — ikincil kalması, telefon/fişten dikkat çalmaması için.
 * @param {number} color
 * @returns {THREE.Mesh}
 */
export function createCarton(color = 0x1d4f91) {
  const geo = new THREE.BoxGeometry(0.42, 0.6, 0.42);
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.6, metalness: 0.02, clearcoat: 0.08 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.kind = 'carton';
  return mesh;
}

/**
 * Yumurta kartonu yerine basit bir kavanoz — silindir + cam malzeme.
 * Opaklık/rengi hafifçe koyulaştırıldı — aynı gerekçe (Bölüm D).
 * @returns {THREE.Mesh}
 */
export function createJar() {
  const geo = new THREE.CylinderGeometry(0.22, 0.22, 0.5, 24);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xdce8e0,
    transparent: true,
    opacity: 0.42,
    roughness: 0.08,
    transmission: 0.75,
    ior: 1.45,
    thickness: 0.3,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.kind = 'jar';
  return mesh;
}

/**
 * Hero için sabit bir prop seti — telefonun etrafında yavaşça süzülen birkaç obje.
 * @param {string} rawText seed.receipt.rawText — fiş dokusu için.
 * @returns {THREE.Group}
 */
export function createFloatingProps(rawText) {
  const group = new THREE.Group();

  // x konumları dar (390:844) canvas'ın görünür frustum genişliğine göre
  // kalibre edildi (bkz. stage.js kamera notu: ~±1.35 dünya birimi görünür
  // sınır) — önceki ±1.9 tamamen kare dışındaydı.
  const receipt = createReceipt(rawText);
  receipt.position.set(-1.05, 0.85, 0.9);
  receipt.rotation.set(0.15, 0.22, -0.12);
  group.add(receipt);

  // Kutu/kavanoz z'de geriye itildi (0.85/0.7 -> -0.3/-0.5) ve küçültüldü —
  // ikincil kalıyorlar, telefon/fişten önde durup dikkat çalmıyorlar.
  const carton = createCarton();
  carton.scale.setScalar(0.82);
  carton.position.set(0.95, -0.95, -0.3);
  carton.rotation.set(0.2, -0.35, 0.1);
  group.add(carton);

  const jar = createJar();
  jar.scale.setScalar(0.82);
  jar.position.set(0.8, 1.1, -0.5);
  jar.rotation.set(0, 0.3, 0);
  group.add(jar);

  group.userData.items = [receipt, carton, jar];
  return group;
}
