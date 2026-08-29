#!/usr/bin/env node
// JS bütçe kapısı — WEB_SITE_SPEC plan bütçesi: `/` hareket parçası ≤ 95 KB gzip,
// alt sayfaların referans verdiği hiçbir parça > 5 KB gzip. `npm run build` sonrası
// dist/_astro içindeki JS parçalarını gzip'leyip ölçer. Ölçen ama düşürmeyen mod:
// LH_ENFORCE=1 ile zorlar (lighthouse-budget.mjs ile aynı bayrak), yoksa yalnız raporlar.
import { readdir, readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const DIST_ASTRO = path.join(process.cwd(), 'dist', '_astro');
const HOME_BUDGET = 95 * 1024; // ana sayfa film parçası
const CHUNK_BUDGET = 5 * 1024; // alt sayfa parçaları

async function main() {
  let files;
  try {
    files = (await readdir(DIST_ASTRO)).filter((f) => f.endsWith('.js'));
  } catch {
    console.warn('⚠ dist/_astro bulunamadı — önce `npm run build` çalıştırın.');
    process.exit(0);
  }

  let failed = false;
  let homeTotal = 0;
  const report = [];

  for (const file of files) {
    const full = path.join(DIST_ASTRO, file);
    const buf = await readFile(full);
    const gz = gzipSync(buf).length;
    // "home"a ait olduğu tahmini: dosya adı home/act/motion/atmosphere içeriyorsa.
    const isHomeChunk = /home|act[0-9]|hero|atmosphere|motion|runtime/i.test(file);
    if (isHomeChunk) homeTotal += gz;
    report.push({ file, gz, isHomeChunk });
  }

  report.sort((a, b) => b.gz - a.gz);
  for (const r of report) {
    const kb = (r.gz / 1024).toFixed(1);
    const overChunk = !r.isHomeChunk && r.gz > CHUNK_BUDGET;
    console.log(`${overChunk ? '✗' : ' '} ${r.file} — ${kb} KB gzip${r.isHomeChunk ? ' (home)' : ''}`);
    if (overChunk) failed = true;
  }

  const homeKb = (homeTotal / 1024).toFixed(1);
  const homeOk = homeTotal <= HOME_BUDGET;
  console.log(`\n${homeOk ? '✓' : '✗'} Ana sayfa film parçası toplamı: ${homeKb} KB gzip (≤ ${(HOME_BUDGET / 1024).toFixed(0)} KB)`);
  if (!homeOk) failed = true;

  const enforce = process.env.LH_ENFORCE === '1';
  if (failed) {
    if (enforce) {
      console.error('\n✗ Bundle bütçesi aşıldı (LH_ENFORCE=1, exit 1).');
      process.exit(1);
    }
    console.warn('\n⚠ Bundle bütçesi aşıldı ama LH_ENFORCE ayarlanmadı — ölçüm modu, exit 0.');
    return;
  }
  console.log('\n✓ Tüm parçalar bütçe içinde.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
