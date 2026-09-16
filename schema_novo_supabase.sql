-- ========================================================
-- SCHEMA EXPORTADO DO SURAVASOS PARA NOVA EMPRESA
-- Gerado em: 2026-09-14T12:24:24.916Z
-- ========================================================

-- 1. Habilitar extensões comuns
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================================
-- SEQUÊNCIAS (AUTO-INCREMENT)
-- ========================================================

CREATE SEQUENCE IF NOT EXISTS public."davs_numero_seq";
CREATE SEQUENCE IF NOT EXISTS public."vendas_numero_venda_seq";
CREATE SEQUENCE IF NOT EXISTS public."vendas_numero_seq";

-- --------------------------------------------------------
-- Tabela: asaas_cobrancas
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."asaas_cobrancas" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "asaas_id" TEXT,
  "tipo" TEXT NOT NULL,
  "status" TEXT DEFAULT 'PENDING'::text,
  "valor" NUMERIC NOT NULL,
  "vencimento" DATE,
  "descricao" TEXT,
  "cliente_id" UUID,
  "venda_id" UUID,
  "conta_receber_id" UUID,
  "link_boleto" TEXT,
  "codigo_barras" TEXT,
  "pix_copia_cola" TEXT,
  "pix_imagem_url" TEXT,
  "invoice_url" TEXT,
  "asaas_customer_id" TEXT,
  "raw_response" JSONB,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT "asaas_cobrancas_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: clientes
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."clientes" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "nome" TEXT NOT NULL,
  "cidade" TEXT,
  "telefone" TEXT,
  "limite_credito" NUMERIC DEFAULT 0,
  "status" TEXT DEFAULT 'Ativo'::text NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "ultima_compra" TIMESTAMP WITH TIME ZONE,
  "cpf_cnpj" TEXT,
  "endereco" TEXT,
  "uf" TEXT,
  "numero" TEXT,
  "bairro" TEXT,
  "cep" TEXT,
  "asaas_customer_id" TEXT,
  CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: compras
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."compras" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "fornecedor_id" UUID,
  "status" TEXT DEFAULT 'Pendente'::text NOT NULL,
  "valor_total" NUMERIC DEFAULT 0,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: compras_itens
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."compras_itens" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "compra_id" UUID,
  "produto_id" UUID,
  "quantidade" INTEGER DEFAULT 1 NOT NULL,
  "valor_unitario" NUMERIC NOT NULL,
  "subtotal" NUMERIC NOT NULL,
  CONSTRAINT "compras_itens_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: configuracoes
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."configuracoes" (
  "id" INTEGER DEFAULT 1 NOT NULL,
  "razao_social" TEXT,
  "cnpj" TEXT,
  "inscricao_estadual" TEXT,
  "regime_tributario" TEXT,
  "endereco" TEXT,
  "telefone" TEXT,
  "email_contato" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "configuracoes_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: contas_pagar
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."contas_pagar" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "compra_id" UUID,
  "fornecedor_id" UUID,
  "descricao" TEXT NOT NULL,
  "valor" NUMERIC NOT NULL,
  "vencimento" DATE NOT NULL,
  "data_pagamento" DATE,
  "status" TEXT DEFAULT 'Pendente'::text NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT "contas_pagar_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: contas_receber
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."contas_receber" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "venda_id" UUID,
  "cliente_id" UUID,
  "descricao" TEXT NOT NULL,
  "valor" NUMERIC NOT NULL,
  "vencimento" DATE NOT NULL,
  "data_pagamento" DATE,
  "status" TEXT DEFAULT 'Pendente'::text NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT "contas_receber_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: dav_items
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."dav_items" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "dav_id" UUID NOT NULL,
  "codigo" TEXT,
  "produto" TEXT NOT NULL,
  "qtd" INTEGER DEFAULT 1 NOT NULL,
  "valor_unitario" NUMERIC DEFAULT 0 NOT NULL,
  "total" NUMERIC DEFAULT 0 NOT NULL,
  "produto_id" UUID,
  CONSTRAINT "dav_items_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: davs
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."davs" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "numero" INTEGER DEFAULT nextval('davs_numero_seq'::regclass) NOT NULL,
  "emissao" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "validade" TIMESTAMP WITH TIME ZONE NOT NULL,
  "cliente_nome" TEXT NOT NULL,
  "cliente_cnpj" TEXT,
  "cliente_endereco" TEXT,
  "cliente_telefone" TEXT,
  "vendedor" TEXT,
  "condicao_pagamento" TEXT,
  "frete_tipo" TEXT,
  "prazo_entrega" TEXT,
  "subtotal" NUMERIC DEFAULT 0 NOT NULL,
  "desconto_percentual" NUMERIC DEFAULT 0,
  "desconto_valor" NUMERIC DEFAULT 0,
  "frete_valor" NUMERIC DEFAULT 0,
  "total" NUMERIC DEFAULT 0 NOT NULL,
  "observacoes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  "emissor_nome" TEXT,
  "emissor_cnpj" TEXT,
  "emissor_endereco" TEXT,
  "emissor_telefone" TEXT,
  "cliente_id" UUID,
  "status" TEXT DEFAULT 'Aberto'::text,
  CONSTRAINT "davs_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: entregas
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."entregas" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "venda_id" UUID,
  "motorista" TEXT,
  "placa" TEXT,
  "status" TEXT DEFAULT 'Pendente'::text NOT NULL,
  "previsao" DATE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT "entregas_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: fornecedores
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."fornecedores" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "empresa" TEXT NOT NULL,
  "contato" TEXT,
  "cidade" TEXT,
  "valor_total" NUMERIC DEFAULT 0,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "ultima_compra" TIMESTAMP WITH TIME ZONE,
  "telefone" TEXT,
  "cpf_cnpj" TEXT,
  "endereco" TEXT,
  CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: movimentacoes_estoque
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."movimentacoes_estoque" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "produto_id" UUID,
  "tipo" VARCHAR(50) NOT NULL,
  "quantidade" NUMERIC NOT NULL,
  "motivo" VARCHAR(255),
  "usuario" VARCHAR(100) DEFAULT 'Sistema'::character varying,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT "movimentacoes_estoque_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: notas_fiscais
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."notas_fiscais" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "venda_id" UUID,
  "numero" TEXT,
  "chave_acesso" TEXT,
  "status" TEXT DEFAULT 'Emitida'::text NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "brasilnfe_id" BIGINT,
  "cod_lote" TEXT,
  "numero_protocolo" TEXT,
  "tipo_ambiente" INTEGER DEFAULT 2,
  "cod_status" INTEGER,
  "ds_status" TEXT,
  "xml_base64" TEXT,
  "pdf_base64" TEXT,
  "error_message" TEXT,
  "payload_enviado" JSONB,
  "natureza_operacao" TEXT DEFAULT 'Venda de mercadoria'::text,
  "emitida_em" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT "notas_fiscais_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: notificacoes
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."notificacoes" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "tipo" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "mensagem" TEXT NOT NULL,
  "lida" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: parceiro_precos
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."parceiro_precos" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "vendedor_id" UUID NOT NULL,
  "produto_id" UUID NOT NULL,
  "preco_personalizado" NUMERIC NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT "parceiro_precos_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: produtos
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."produtos" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "codigo" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "categoria" TEXT,
  "estoque" INTEGER DEFAULT 0 NOT NULL,
  "valor" NUMERIC DEFAULT 0 NOT NULL,
  "status" TEXT DEFAULT 'Ativo'::text NOT NULL,
  "emoji" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "imagem" TEXT,
  "numero" TEXT,
  "dimensao" TEXT,
  "volume" TEXT,
  "comprimento" TEXT,
  "cores" JSONB DEFAULT '[]'::jsonb,
  "ncm" TEXT,
  "quantidade_vendas" INTEGER DEFAULT 0,
  CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: rotas
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."rotas" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "motorista" TEXT NOT NULL,
  "veiculo" TEXT NOT NULL,
  "status" TEXT DEFAULT 'Em Transporte'::text,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT "rotas_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: usuarios
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."usuarios" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "nome" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "funcao" TEXT DEFAULT 'Visualizador'::text NOT NULL,
  "cor" TEXT DEFAULT 'bg-secondary text-foreground'::text,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: vendas
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."vendas" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "cliente_id" UUID,
  "tipo" TEXT DEFAULT 'VENDA'::text NOT NULL,
  "status" TEXT DEFAULT 'Aguardando Pagamento'::text NOT NULL,
  "valor_total" NUMERIC DEFAULT 0,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "rota_id" UUID,
  "vendedor_id" UUID,
  "status_aprovacao" TEXT DEFAULT 'Aprovada'::text,
  "valor_comissao" NUMERIC DEFAULT 0,
  "status_pagamento_comissao" TEXT DEFAULT 'Pendente'::text,
  "numero_venda" INTEGER DEFAULT nextval('vendas_numero_venda_seq'::regclass) NOT NULL,
  "numero" INTEGER DEFAULT nextval('vendas_numero_seq'::regclass) NOT NULL,
  "metodo_pagamento" TEXT,
  "condicao_pagamento" TEXT,
  "desconto_valor" NUMERIC DEFAULT 0,
  "desconto_percentual" NUMERIC DEFAULT 0,
  "subtotal" NUMERIC DEFAULT 0,
  "frete_valor" NUMERIC DEFAULT 0,
  CONSTRAINT "vendas_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: vendas_itens
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."vendas_itens" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "venda_id" UUID,
  "produto_id" UUID,
  "quantidade" INTEGER DEFAULT 1 NOT NULL,
  "valor_unitario" NUMERIC NOT NULL,
  "subtotal" NUMERIC NOT NULL,
  CONSTRAINT "vendas_itens_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: vendedores
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."vendedores" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "user_id" UUID,
  "nome" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "telefone" TEXT,
  "tipo_comissao" TEXT DEFAULT 'porcentagem'::text NOT NULL,
  "valor_comissao" NUMERIC DEFAULT 0 NOT NULL,
  "status" TEXT DEFAULT 'Ativo'::text,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  "acrescimo_catalogo" BOOLEAN DEFAULT false,
  "acrescimo_catalogo_percentual" NUMERIC DEFAULT 20,
  "avatar_url" TEXT,
  CONSTRAINT "vendedores_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------
-- Tabela: webhook_deliveries
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."webhook_deliveries" (
  "id" UUID DEFAULT gen_random_uuid() NOT NULL,
  "delivery_id" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "attempt" INTEGER DEFAULT 1,
  "payload" JSONB,
  "processado_em" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- ========================================================
-- FOREIGN KEYS
-- ========================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asaas_cobrancas_conta_receber_id_fkey') THEN
    ALTER TABLE public."asaas_cobrancas"
      ADD CONSTRAINT "asaas_cobrancas_conta_receber_id_fkey"
      FOREIGN KEY ("conta_receber_id")
      REFERENCES public."contas_receber" ("id")
      ON DELETE SET NULL
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asaas_cobrancas_venda_id_fkey') THEN
    ALTER TABLE public."asaas_cobrancas"
      ADD CONSTRAINT "asaas_cobrancas_venda_id_fkey"
      FOREIGN KEY ("venda_id")
      REFERENCES public."vendas" ("id")
      ON DELETE SET NULL
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asaas_cobrancas_cliente_id_fkey') THEN
    ALTER TABLE public."asaas_cobrancas"
      ADD CONSTRAINT "asaas_cobrancas_cliente_id_fkey"
      FOREIGN KEY ("cliente_id")
      REFERENCES public."clientes" ("id")
      ON DELETE SET NULL
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compras_fornecedor_id_fkey') THEN
    ALTER TABLE public."compras"
      ADD CONSTRAINT "compras_fornecedor_id_fkey"
      FOREIGN KEY ("fornecedor_id")
      REFERENCES public."fornecedores" ("id")
      ON DELETE SET NULL
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compras_itens_produto_id_fkey') THEN
    ALTER TABLE public."compras_itens"
      ADD CONSTRAINT "compras_itens_produto_id_fkey"
      FOREIGN KEY ("produto_id")
      REFERENCES public."produtos" ("id")
      ON DELETE RESTRICT
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compras_itens_compra_id_fkey') THEN
    ALTER TABLE public."compras_itens"
      ADD CONSTRAINT "compras_itens_compra_id_fkey"
      FOREIGN KEY ("compra_id")
      REFERENCES public."compras" ("id")
      ON DELETE CASCADE
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contas_pagar_compra_id_fkey') THEN
    ALTER TABLE public."contas_pagar"
      ADD CONSTRAINT "contas_pagar_compra_id_fkey"
      FOREIGN KEY ("compra_id")
      REFERENCES public."compras" ("id")
      ON DELETE CASCADE
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contas_pagar_fornecedor_id_fkey') THEN
    ALTER TABLE public."contas_pagar"
      ADD CONSTRAINT "contas_pagar_fornecedor_id_fkey"
      FOREIGN KEY ("fornecedor_id")
      REFERENCES public."fornecedores" ("id")
      ON DELETE SET NULL
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contas_receber_cliente_id_fkey') THEN
    ALTER TABLE public."contas_receber"
      ADD CONSTRAINT "contas_receber_cliente_id_fkey"
      FOREIGN KEY ("cliente_id")
      REFERENCES public."clientes" ("id")
      ON DELETE SET NULL
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contas_receber_venda_id_fkey') THEN
    ALTER TABLE public."contas_receber"
      ADD CONSTRAINT "contas_receber_venda_id_fkey"
      FOREIGN KEY ("venda_id")
      REFERENCES public."vendas" ("id")
      ON DELETE CASCADE
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dav_items_dav_id_fkey') THEN
    ALTER TABLE public."dav_items"
      ADD CONSTRAINT "dav_items_dav_id_fkey"
      FOREIGN KEY ("dav_id")
      REFERENCES public."davs" ("id")
      ON DELETE CASCADE
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dav_items_produto_id_fkey') THEN
    ALTER TABLE public."dav_items"
      ADD CONSTRAINT "dav_items_produto_id_fkey"
      FOREIGN KEY ("produto_id")
      REFERENCES public."produtos" ("id")
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'davs_cliente_id_fkey') THEN
    ALTER TABLE public."davs"
      ADD CONSTRAINT "davs_cliente_id_fkey"
      FOREIGN KEY ("cliente_id")
      REFERENCES public."clientes" ("id")
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entregas_venda_id_fkey') THEN
    ALTER TABLE public."entregas"
      ADD CONSTRAINT "entregas_venda_id_fkey"
      FOREIGN KEY ("venda_id")
      REFERENCES public."vendas" ("id")
      ON DELETE CASCADE
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'movimentacoes_estoque_produto_id_fkey') THEN
    ALTER TABLE public."movimentacoes_estoque"
      ADD CONSTRAINT "movimentacoes_estoque_produto_id_fkey"
      FOREIGN KEY ("produto_id")
      REFERENCES public."produtos" ("id")
      ON DELETE CASCADE
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notas_fiscais_venda_id_fkey') THEN
    ALTER TABLE public."notas_fiscais"
      ADD CONSTRAINT "notas_fiscais_venda_id_fkey"
      FOREIGN KEY ("venda_id")
      REFERENCES public."vendas" ("id")
      ON DELETE CASCADE
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parceiro_precos_produto_id_fkey') THEN
    ALTER TABLE public."parceiro_precos"
      ADD CONSTRAINT "parceiro_precos_produto_id_fkey"
      FOREIGN KEY ("produto_id")
      REFERENCES public."produtos" ("id")
      ON DELETE CASCADE
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parceiro_precos_vendedor_id_fkey') THEN
    ALTER TABLE public."parceiro_precos"
      ADD CONSTRAINT "parceiro_precos_vendedor_id_fkey"
      FOREIGN KEY ("vendedor_id")
      REFERENCES public."vendedores" ("id")
      ON DELETE CASCADE
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendas_vendedor_id_fkey') THEN
    ALTER TABLE public."vendas"
      ADD CONSTRAINT "vendas_vendedor_id_fkey"
      FOREIGN KEY ("vendedor_id")
      REFERENCES public."vendedores" ("id")
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendas_cliente_id_fkey') THEN
    ALTER TABLE public."vendas"
      ADD CONSTRAINT "vendas_cliente_id_fkey"
      FOREIGN KEY ("cliente_id")
      REFERENCES public."clientes" ("id")
      ON DELETE SET NULL
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendas_rota_id_fkey') THEN
    ALTER TABLE public."vendas"
      ADD CONSTRAINT "vendas_rota_id_fkey"
      FOREIGN KEY ("rota_id")
      REFERENCES public."rotas" ("id")
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendas_itens_produto_id_fkey') THEN
    ALTER TABLE public."vendas_itens"
      ADD CONSTRAINT "vendas_itens_produto_id_fkey"
      FOREIGN KEY ("produto_id")
      REFERENCES public."produtos" ("id")
      ON DELETE RESTRICT
