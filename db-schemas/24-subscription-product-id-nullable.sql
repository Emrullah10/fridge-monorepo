-- product_id her RevenueCat event'inde gelmiyor (ör. bazı CANCELLATION/
-- EXPIRATION payload'larında boş kalabiliyor) — NOT NULL kısıtı webhook'u
-- 500'e düşürüyordu (bkz. buglog, curl ile bulundu). COALESCE ile upsert
-- yapıldığı için (subscription.repository.js) mevcut satırın product_id'si
-- korunur, bu kısıt artık gereksiz+yanlış.
ALTER TABLE subscription ALTER COLUMN product_id DROP NOT NULL;
