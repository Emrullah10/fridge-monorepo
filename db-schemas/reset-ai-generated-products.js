// Tek seferlik veri temizliği — numaralı .sql zincirinin DIŞINDA (seed.js
// deseniyle aynı gerekçe): migrate.js her .sql dosyasını HER db:migrate
// çalıştırmasında yeniden uyguluyor (migration takip tablosu yok), bu yüzden
// tek seferlik bir DELETE oraya konursa her deploy'da kullanıcının o günden
// sonra öğrendiği yeni ürünleri de silerdi.
//
// NEDEN: "Kızılay Mangoana" gibi bozuk isimli/kategorisiz ai_generated
// ürünler bir kirlenme döngüsü üretiyordu (bkz. generate-ai-recipes.use-case.js
// yorumu) — fiş bozuk isim üretiyor, tarif AI'ı daha da bozuk bir malzeme
// adı yazıyor, eşleşmeyince yeni bir kategorisiz ürün daha yaratılıyordu.
// Faz 1-5 (marka->kategori, isim şüphe kontrolü, tarif artık ürün
// yaratmıyor, OCR normalizasyonu) kod olarak DEPLOY EDİLDİKTEN SONRA bu
// script çalıştırılmalı — aksi halde silinen ürünler bir sonraki taramada
// aynı hatalı mantıkla yeniden yaratılır.
//
// KULLANICI KARARI: tam sıfırlama, ölçülen bedel kabul edildi (20 ürün,
// 22 envanter satırı, 13 recipe_ingredient/3 tarif). recipe_ingredient
// artık custom_name destekliyor (bkz. 13-recipe-ingredient-custom-name.sql)
// — bu script product_id'yi silmeden önce custom_name'e taşıyarak tarifleri
// malzemesiz bırakmaz.
import pg from 'pg';
import { normalizeAliasText } from '../core/fridge-core/src/infrastructure/persistence/repositories/product-alias.repository.js';

const { Pool } = pg;

