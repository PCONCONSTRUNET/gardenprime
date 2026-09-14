-- Adicionar coluna asaas_customer_id na tabela de clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

-- Tabela de cobranças ASAAS
CREATE TABLE IF NOT EXISTS asaas_cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_id TEXT UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('BOLETO', 'PIX', 'CREDIT_CARD', 'UNDEFINED')),
  status TEXT DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'RECEIVED', 'CONFIRMED', 'OVERDUE',
    'REFUNDED', 'REFUND_REQUESTED', 'CHARGEBACK_REQUESTED', 'DELETED'
  )),
  valor NUMERIC(10,2) NOT NULL,
  vencimento DATE,
  descricao TEXT,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  venda_id UUID REFERENCES vendas(id) ON DELETE SET NULL,
  conta_receber_id UUID REFERENCES contas_receber(id) ON DELETE SET NULL,
  -- Dados do boleto
  link_boleto TEXT,
  codigo_barras TEXT,
  -- Dados do PIX
  pix_copia_cola TEXT,
  pix_imagem_url TEXT,
  -- Link da fatura (cartão e checkout geral)
  invoice_url TEXT,
  -- ID do cliente no ASAAS
  asaas_customer_id TEXT,
  -- Resposta bruta da API
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_asaas_cobrancas_venda_id ON asaas_cobrancas(venda_id);
CREATE INDEX IF NOT EXISTS idx_asaas_cobrancas_cliente_id ON asaas_cobrancas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_asaas_cobrancas_status ON asaas_cobrancas(status);
CREATE INDEX IF NOT EXISTS idx_asaas_cobrancas_conta_receber ON asaas_cobrancas(conta_receber_id);

-- RLS: permitir acesso autenticado
ALTER TABLE asaas_cobrancas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso autenticado asaas_cobrancas"
  ON asaas_cobrancas FOR ALL
  USING (auth.role() = 'authenticated');
