-- Para & israf paneli (insights.repository.js) dört sorgunun HEPSİNDE
-- `WHERE household_id = $1 AND created_at >= $2 AND created_at < $3`
-- kullanıyor. Eskiden yalnız `idx_stock_movement_household (household_id)`
-- vardı — household başına hareket sayısı arttıkça bu, `created_at`
-- aralığını filtre olarak eleyen bir tam tarama demekti. Bileşik index bu
-- predicate'i doğrudan karşılıyor.
CREATE INDEX IF NOT EXISTS idx_stock_movement_household_created
  ON stock_movement (household_id, created_at);
