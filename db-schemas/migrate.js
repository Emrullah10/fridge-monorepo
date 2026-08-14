import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const run = async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString });

  const files = readdirSync(__dirname)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(__dirname, file), 'utf8');
    console.log(`Applying ${file}...`);
    await pool.query(sql);
  }

  await pool.end();
  console.log('Migration complete.');
};

run().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