const run = async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const dryRun = process.argv.includes('--dry-run');

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: aiProducts } = await client.query(
      `SELECT id, canonical_name FROM product WHERE source = 'ai_generated'`,
    );
    const aiProductIds = aiProducts.map((p) => p.id);
    console.log(`ai_generated ürün sayısı: ${aiProductIds.length}`);

    if (aiProductIds.length === 0) {
      await client.query('ROLLBACK');
      console.log('Silinecek ai_generated ürün yok.');
      return;
    }

    const { rows: invRows } = await client.query(
      `SELECT household_id, count(*) AS item_count
       FROM inventory_item WHERE product_id = ANY($1)
       GROUP BY household_id`,
      [aiProductIds],
    );
    const totalInventory = invRows.reduce((sum, row) => sum + Number(row.item_count), 0);
    console.log(`Etkilenecek hane sayısı (envanter): ${invRows.length}, toplam envanter satırı: ${totalInventory}`);

    const { rows: ingredientRows } = await client.query(
      `SELECT DISTINCT recipe_id FROM recipe_ingredient WHERE product_id = ANY($1)`,
      [aiProductIds],
    );
    console.log(`Etkilenecek tarif sayısı (malzeme product_id'si silinecek, custom_name'e taşınacak): ${ingredientRows.length}`);

    if (dryRun) {
      await client.query('ROLLBACK');
      console.log('--dry-run: hiçbir şey silinmedi.');
      return;
    }

    // 1) recipe_ingredient: product_id'yi custom_name'e taşı, tarifler
    //    malzemesiz kalmasın (13-recipe-ingredient-custom-name.sql şeması).
    const { rowCount: ingredientCount } = await client.query(
      `UPDATE recipe_ingredient ri SET custom_name = p.canonical_name, product_id = NULL
       FROM product p WHERE p.id = ri.product_id AND ri.product_id = ANY($1)`,
      [aiProductIds],
    );
    console.log(`recipe_ingredient güncellendi (custom_name'e taşındı): ${ingredientCount}`);

    // 2) receipt_line_item referanslarını NULL'a çek (FK NULLABLE, CASCADE yok).
    await client.query(
      `UPDATE receipt_line_item SET resolved_inventory_item_id = NULL
       WHERE resolved_inventory_item_id IN (SELECT id FROM inventory_item WHERE product_id = ANY($1))`,
      [aiProductIds],
    );
    await client.query(
      `UPDATE receipt_line_item SET matched_product_id = NULL WHERE matched_product_id = ANY($1)`,
      [aiProductIds],
    );

    // 3) shopping_list_item: product_id'yi custom_name'e taşı (nullable + CHECK var).
    await client.query(
      `UPDATE shopping_list_item sli SET custom_name = p.canonical_name, product_id = NULL
       FROM product p WHERE p.id = sli.product_id AND sli.product_id = ANY($1)`,
      [aiProductIds],
    );

    // 4) stock_movement.product_id NULL'a çek (nullable, denormalize kolon).
    await client.query(`UPDATE stock_movement SET product_id = NULL WHERE product_id = ANY($1)`, [aiProductIds]);

    // 5) inventory_item satırlarını sil (stock_movement.inventory_item_id
    //    SET NULL'lu, güvenli; NOT NULL/CASCADE yok olduğu için product'tan
    //    önce silinmesi ZORUNLU).
    const { rowCount: invCount } = await client.query(
      `DELETE FROM inventory_item WHERE product_id = ANY($1)`,
      [aiProductIds],
    );
    console.log(`Silinen inventory_item: ${invCount}`);

    // 6) 'model' kaynaklı TÜM alias'ları sil (ai_generated'a bağlı olanlar
    //    zaten adım 7'de CASCADE ile giderdi ama başka bir ürüne yanlışlıkla
    //    eşleşmiş model alias'ları da temizleniyor). user_correction DOKUNULMAZ.
    const { rowCount: aliasCount } = await client.query(`DELETE FROM product_alias WHERE source = 'model'`);
    console.log(`Silinen 'model' kaynaklı alias: ${aliasCount}`);

    // 7) ürünleri sil (recipe_ingredient/receipt_line_item/inventory_item/
    //    stock_movement referansları adım 1-5'te temizlendi; product_alias
    //    kalanı CASCADE ile gider).
    const { rowCount: productCount } = await client.query(`DELETE FROM product WHERE source = 'ai_generated'`);
    console.log(`Silinen ai_generated ürün: ${productCount}`);

    // 8) Kalan user_correction alias'larını yeni normalizasyonla (OCR/homoglif
    //    dahil) yeniden hesapla — Faz 5 uyumu. Çakışma olursa (iki farklı
    //    normalized_text artık aynı anahtara düşerse) yüksek hit_count'lu
    //    kayıt kalsın, diğeri silinsin.
    const { rows: corrections } = await client.query(
      `SELECT id, raw_text, normalized_text, hit_count FROM product_alias WHERE source = 'user_correction'`,
    );
    let recalculated = 0;
    let mergedAway = 0;
    for (const row of corrections) {
      const newNormalized = normalizeAliasText(row.raw_text);
      if (newNormalized === row.normalized_text) continue;

      const { rows: conflict } = await client.query(
        `SELECT id, hit_count FROM product_alias
         WHERE household_id = (SELECT household_id FROM product_alias WHERE id = $1)
           AND normalized_text = $2 AND id != $1`,
        [row.id, newNormalized],
      );

      if (conflict.length > 0 && conflict[0].hit_count >= row.hit_count) {
        await client.query('DELETE FROM product_alias WHERE id = $1', [row.id]);
        mergedAway += 1;
      } else {
        if (conflict.length > 0) {
          await client.query('DELETE FROM product_alias WHERE id = $1', [conflict[0].id]);
        }
        await client.query('UPDATE product_alias SET normalized_text = $2 WHERE id = $1', [row.id, newNormalized]);
        recalculated += 1;
      }
    }
    console.log(`user_correction alias yeniden hesaplandı: ${recalculated}, çakışıp silinen: ${mergedAway}`);

    await client.query('COMMIT');
    console.log('Sıfırlama tamamlandı.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch((error) => {
  console.error('Sıfırlama başarısız:', error);
  process.exit(1);
});
