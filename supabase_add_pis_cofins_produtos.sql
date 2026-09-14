-- Adiciona colunas para PIS e COFINS na tabela de produtos
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cst_pis TEXT;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cst_cofins TEXT;
