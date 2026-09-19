#!/usr/bin/env node
// public/og/default.png üretici. Elle Photoshop/Figma yerine HTML/CSS ile yazılır,
// böylece _tokens.scss renkleri ve gerçek logo birebir kullanılır ve marka/başlık
// değiştiğinde `npm run og` ile yeniden üretilebilir. ImageMagick yok, `sips` metin
// yazamıyor — bu yüzden Chromium screenshot yaklaşımı (zaten devDependency).
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'public/og/default.png');
const LOGO_PATH = join(ROOT, 'public/icons/logo-512.png');

const logoBase64 = readFileSync(LOGO_PATH).toString('base64');

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 1200px; height: 630px;
    background: linear-gradient(135deg, #096444 0%, #0b7a52 100%);
    font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .wrap {
    display: flex; flex-direction: column; align-items: flex-start;
    gap: 32px; padding: 0 96px;
  }
  .logo { width: 96px; height: 96px; border-radius: 20px; }
  h1 {
    color: #ffffff; font-size: 64px; font-weight: 700;
    line-height: 1.15; letter-spacing: -0.01em; max-width: 900px;
  }
  p {
    color: rgba(255,255,255,0.85); font-size: 30px; font-weight: 400;
    max-width: 820px; line-height: 1.4;
  }
</style>
</head>
<body>
  <div class="wrap">
    <img class="logo" src="data:image/png;base64,${logoBase64}" />
    <h1>Fişi tara, gerisini Elde halletsin.</h1>
    <p>Market fişini tara, ürünler envanterine düşsün. Ne biriktirdiğini, ne israf ettiğini gör.</p>
  </div>
</body>
</html>`;

mkdirSync(dirname(OUT), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.screenshot({ path: OUT });
await browser.close();

console.log(`✓ OG görseli üretildi → ${OUT}`);
