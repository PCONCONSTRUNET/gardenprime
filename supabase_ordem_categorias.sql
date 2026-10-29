-- Adiciona coluna ordem_categorias na tabela configuracoes para armazenar a ordenação manual das categorias definida pelo Admin
ALTER TABLE public.configuracoes
ADD COLUMN IF NOT EXISTS ordem_categorias jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.configuracoes.ordem_categorias IS 'Lista ordenada (JSON array) dos nomes das categorias para ordenação geral no catálogo e sistema';
