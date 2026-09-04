#!/usr/bin/env node
// Build-sonrası HTML işleme: `Icon.astro` her kullanımda tam SVG path
// verisini basıyor (component-seviyesi <symbol>/<use> dedup denendi ve
// terk edildi — Astro'nun render izolasyonu modül state paylaşmıyor,
// bkz. Icon.astro üstündeki not). Bu script dist/**/*.html'i tarar, aynı
// data-icon-name'e sahip tekrarlanan <svg class="mock-icon"> bloklarını
// bulur, ilkini <symbol> olarak <body> başına taşır, geri kalanları
// ~40 baytlık <svg><use> referansına indirger.
//
// Ölçülen etki (/ekranlar, 170 kullanım / 16 benzersiz ikon):
// öncesi 278KB -> sonrası ~165KB (bkz. plan doğrulama #8).
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.join(process.cwd(), 'dist');

const SVG_RE = /<svg class="mock-icon" data-icon-name="([a-z_]+)"([^>]*)>(.*?)<\/svg>/g;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(full)));
    else if (e.name.endsWith('.html')) files.push(full);
  }
  return files;
}

function processHtml(html) {
  const symbols = new Map(); // name -> inner path markup
  let useCount = 0;

  const withUses = html.replace(SVG_RE, (match, name, attrs, inner) => {
    if (!symbols.has(name)) symbols.set(name, inner);
    useCount++;
    // width/height attrs orijinal <svg>'den korunuyor (attrs boşluk dahil).
    return `<svg class="mock-icon"${attrs} fill="currentColor" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
  });

  if (symbols.size === 0) return { html, changed: false };

  const spriteDefs = [...symbols.entries()]
    .map(([name, inner]) => `<symbol id="icon-${name}" viewBox="0 -960 960 960">${inner}</symbol>`)
    .join('');
  const sprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${spriteDefs}</svg>`;

  const withSprite = withUses.replace('<body>', `<body>${sprite}`);
  return { html: withSprite, changed: true, unique: symbols.size, uses: useCount };
}

async function main() {
  let files;
  try {
    files = await walk(DIST);
  } catch {
    console.warn('⚠ dist/ bulunamadı — önce `npm run build` çalıştırın.');
    process.exit(0);
  }

  let totalBefore = 0;
  let totalAfter = 0;
  let touchedFiles = 0;

  for (const file of files) {
    const before = await readFile(file, 'utf-8');
    const beforeSize = Buffer.byteLength(before, 'utf-8');
    const { html: after, changed, unique, uses } = processHtml(before);
    if (!changed) continue;
    const afterSize = Buffer.byteLength(after, 'utf-8');
    await writeFile(file, after, 'utf-8');
    touchedFiles++;
    totalBefore += beforeSize;
    totalAfter += afterSize;
    const rel = path.relative(DIST, file);
    console.log(`  ${rel}: ${uses} kullanım / ${unique} benzersiz — ${(beforeSize / 1024).toFixed(1)}KB -> ${(afterSize / 1024).toFixed(1)}KB`);
  }

  console.log(`\n✓ ${touchedFiles} dosya işlendi, toplam ${((totalBefore - totalAfter) / 1024).toFixed(1)}KB tasarruf`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
