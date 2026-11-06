-- Garimpo: estado de conservação (6 classes), tipo de vendedor, retirada presencial
ALTER TABLE offers ADD COLUMN IF NOT EXISTS seller_type TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS pickup BOOLEAN;
UPDATE offers SET condition = CASE condition WHEN 'new' THEN 'novo' WHEN 'used' THEN 'usado' WHEN 'refurbished' THEN 'mostruario' ELSE condition END;
CREATE INDEX IF NOT EXISTS offers_condition_idx ON offers (category, condition);
CREATE INDEX IF NOT EXISTS offers_first_seen_idx ON offers (first_seen_at DESC);
