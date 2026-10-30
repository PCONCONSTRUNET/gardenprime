const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:Lucasduda28123@db.mpbmssohpjwijkyhtucm.supabase.co:5432/postgres';
const supabaseUrl = 'https://mpbmssohpjwijkyhtucm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wYm1zc29ocGp3aWpreWh0dWNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NDg4MjEsImV4cCI6MjA5NzMyNDgyMX0.TP7OfhgKzLlAJSvdXirT-rcW6K-Qka2Cs7uo7P-FmgU';

const pgClient = new Client({ connectionString });
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function migrate() {
  console.log('--- INICIANDO MIGRAÇÃO DE IMAGENS BASE64 PARA STORAGE ---');
  await pgClient.connect();
  console.log('✓ Conectado ao banco de dados PostgreSQL');

  // 1. Buscar todos os produtos que possuem imagem
  const res = await pgClient.query("SELECT id, codigo, nome, imagem FROM produtos WHERE imagem IS NOT NULL AND imagem != ''");
  console.log(`✓ Total de produtos com imagem encontrados: ${res.rows.length}`);

  const toMigrate = res.rows.filter(r => r.imagem && !r.imagem.startsWith('http'));
  console.log(`✓ Produtos com imagem em Base64 a serem migrados: ${toMigrate.length}`);

  if (toMigrate.length === 0) {
    console.log('Nenhum produto precisa de migração.');
    await pgClient.end();
    return;
  }

  // 2. Salvar backup de segurança local antes de qualquer alteração
  const backupPath = path.join(__dirname, 'backup_imagens_produtos.json');
  console.log(`Salvando backup de segurança em: ${backupPath}...`);
  fs.writeFileSync(backupPath, JSON.stringify(toMigrate, null, 2), 'utf8');
  console.log(`✓ Backup de ${toMigrate.length} imagens salvo com sucesso!`);

  let sucessos = 0;
  let erros = 0;

  for (let i = 0; i < toMigrate.length; i++) {
    const item = toMigrate[i];
    const indexStr = `[${i + 1}/${toMigrate.length}]`;

    try {
      let mime = 'image/png';
      let ext = 'png';
      let base64Data = item.imagem;

      if (item.imagem.startsWith('data:')) {
        const parts = item.imagem.split(';base64,');
        const header = parts[0];
        base64Data = parts[1];
        const mimeMatch = header.match(/^data:(image\/[a-zA-Z0-9.+]+)/);
        if (mimeMatch) {
          mime = mimeMatch[1];
          if (mime === 'image/jpeg') ext = 'jpg';
          else if (mime === 'image/webp') ext = 'webp';
          else if (mime === 'image/gif') ext = 'gif';
          else ext = 'png';
        }
      }

      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = `prod_${item.id}.${ext}`;

      // Upload para o Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('produtos')
        .upload(fileName, buffer, {
          contentType: mime,
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Erro no upload storage: ${uploadError.message}`);
      }

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('produtos')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // Atualizar o registro do produto com a nova URL
      await pgClient.query('UPDATE produtos SET imagem = $1 WHERE id = $2', [publicUrl, item.id]);

      sucessos++;
      if ((i + 1) % 25 === 0 || i === toMigrate.length - 1) {
        console.log(`${indexStr} Progresso: ${sucessos} imagens migradas com sucesso...`);
      }
    } catch (err) {
      erros++;
      console.error(`${indexStr} ❌ Falha no produto ID ${item.id} (${item.nome}):`, err.message);
    }
  }

  console.log('\n--- MIGRAÇÃO CONCLUÍDA ---');
  console.log(`✓ Sucessos: ${sucessos}`);
  console.log(`❌ Erros: ${erros}`);

  await pgClient.end();
}

migrate().catch(err => {
  console.error('Erro fatal na migração:', err);
  process.exit(1);
});

