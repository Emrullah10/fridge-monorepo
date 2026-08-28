// Tek seferlik/periyodik temizlik — migrate.js zincirinin DIŞINDA tutulur
// (reset-ai-generated-products.js deseni, cerebrum 2026-08-26): migrate.js
// migration takip tablosu kullanmıyor, her .sql dosyasını her deploy'da
// yeniden çalıştırıyor — bir DELETE oraya konsaydı her deploy'da hâlâ aktif
// misafirleri de silme riski taşırdı.
//
// 30 gündür last_seen_at güncellenmemiş (ya da hiç güncellenmemiş) misafir
// hesapları siler. Sadece TEK ÜYELİ (kendisi dışında kimse paylaşmıyor)
// alanları olan misafirler silinir — paylaşımlı bir alanın sahibi olan
// "misafir" (davet ettiği biri katılmış olabilir) atlanır ve raporlanır,
// bu turun kapsamı dışı bırakılan bir kenar durumu.
//
// --dry-run VARSAYILAN — hiçbir şey silmez, sadece rapor basar. Gerçek
// silme yalnızca --apply ile.
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

const STALE_DAYS = 30;

const run = async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const apply = process.argv.includes('--apply');

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    const { rows: staleGuests } = await client.query(
      `SELECT id, email, last_seen_at, created_at FROM app_user
       WHERE is_guest = true
         AND (last_seen_at IS NULL OR last_seen_at < now() - ($1 || ' days')::interval)`,
      [STALE_DAYS],
    );
    console.log(`${STALE_DAYS} günden eski misafir hesabı: ${staleGuests.length}`);

    if (staleGuests.length === 0) {
      console.log('Silinecek misafir yok.');
      return;
    }

    let skippedShared = 0;
    let deleted = 0;

    for (const guest of staleGuests) {
      const { rows: ownedHouseholds } = await client.query(
        `SELECT id FROM household WHERE created_by = $1`,
        [guest.id],
      );

      let hasSharedHousehold = false;
      for (const household of ownedHouseholds) {
        const { rows: memberCount } = await client.query(
          `SELECT count(*) AS c FROM household_member WHERE household_id = $1`,
          [household.id],
        );
        if (Number(memberCount[0].c) > 1) {
          hasSharedHousehold = true;
          break;
        }
      }

      if (hasSharedHousehold) {
        skippedShared += 1;
        console.log(`ATLANDI (paylaşımlı alan sahibi): ${guest.id} (${guest.email})`);
        continue;
      }

      console.log(`${apply ? 'SİLİNİYOR' : 'SİLİNECEK'}: ${guest.id} (${guest.email}, last_seen_at=${guest.last_seen_at ?? 'hiç'})`);
      deleted += 1;

      if (apply) {
        // household CASCADE: storage_location/inventory_item/receipt_scan/
        // shopping_list/recipe (household_id FK'leri CASCADE, 0*-*.sql'lerde
        // tanımlı). household_member zaten CASCADE. app_user silinmeden önce
        // household'lar silinmeli (created_by RESTRICT, delete-account.use-case.js
        // ile aynı sıralama gerekçesi).
        for (const household of ownedHouseholds) {
          await client.query('DELETE FROM household WHERE id = $1', [household.id]);
        }
        await client.query('DELETE FROM app_user WHERE id = $1', [guest.id]);
      }
    }

    console.log(`\nÖzet: ${deleted} misafir ${apply ? 'silindi' : 'silinecekti'}, ${skippedShared} paylaşımlı alan sahibi atlandı.`);
    if (!apply) {
      console.log('--dry-run: hiçbir şey silinmedi. Gerçek silme için --apply geçin.');
    }
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