;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendas_itens_venda_id_fkey') THEN
    ALTER TABLE public."vendas_itens"
      ADD CONSTRAINT "vendas_itens_venda_id_fkey"
      FOREIGN KEY ("venda_id")
      REFERENCES public."vendas" ("id")
      ON DELETE CASCADE
;
  END IF;
END $$;

-- ========================================================
-- ÍNDICES
-- ========================================================

CREATE UNIQUE INDEX asaas_cobrancas_asaas_id_key ON public.asaas_cobrancas USING btree (asaas_id);
CREATE INDEX idx_asaas_cobrancas_cliente_id ON public.asaas_cobrancas USING btree (cliente_id);
CREATE INDEX idx_asaas_cobrancas_conta_receber ON public.asaas_cobrancas USING btree (conta_receber_id);
CREATE INDEX idx_asaas_cobrancas_status ON public.asaas_cobrancas USING btree (status);
CREATE INDEX idx_asaas_cobrancas_venda_id ON public.asaas_cobrancas USING btree (venda_id);
CREATE INDEX idx_notas_fiscais_brasilnfe_id ON public.notas_fiscais USING btree (brasilnfe_id);
CREATE INDEX idx_notas_fiscais_chave_acesso ON public.notas_fiscais USING btree (chave_acesso);
CREATE UNIQUE INDEX parceiro_precos_vendedor_id_produto_id_key ON public.parceiro_precos USING btree (vendedor_id, produto_id);
CREATE UNIQUE INDEX produtos_codigo_key ON public.produtos USING btree (codigo);
CREATE UNIQUE INDEX usuarios_email_key ON public.usuarios USING btree (email);
CREATE UNIQUE INDEX vendedores_email_key ON public.vendedores USING btree (email);
CREATE INDEX idx_webhook_deliveries_delivery_id ON public.webhook_deliveries USING btree (delivery_id);
CREATE INDEX idx_webhook_deliveries_event ON public.webhook_deliveries USING btree (event);
CREATE UNIQUE INDEX webhook_deliveries_delivery_id_key ON public.webhook_deliveries USING btree (delivery_id);

