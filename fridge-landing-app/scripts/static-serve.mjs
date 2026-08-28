#!/usr/bin/env node
// Basit statik dosya sunucusu — sadece test/CI amaçlı (Playwright webServer).
// `astro preview`/`astro dev` bu Astro sürümünde varsayılan olarak arka plana
// geçip hemen çıkıyor (exit 0), Playwright'in webServer'ı bunu "çöktü" sanıyor
// (bkz. cerebrum.md Do-Not-Repeat). Bu script foreground kalır.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '../dist');
const PORT = Number(process.env.PORT) || 4321;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.xml': 'application/xml',
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(req.url.split('?')[0]);
    let filePath = join(ROOT, path);
    let st;
    try {
      st = await stat(filePath);
    } catch {
      filePath = join(ROOT, path, 'index.html');
      st = await stat(filePath).catch(() => null);
    }
    if (st && st.isDirectory()) {
      filePath = join(filePath, 'index.html');
    }
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`✓ static serve → http://localhost:${PORT}`);
});
