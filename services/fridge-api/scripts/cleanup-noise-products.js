// Tek seferlik temizlik scripti. Çıktı-tarafı filtresi eklenmeden önce
// Gemini'nin döndürdüğü TOPLAM/KDV gibi gürültü satırları process-receipt-scan
// tarafından kalıcı `ai_generated` ürün + `product_alias` kaydına dönüşmüştü
// (bkz. process-receipt-scan.use-case.js). Bu script o kirliliği tespit edip
// (varsayılan: sadece raporlar) --apply ile siler.
//
// Kullanım:
//   node scripts/cleanup-noise-products.js            (dry-run, sadece raporlar)
//   node scripts/cleanup-noise-products.js --apply    (gerçekten siler)
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

import { isNonProductLine } from '@fridge/core/src/application/use-cases/receipt/process-receipt-scan.use-case.js';
import { makeDatasource } from '@fridge/core/src/infrastructure/persistence/datasource.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '..', '..', '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const APPLY = process.argv.includes('--apply');

const run = async () => {
  const datasource = makeDatasource({ connectionString: process.env.DATABASE_URL });

  try {
    const { rows: candidates } = await datasource.query(
      `SELECT p.id, p.canonical_name, p.household_id,
              (SELECT COUNT(*) FROM inventory_item ii WHERE ii.product_id = p.id) AS inventory_refs
       FROM product p
       WHERE p.source = 'ai_generated'`,
    );

    const noiseProducts = candidates.filter((row) => isNonProductLine(row.canonical_name));
    const skippedInUse = noiseProducts.filter((row) => Number(row.inventory_refs) > 0);
    const deletable = noiseProducts.filter((row) => Number(row.inventory_refs) === 0);

    console.log(`Taranan ai_generated ürün: ${candidates.length}`);
    console.log(`Gürültü olarak işaretlenen: ${noiseProducts.length}`);
    for (const row of noiseProducts) {
      console.log(`  - [${row.id}] "${row.canonical_name}" (household: ${row.household_id ?? 'global'})${Number(row.inventory_refs) > 0 ? '  ⚠️ envanterde referanslı, ATLANACAK' : ''}`);
    }
    console.log(`Silinebilir (envanterde referansı yok): ${deletable.length}`);
    if (skippedInUse.length > 0) {
      console.log(`Envanterde kullanılıyor diye atlanan: ${skippedInUse.length} (elle incelenmeli)`);
    }

    if (!APPLY) {
      console.log('\nDry-run modundasınız, hiçbir şey silinmedi. Uygulamak için --apply ekleyin.');
      return;
    }

    if (deletable.length === 0) {
      console.log('\nSilinecek bir şey yok.');
      return;
    }

    const ids = deletable.map((row) => row.id);
    await datasource.withTransaction(async ({ query }) => {
      const aliasResult = await query('DELETE FROM product_alias WHERE product_id = ANY($1::uuid[])', [ids]);
      await query('UPDATE receipt_line_item SET matched_product_id = NULL WHERE matched_product_id = ANY($1::uuid[])', [ids]);
      const productResult = await query('DELETE FROM product WHERE id = ANY($1::uuid[])', [ids]);
      console.log(`\nSilindi: ${productResult.rowCount} ürün, ${aliasResult.rowCount} alias.`);
    });
  } finally {
    await datasource.close();
  }
};

run().catch((error) => {
  console.error('Temizlik scripti başarısız oldu:', error);
  process.exitCode = 1;
});
