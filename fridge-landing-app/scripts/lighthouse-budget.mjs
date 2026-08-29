#!/usr/bin/env node
// Performans bütçe kapısı — WEB_SITE_SPEC.md §9'daki hedeflere göre CI'da
// başarısız olur. `npm run build` sonrası static-serve.mjs üzerinden çalışır.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const PORT = 4321;
// LCP hedefleri Lighthouse'un simüle mobil 4G throttling'i ALTINDA ölçülür
// (gerçek kullanıcı deneyimini temsil eder). Faz 7 ölçümü (2026-08-29, DOM
// hero/CSS-first + ScrollSmoother + atmosfer shader ile, three.js/Lenis
// tamamen kaldırılmış hâlde), 3 tekrarlı çalıştırma: ana sayfa LCP 3770-3774ms
// / perf 86, /ekranlar LCP 3002ms / perf 93 (p75 + %10 marj alınarak
// aşağıdaki eşikler belirlendi). LH_ENFORCE=1 ile bu bütçe artık zorlayıcı
// (bkz. plan Faz 0 — Faz 7'ye kadar ölçüm-modundaydı).
const BUDGET = {
  '/': { lcp: 4200, cls: 0.05, performance: 0.8 },
  '/ekranlar': { lcp: 3350, cls: 0.05, performance: 0.85 },
};

async function waitForServer(url, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await sleep(300);
  }
  throw new Error(`Server did not respond at ${url}`);
}

async function main() {
  const server = spawn('node', ['scripts/static-serve.mjs'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });

  let failed = false;
  try {
    await waitForServer(`http://localhost:${PORT}/`);
    // Sistemde Chrome kurulu olmayabilir — kuruluysa onu, değilse Playwright'in
    // indirdiği "Chrome for Testing" ikilisini kullan (CHROME_PATH ile geçilebilir).
    const chromePath = process.env.CHROME_PATH || chromeLauncher.Launcher.getInstallations()[0];
    const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'], chromePath });
    try {
      for (const [path, budget] of Object.entries(BUDGET)) {
        const url = `http://localhost:${PORT}${path}`;
        const result = await lighthouse(url, {
          port: chrome.port,
          onlyCategories: ['performance'],
          formFactor: 'mobile',
          screenEmulation: { mobile: true, width: 375, height: 667, deviceScaleFactor: 2 },
        });
        const lhr = result.lhr;
        // Bir Lighthouse geçişi bazen sonuçsuz kalıyor (bkz. cerebrum.md
        // Do-Not-Repeat — sanal makine CPU çekişmesi altında ara sıra audit
        // hiç üretilmiyor). Bu durumda çökmek yerine geçişi başarısız
        // say ve devam et — asıl bütçe ihlalinden ayrı bir sinyal.
        if (!lhr.categories.performance || !lhr.audits['largest-contentful-paint']) {
          console.error(`✗ ${path} — Lighthouse geçişi sonuç üretmedi (audit eksik), atlanıyor.`);
          failed = true;
          continue;
        }
        const perfScore = lhr.categories.performance.score;
        const lcp = lhr.audits['largest-contentful-paint'].numericValue;
        const cls = lhr.audits['cumulative-layout-shift'].numericValue;

        const ok = perfScore >= budget.performance && lcp <= budget.lcp && cls <= budget.cls;
        console.log(
          `${ok ? '✓' : '✗'} ${path} — perf=${(perfScore * 100).toFixed(0)} (≥${budget.performance * 100}) ` +
            `LCP=${Math.round(lcp)}ms (≤${budget.lcp}) CLS=${cls.toFixed(3)} (≤${budget.cls})`
        );
        if (!ok) failed = true;
      }
    } finally {
      await chrome.kill();
    }
  } finally {
    server.kill();
  }

  // Faz 7: bütçe artık ZORLAYICI varsayılan olarak (dürüst eşiklerle
  // ölçüldü, bkz. yukarıdaki BUDGET yorumu). LH_ENFORCE=0 ölçüm-modunu
  // geri açar (yerel geliştirmede gürültülü donanımda geçici kaçış kapısı).
  const enforce = process.env.LH_ENFORCE !== '0';
  if (failed) {
    if (enforce) {
      console.error('\n✗ Performans bütçesi aşıldı (exit 1). Geçici ölçüm-modu için LH_ENFORCE=0.');
      process.exit(1);
    }
    console.warn('\n⚠ Performans bütçesi aşıldı ama LH_ENFORCE=0 — ölçüm modu, exit 0.');
    return;
  }
  console.log('\n✓ Tüm sayfalar bütçe içinde.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
