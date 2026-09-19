#!/usr/bin/env node
// Ham cihaz screenshot'larını (public/shots/_raw/<key>@<platform>.png) işleyip
// WebP'ye çevirir. `sips` ile küçültme + `cwebp` ile sıkıştırma (ikisi de doğrulandı,
// ImageMagick makinede yok). iOS simulator çıktısı ~1320×2868 gibi büyük geliyor —
// önce sips ile küçültülmeden cwebp'ye verilirse dosyalar gereksiz şişer.
//
// Kullanım: ham PNG'leri public/shots/_raw/'a koy, sonra `npm run shots`.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const RAW_DIR = join(ROOT, 'public/shots/_raw');
const OUT_DIR = join(ROOT, 'public/shots/tr');

const TARGET_WIDTH_1X = 585; // DeviceShot ~380px göründüğü için 1.5x tampon
const TARGET_WIDTH_2X = 1170;

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

if (!existsSync(RAW_DIR)) {
  console.error(`✗ ${RAW_DIR} yok. Önce çekilen PNG'leri oraya koy.`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const files = readdirSync(RAW_DIR).filter((f) => f.toLowerCase().endsWith('.png'));
if (files.length === 0) {
  console.error(`✗ ${RAW_DIR} içinde .png bulunamadı.`);
  process.exit(1);
}

const tmpDir = join(RAW_DIR, '.tmp');
mkdirSync(tmpDir, { recursive: true });

for (const file of files) {
  const key = basename(file, '.png'); // örn. receipt-scan@ios
  const rawPath = join(RAW_DIR, file);
  const tmp1x = join(tmpDir, `${key}-1x.png`);
  const tmp2x = join(tmpDir, `${key}-2x.png`);
  const out1x = join(OUT_DIR, `${key}.webp`);
  const out2x = join(OUT_DIR, `${key}@2x.webp`);

  console.log(`→ ${file}`);
  run(`sips -Z ${TARGET_WIDTH_2X} "${rawPath}" --out "${tmp2x}"`);
  run(`sips -Z ${TARGET_WIDTH_1X} "${rawPath}" --out "${tmp1x}"`);
  run(`cwebp -q 82 "${tmp2x}" -o "${out2x}"`);
  run(`cwebp -q 82 "${tmp1x}" -o "${out1x}"`);
}

rmSync(tmpDir, { recursive: true, force: true });

console.log(`\n✓ ${files.length} screenshot işlendi → ${OUT_DIR}`);
