-- Entrega (envio confirmado, alcance, programa), proteção ao comprador e categoria "kit"
ALTER TABLE offers ADD COLUMN IF NOT EXISTS ship_available BOOLEAN;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS ship_scope TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS ship_program TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS protection TEXT;
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_category_check;
ALTER TABLE offers ADD CONSTRAINT offers_category_check CHECK (category IN ('pc','monitor','kit'));
