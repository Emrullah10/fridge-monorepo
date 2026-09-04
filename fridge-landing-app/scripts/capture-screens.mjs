#!/usr/bin/env node
// Ekran maketlerini WebGL telefon dokusu olarak yakalar. `npm run build` ile
// üretilmiş `dist/capture-tool/<screen>--<theme>--<mode>/` sayfalarını
// static-serve.mjs üzerinden Playwright'te açar, 390x844 viewport @3x DPR
// ile ekran görüntüsü alır, `public/screens/<key>-<theme>-<mode>.webp`
// olarak yazar (WebP q82, `sharp` ile küçültme — 780x1688 hedef).
//
// Önkoşul: `npm run build` (capture-tool sayfaları dist/'e yazılmış olmalı).
// Kullanım: node scripts/capture-screens.mjs [--only household-home,inventory]
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { screens } from '../src/lib/screens.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '../dist');
const OUT_DIR = join(__dirname, '../public/screens');
const PORT = 4322;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        let path = decodeURIComponent(req.url.split('?')[0]);
        let filePath = join(ROOT, path);
        let st = await stat(filePath).catch(() => null);
        if (st?.isDirectory()) filePath = join(filePath, 'index.html');
        const data = await readFile(filePath);
        res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function main() {
  const onlyArg = process.argv.find((a) => a.startsWith('--only'));
  const only = onlyArg ? onlyArg.split('=')[1]?.split(',') : null;

  await mkdir(OUT_DIR, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  });

  let count = 0;
  for (const s of screens) {
    if (only && !only.includes(s.key)) continue;
    const modes = s.supportsEmptyMode ? ['full', 'empty'] : ['full'];
    for (const theme of ['light', 'dark']) {
      for (const mode of modes) {
        const slug = `${s.key}--${theme}--${mode}`;
        await page.goto(`http://localhost:${PORT}/capture-tool/${slug}`, { waitUntil: 'networkidle' });
        const outPath = join(OUT_DIR, `${s.key}-${theme}-${mode}.webp`);
        await page.screenshot({ path: outPath, type: 'webp', quality: 82 });
        count++;
        process.stdout.write(`  ✓ ${s.key}-${theme}-${mode}.webp\n`);
      }
    }
  }

  await browser.close();
  server.close();
  console.log(`\n${count} ekran dokusu → public/screens/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