-- ========================================================
-- FUNÇÕES
-- ========================================================

CREATE OR REPLACE FUNCTION public.excluir_vendedor_e_usuario(p_vendedor_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_user_id UUID;
BEGIN
    -- 1. Pega o user_id associado ao vendedor
    SELECT user_id INTO v_user_id FROM public.vendedores WHERE id = p_vendedor_id;

    -- 2. Desvincula o vendedor das vendas para não dar erro e preservar o caixa
    UPDATE public.vendas SET vendedor_id = NULL WHERE vendedor_id = p_vendedor_id;

    -- 3. Exclui o vendedor da tabela public.vendedores
    DELETE FROM public.vendedores WHERE id = p_vendedor_id;

    -- 4. Exclui o usuário da tabela auth.users (apagando o email/senha permanentemente)
    IF v_user_id IS NOT NULL THEN
        DELETE FROM auth.users WHERE id = v_user_id;
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_vendedor_and_user(p_vendedor_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  -- 1. Pega o user_id (id de login) atrelado ao vendedor
  SELECT user_id INTO v_user_id FROM public.vendedores WHERE id = p_vendedor_id;
  
  -- 2. Deleta o vendedor da tabela pública (isso remove ele da lista)
  DELETE FROM public.vendedores WHERE id = p_vendedor_id;
  
  -- 3. Deleta o usuário da tabela de autenticação (libera o email para novo cadastro)
  IF v_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_user_id;
  END IF;
END;
$function$
;

-- ========================================================
-- RLS E PERMISSÕES
-- ========================================================

ALTER TABLE public."asaas_cobrancas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em asaas_cobrancas" ON public."asaas_cobrancas";
CREATE POLICY "Permitir tudo publico em asaas_cobrancas" ON public."asaas_cobrancas" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."clientes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em clientes" ON public."clientes";
CREATE POLICY "Permitir tudo publico em clientes" ON public."clientes" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."compras" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em compras" ON public."compras";
CREATE POLICY "Permitir tudo publico em compras" ON public."compras" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."compras_itens" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em compras_itens" ON public."compras_itens";
CREATE POLICY "Permitir tudo publico em compras_itens" ON public."compras_itens" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."configuracoes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em configuracoes" ON public."configuracoes";
CREATE POLICY "Permitir tudo publico em configuracoes" ON public."configuracoes" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."contas_pagar" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em contas_pagar" ON public."contas_pagar";
CREATE POLICY "Permitir tudo publico em contas_pagar" ON public."contas_pagar" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."contas_receber" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em contas_receber" ON public."contas_receber";
CREATE POLICY "Permitir tudo publico em contas_receber" ON public."contas_receber" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."dav_items" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em dav_items" ON public."dav_items";
CREATE POLICY "Permitir tudo publico em dav_items" ON public."dav_items" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."davs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em davs" ON public."davs";
CREATE POLICY "Permitir tudo publico em davs" ON public."davs" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."entregas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em entregas" ON public."entregas";
CREATE POLICY "Permitir tudo publico em entregas" ON public."entregas" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."fornecedores" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em fornecedores" ON public."fornecedores";
CREATE POLICY "Permitir tudo publico em fornecedores" ON public."fornecedores" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."movimentacoes_estoque" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em movimentacoes_estoque" ON public."movimentacoes_estoque";
CREATE POLICY "Permitir tudo publico em movimentacoes_estoque" ON public."movimentacoes_estoque" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."notas_fiscais" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em notas_fiscais" ON public."notas_fiscais";
CREATE POLICY "Permitir tudo publico em notas_fiscais" ON public."notas_fiscais" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."notificacoes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em notificacoes" ON public."notificacoes";
CREATE POLICY "Permitir tudo publico em notificacoes" ON public."notificacoes" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."parceiro_precos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em parceiro_precos" ON public."parceiro_precos";
CREATE POLICY "Permitir tudo publico em parceiro_precos" ON public."parceiro_precos" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."produtos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em produtos" ON public."produtos";
CREATE POLICY "Permitir tudo publico em produtos" ON public."produtos" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."rotas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em rotas" ON public."rotas";
CREATE POLICY "Permitir tudo publico em rotas" ON public."rotas" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."usuarios" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em usuarios" ON public."usuarios";
CREATE POLICY "Permitir tudo publico em usuarios" ON public."usuarios" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."vendas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em vendas" ON public."vendas";
CREATE POLICY "Permitir tudo publico em vendas" ON public."vendas" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."vendas_itens" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em vendas_itens" ON public."vendas_itens";
CREATE POLICY "Permitir tudo publico em vendas_itens" ON public."vendas_itens" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."vendedores" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em vendedores" ON public."vendedores";
CREATE POLICY "Permitir tudo publico em vendedores" ON public."vendedores" FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public."webhook_deliveries" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo publico em webhook_deliveries" ON public."webhook_deliveries";
CREATE POLICY "Permitir tudo publico em webhook_deliveries" ON public."webhook_deliveries" FOR ALL USING (true) WITH CHECK (true);
