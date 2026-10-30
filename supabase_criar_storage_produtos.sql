-- 1. Criar o bucket público "produtos" se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'produtos',
  'produtos',
  true,
  10485760, -- 10MB limite por imagem
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Permitir leitura pública para qualquer um visualizar as fotos
DROP POLICY IF EXISTS "Public Read Produtos" ON storage.objects;
CREATE POLICY "Public Read Produtos"
ON storage.objects FOR SELECT
USING (bucket_id = 'produtos');

-- 3. Permitir upload de fotos (anon e autenticado)
DROP POLICY IF EXISTS "Public Upload Produtos" ON storage.objects;
CREATE POLICY "Public Upload Produtos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'produtos');

-- 4. Permitir atualização de fotos existentes
DROP POLICY IF EXISTS "Public Update Produtos" ON storage.objects;
CREATE POLICY "Public Update Produtos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'produtos');

