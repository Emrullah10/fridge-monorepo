import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

// Editör/launch config'ler genelde --env-file flag'i vermeden çalıştırır,
// bu yüzden .env'i burada da yüklüyoruz. Dosya yoksa (prod'da env zaten
// sistem tarafından set edilir) sessizce atlanır.
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '..', '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

import { loadAppConfig } from './configs/app-config.js';
import { buildContainer } from './src/container.js';
import { boot } from './src/boot.js';
import { startScanProcessor } from './src/workers/scan-processor.js';
import { startRetentionCleanupWorker } from './src/workers/retention-cleanup.js';
import { log } from '@fridge/helper';

const config = loadAppConfig();
const container = buildContainer(config);
const app = boot(container);

const server = app.listen(config.port, () => {
  log.info('server_started', { port: config.port, env: config.nodeEnv });
});

const scanProcessor = startScanProcessor({ container, intervalMs: config.scanWorkerIntervalMs });
const retentionWorker = startRetentionCleanupWorker({ container, intervalMs: config.retentionCleanupIntervalMs });

const shutdown = async () => {
  log.info('shutting_down');
  scanProcessor.stop();
  retentionWorker.stop();
  server.close();
  await container.datasource.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
