-- Histórico de lotes de pedidos importados e relatórios gerados na tela "Vendas Produtos".
-- Rode este script no SQL Editor do Supabase para o histórico ficar salvo na nuvem
-- (compartilhado entre computadores). Sem a tabela, o sistema salva apenas no navegador.

CREATE TABLE IF NOT EXISTS public.historico_vendas_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('lote', 'relatorio')),
  titulo TEXT NOT NULL,
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historico_vendas_produtos_created_at
  ON public.historico_vendas_produtos (created_at DESC);

ALTER TABLE public.historico_vendas_produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo publico em historico_vendas_produtos" ON public.historico_vendas_produtos;
CREATE POLICY "Permitir tudo publico em historico_vendas_produtos"
  ON public.historico_vendas_produtos FOR ALL USING (true) WITH CHECK (true);
