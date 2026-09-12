// ai_usage_log tablosundan (bkz. 22-ai-usage-log.sql) özellik/model/hata
// bazında kullanım raporu üretir. "Kaç kullanıcı ne kadar kullanıyor, hangi
// limit vuruyor, hangi model daha ucuz" sorularının hepsini tek komutla
// cevaplamak için — purge-stale-guests.js ile aynı desen (bağımsız script,
// migrate.js zincirinin dışında).
//
// Kullanım: node ai-usage-report.js [--days 7]
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envPath);
}

const { Pool } = pg;

// Eylül 2026 fiyatları (docs.z.ai/guides/overview/pricing), $/1M token.
// Karşılaştırma amaçlı — gerçek fatura Z.ai konsolundan doğrulanmalı.
// Gemini satırları geçmiş kayıtlar (provider Gemini/Groq'tan Z.ai'ye geçmeden
// önce) için maliyet hesaplanabilsin diye korunuyor, artık yeni çağrı üretmiyor.
const MODEL_PRICING = {
  'glm-4.7-flash': { input: 0, output: 0 },
  'glm-5.3-flash': { input: 0.15, output: 0.50 },
  'glm-4.7': { input: 0.60, output: 2.20 },
  'glm-4.6': { input: 0.60, output: 2.20 },
  'gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
  'gemini-3.6-flash': { input: 0.75, output: 3.75 },
  'gemini-3.7-flash': { input: 0.75, output: 3.75 },
};

const daysArg = () => {
  const idx = process.argv.indexOf('--days');
  if (idx === -1) return 7;
  const value = Number(process.argv[idx + 1]);
  return Number.isFinite(value) && value > 0 ? value : 7;
};

