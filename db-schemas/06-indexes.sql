CREATE INDEX IF NOT EXISTS idx_household_member_user ON household_member (user_id);
CREATE INDEX IF NOT EXISTS idx_household_invite_household ON household_invite (household_id);

CREATE INDEX IF NOT EXISTS idx_product_household ON product (household_id);
CREATE INDEX IF NOT EXISTS idx_product_canonical_name_trgm ON product USING GIN (canonical_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_product_alias_household ON product_alias (household_id);
-- Eşleştirme normalized_text üzerinden yapılır (fiyat/KDV arındırılmış hali),
-- bu yüzden hem trigram hem unique index'ler o kolonda.
CREATE INDEX IF NOT EXISTS idx_product_alias_normalized_trgm
  ON product_alias USING GIN (normalized_text gin_trgm_ops);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_alias_household_normalized
  ON product_alias (household_id, normalized_text) WHERE household_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_alias_global_normalized
  ON product_alias (normalized_text) WHERE household_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_storage_location_household ON storage_location (household_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item_household ON inventory_item (household_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item_expires_at ON inventory_item (expires_at);
CREATE INDEX IF NOT EXISTS idx_stock_movement_household ON stock_movement (household_id);
CREATE INDEX IF NOT EXISTS idx_stock_movement_inventory_item ON stock_movement (inventory_item_id);

CREATE INDEX IF NOT EXISTS idx_receipt_scan_household ON receipt_scan (household_id);
CREATE INDEX IF NOT EXISTS idx_receipt_scan_status ON receipt_scan (status);
CREATE INDEX IF NOT EXISTS idx_receipt_line_item_scan ON receipt_line_item (receipt_scan_id);
CREATE INDEX IF NOT EXISTS idx_receipt_line_item_household ON receipt_line_item (household_id);

CREATE INDEX IF NOT EXISTS idx_recipe_household ON recipe (household_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_recipe ON recipe_ingredient (recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_product ON recipe_ingredient (product_id);
CREATE INDEX IF NOT EXISTS idx_recipe_cook_log_household ON recipe_cook_log (household_id);
