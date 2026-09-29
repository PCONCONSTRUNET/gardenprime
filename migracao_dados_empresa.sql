-- Arquivo SQL gerado para criar as novas colunas na tabela configuracoes

ALTER TABLE configuracoes
ADD COLUMN IF NOT EXISTS nome_fantasia text,
ADD COLUMN IF NOT EXISTS responsavel text,
ADD COLUMN IF NOT EXISTS cep text,
ADD COLUMN IF NOT EXISTS tipo_logradouro text,
ADD COLUMN IF NOT EXISTS numero text,
ADD COLUMN IF NOT EXISTS complemento text,
ADD COLUMN IF NOT EXISTS bairro text,
ADD COLUMN IF NOT EXISTS uf text,
ADD COLUMN IF NOT EXISTS municipio text,
ADD COLUMN IF NOT EXISTS fax text,
ADD COLUMN IF NOT EXISTS celular text,
ADD COLUMN IF NOT EXISTS inscricao_municipal text,
ADD COLUMN IF NOT EXISTS site text,
ADD COLUMN IF NOT EXISTS ramo_atividade text,
ADD COLUMN IF NOT EXISTS cnae text,
ADD COLUMN IF NOT EXISTS compra_sistema text,
ADD COLUMN IF NOT EXISTS optante_simples_nacional boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS codigo_regime_tributario text;
