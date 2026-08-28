-- Alan (household) tipine göre hangi özelliklerin (tarifler, AI Chef) açık
-- olduğunu tutar. Boş '{}' = kullanıcı hiç karar vermedi, tür varsayılanına
-- düşülür (domain/household-profile.js resolveFeatures) — backfill gerekmez,
-- suggestedStorageKind kararıyla (2026-08-17) aynı felsefe: değer okuma
-- anında hesaplanır.
ALTER TABLE household ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}'::jsonb;