const estimateCost = (model, promptTokens, outputTokens) => {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return null;
  return (promptTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
};

const fmtUsd = (n) => (n == null ? 'n/a' : `$${n.toFixed(4)}`);

const run = async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const days = daysArg();

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    console.log(`\n=== AI Kullanım Raporu — son ${days} gün ===\n`);

    // 1) Genel özet: toplam / başarılı / başarısız
    const { rows: overall } = await client.query(
      `SELECT count(*) AS total,
              count(*) FILTER (WHERE ok) AS ok_count,
              count(*) FILTER (WHERE NOT ok) AS fail_count
       FROM ai_usage_log
       WHERE created_at > now() - ($1 || ' days')::interval`,
      [days],
    );
    const { total, ok_count: okCount, fail_count: failCount } = overall[0];
    console.log(`Toplam çağrı: ${total} | başarılı: ${okCount} | başarısız: ${failCount}\n`);

    if (Number(total) === 0) {
      console.log('Bu aralıkta hiç kayıt yok — ai_usage_log henüz veri toplamamış olabilir.');
      return;
    }

    // 2) Hata kırılımı
    const { rows: errors } = await client.query(
      `SELECT error_code, count(*) AS n
       FROM ai_usage_log
       WHERE created_at > now() - ($1 || ' days')::interval AND NOT ok
       GROUP BY error_code ORDER BY n DESC`,
      [days],
    );
    if (errors.length > 0) {
      console.log('--- Hata kodu kırılımı ---');
      for (const row of errors) console.log(`  ${row.error_code ?? '(bilinmiyor)'}: ${row.n}`);
      console.log('');
    }

    // 3) Özellik bazında çağrı + token + maliyet (mevcut model)
    const { rows: byFeature } = await client.query(
      `SELECT feature, model,
              count(*) AS calls,
              avg(prompt_tokens) AS avg_prompt,
              avg(output_tokens) AS avg_output,
              sum(prompt_tokens) AS sum_prompt,
              sum(output_tokens) AS sum_output
       FROM ai_usage_log
       WHERE created_at > now() - ($1 || ' days')::interval AND ok
       GROUP BY feature, model ORDER BY calls DESC`,
      [days],
    );
    console.log('--- Özellik bazında (başarılı çağrılar) ---');
    for (const row of byFeature) {
      const sumPrompt = Number(row.sum_prompt ?? 0);
      const sumOutput = Number(row.sum_output ?? 0);
      const currentCost = estimateCost(row.model, sumPrompt, sumOutput);
      // Karşılaştırma: daha ucuz glm-5.3-flash'a geçilse maliyet ne olurdu?
      // (Kalite/hız karşılaştırması ayrı — glm-5.3-flash'ta thinking
      // kapatılamıyor, bkz. docs/ZAI_MIGRATION_PLAN.md.)
      const cheaperAltCost = estimateCost('glm-5.3-flash', sumPrompt, sumOutput);
      console.log(
        `  ${row.feature.padEnd(10)} model=${row.model.padEnd(22)} çağrı=${row.calls} ` +
        `ort.girdi=${Math.round(row.avg_prompt ?? 0)} ort.çıktı=${Math.round(row.avg_output ?? 0)} ` +
        `maliyet(mevcut)=${fmtUsd(currentCost)} maliyet(glm-5.3-flash ile)=${fmtUsd(cheaperAltCost)}`,
      );
    }
    console.log('');

    // 4) Kullanıcı başına günlük ortalama ve p95 çağrı
    const { rows: perUser } = await client.query(
      `WITH daily AS (
         SELECT user_id, date_trunc('day', created_at) AS day, count(*) AS n
         FROM ai_usage_log
         WHERE created_at > now() - ($1 || ' days')::interval AND user_id IS NOT NULL
         GROUP BY user_id, day
       )
       SELECT avg(n) AS avg_daily,
              percentile_cont(0.95) WITHIN GROUP (ORDER BY n) AS p95_daily,
              max(n) AS max_daily,
              count(DISTINCT user_id) AS distinct_users
       FROM daily`,
      [days],
    );
    const u = perUser[0];
    console.log('--- Kullanıcı başına günlük çağrı ---');
    console.log(
      `  aktif kullanıcı=${u.distinct_users} ort=${Number(u.avg_daily ?? 0).toFixed(1)} ` +
      `p95=${Number(u.p95_daily ?? 0).toFixed(1)} maks=${u.max_daily ?? 0}\n`,
    );

    // 5) Ölçülen tepe RPM ve günlük toplam RPD — Z.ai rate limit'lerine ne
    // kadar yaklaşıldığını göstermek için. Groq'ta bu tavan (TPD 200K,
    // ~63 kullanıcı) geç fark edildiği için (bkz. docs/AI_PROVIDER_SPEC.md)
    // Z.ai'de erken izlenmeli — konsoldan okunan gerçek limitle karşılaştırın.
    const { rows: peakMinute } = await client.query(
      `SELECT date_trunc('minute', created_at) AS minute, count(*) AS n
       FROM ai_usage_log
       WHERE created_at > now() - ($1 || ' days')::interval
       GROUP BY minute ORDER BY n DESC LIMIT 1`,
      [days],
    );
    const { rows: peakDay } = await client.query(
      `SELECT date_trunc('day', created_at) AS day, count(*) AS n
       FROM ai_usage_log
       WHERE created_at > now() - ($1 || ' days')::interval
       GROUP BY day ORDER BY n DESC LIMIT 1`,
      [days],
    );
    console.log('--- Tepe yük (ücretsiz katman limitiyle karşılaştırmak için) ---');
    console.log(`  en yoğun dakika: ${peakMinute[0]?.n ?? 0} istek (${peakMinute[0]?.minute ?? '-'})`);
    console.log(`  en yoğun gün: ${peakDay[0]?.n ?? 0} istek (${peakDay[0]?.day ?? '-'})\n`);

    console.log('Not: Gerçek RPM/TPM/TPD kotanızı Z.ai konsolu > API key sayfasından doğrulayın — Z.ai bu sayıları dokümanında yayınlamıyor.');
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
