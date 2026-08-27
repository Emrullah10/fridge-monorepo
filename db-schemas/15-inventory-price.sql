-- Para & israf paneli için fiyat takibi.
--
-- Frantry'nin "bu ay X TL kurtardın / Y TL çöpe gitti" kancasının karşılığı.
-- Fiş satırındaki fiyat (receipt_line_item.parsed_price) zaten okunuyordu ama
-- onay sırasında envantere hiç taşınmıyordu — bu iki kolon o boşluğu kapatır.
--
-- migrate.js tracking tablosu kullanmıyor, her deploy tüm .sql'leri yeniden
-- çalıştırıyor → ADD COLUMN IF NOT EXISTS zorunlu (cerebrum kuralı).

-- inventory_item: kalemin GÜNCEL ağırlıklı ortalama birim fiyatı. Aynı ürün
-- farklı fişte farklı fiyata alınıp aynı satıra eklenince ağırlıklı ortalama
-- ile güncellenir (bkz. inventory-item.repository.js upsertQuantity).
ALTER TABLE inventory_item ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2);

-- stock_movement: hareket ANINDAKİ birim fiyat snapshot'ı. 12-stock-movement-product.sql
-- ile aynı gerekçe — inventory_item_id FK'si ON DELETE SET NULL, kalem silinince
-- fiyat kaybolursa geçmiş analitik geriye dönük üretilemez. product_id nasıl
-- denormalize edildiyse unit_price de hareket anında yazılır (o günkü fiyat
-- doğru olan; ürün bugün pahalanmış olabilir).
ALTER TABLE stock_movement ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2);
