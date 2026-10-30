-- Adiciona coluna vencimentos nas tabelas vendas e davs
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS vencimentos jsonb;
ALTER TABLE davs ADD COLUMN IF NOT EXISTS vencimentos jsonb;
