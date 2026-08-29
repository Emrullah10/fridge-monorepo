#!/usr/bin/env node
// i18n kural kapısı: src/motion/ ve src/scripts/ altında Türkçe'ye özgü karakter
// (ç ç ğ ı İ ö ş ü, büyük/küçük) olamaz — hareket modülleri metne dokunmamalı,
// sadece data-* kancalarına bakmalı (bkz. plan §i18n kural 3).
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const TARGET_DIRS = ['src/motion', 'src/scripts'];
const TR_CHARS = /[çğıİöşüÇĞÖŞÜ]/;

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(full)));
    else if (e.isFile() && (e.name.endsWith('.js') || e.name.endsWith('.mjs'))) files.push(full);
  }
  return files;
}

async function main() {
  let failed = false;
  for (const dir of TARGET_DIRS) {
    const files = await walk(path.join(process.cwd(), dir));
    for (const file of files) {
      const content = await readFile(file, 'utf8');
      // Yorum satırlarını da dahil ediyoruz — kural katı: bu klasörlerde hiç
      // Türkçe'ye özgü karakter olmamalı (yorumlar dahil, hataya düşmemek için).
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (TR_CHARS.test(line)) {
          console.error(`✗ ${path.relative(process.cwd(), file)}:${i + 1} — Türkçe karakter tespit edildi: ${line.trim()}`);
          failed = true;
        }
      });
    }
  }
  if (failed) {
    console.error('\n✗ check-i18n başarısız: hareket modülleri metne dokunmamalı.');
    process.exit(1);
  }
  console.log('✓ check-i18n geçti: src/motion ve src/scripts Türkçe içermiyor.');
}

main();
