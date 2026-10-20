-- Adiciona colunas de dimensões/tamanhos/especificações visuais dos produtos
-- Estas colunas aparecem no catálogo (admin e público) abaixo do preço

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS dimensao TEXT;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS volume TEXT;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS comprimento TEXT;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cores JSONB DEFAULT '[]'::jsonb;
