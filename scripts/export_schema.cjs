const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:Lucasduda28123@db.mpbmssohpjwijkyhtucm.supabase.co:5432/postgres';

async function exportSchema() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('Conectado ao Supabase! Extraindo schema...');

  let sqlOutput = `-- ========================================================\n`;
  sqlOutput += `-- SCHEMA EXPORTADO DO SURAVASOS PARA NOVA EMPRESA\n`;
  sqlOutput += `-- Gerado em: ${new Date().toISOString()}\n`;
  sqlOutput += `-- ========================================================\n\n`;

  sqlOutput += `-- 1. Habilitar extensões comuns\n`;
  sqlOutput += `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n`;
  sqlOutput += `CREATE EXTENSION IF NOT EXISTS "pgcrypto";\n\n`;

  // 1.1 Criar Sequências (Sequences)
  console.log('Extraindo Sequências...');
  sqlOutput += `-- ========================================================\n`;
  sqlOutput += `-- SEQUÊNCIAS (AUTO-INCREMENT)\n`;
  sqlOutput += `-- ========================================================\n\n`;

  const seqRes = await client.query(`
    SELECT sequence_name 
    FROM information_schema.sequences 
    WHERE sequence_schema = 'public';
  `);

  for (const seq of seqRes.rows) {
    sqlOutput += `CREATE SEQUENCE IF NOT EXISTS public."${seq.sequence_name}";\n`;
  }
  sqlOutput += `\n`;

  // 2. Obter Tabelas
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const tables = tablesRes.rows.map(r => r.table_name);

  // 3. Extrair definições das colunas para cada tabela
  for (const table of tables) {
    console.log(`Extraindo tabela: ${table}`);
    sqlOutput += `-- --------------------------------------------------------\n`;
    sqlOutput += `-- Tabela: ${table}\n`;
    sqlOutput += `-- --------------------------------------------------------\n`;
    sqlOutput += `CREATE TABLE IF NOT EXISTS public."${table}" (\n`;

    const colsRes = await client.query(`
      SELECT 
        column_name,
        data_type,
        udt_name,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [table]);

    // Primary keys
    const pkRes = await client.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1;
    `, [table]);

    const pks = pkRes.rows.map(r => `"${r.column_name}"`);

    const colDefinitions = colsRes.rows.map(c => {
      let type = c.data_type.toUpperCase();
      if (type === 'USER-DEFINED') {
        type = c.udt_name;
      } else if (type === 'CHARACTER VARYING') {
        type = c.character_maximum_length ? `VARCHAR(${c.character_maximum_length})` : 'VARCHAR';
      } else if (type === 'ARRAY') {
        type = `${c.udt_name.replace(/^_/, '')}[]`;
      }

      let def = `  "${c.column_name}" ${type}`;
      if (c.column_default !== null) {
        def += ` DEFAULT ${c.column_default}`;
      }
      if (c.is_nullable === 'NO') {
        def += ` NOT NULL`;
      }
      return def;
    });

    if (pks.length > 0) {
      colDefinitions.push(`  CONSTRAINT "${table}_pkey" PRIMARY KEY (${pks.join(', ')})`);
    }

    sqlOutput += colDefinitions.join(',\n');
    sqlOutput += `\n);\n\n`;
  }

  // 4. Foreign Keys (adicionadas via ALTER TABLE para evitar problemas de ordem de criação)
  console.log('Extraindo Foreign Keys...');
  sqlOutput += `-- ========================================================\n`;
  sqlOutput += `-- FOREIGN KEYS\n`;
  sqlOutput += `-- ========================================================\n\n`;

  const fkRes = await client.query(`
    SELECT
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule,
      rc.update_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name;
  `);

  for (const fk of fkRes.rows) {
    sqlOutput += `DO $$ BEGIN\n`;
    sqlOutput += `  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${fk.constraint_name}') THEN\n`;
    sqlOutput += `    ALTER TABLE public."${fk.table_name}"\n`;
    sqlOutput += `      ADD CONSTRAINT "${fk.constraint_name}"\n`;
    sqlOutput += `      FOREIGN KEY ("${fk.column_name}")\n`;
    sqlOutput += `      REFERENCES ${fk.foreign_table_schema}."${fk.foreign_table_name}" ("${fk.foreign_column_name}")\n`;
    if (fk.delete_rule && fk.delete_rule !== 'NO ACTION') {
      sqlOutput += `      ON DELETE ${fk.delete_rule}\n`;
    }
    if (fk.update_rule && fk.update_rule !== 'NO ACTION') {
      sqlOutput += `      ON UPDATE ${fk.update_rule}\n`;
    }
    sqlOutput += `;\n`;
    sqlOutput += `  END IF;\n`;
    sqlOutput += `END $$;\n\n`;
  }

  // 5. Índices (não PK)
  console.log('Extraindo Índices...');
  sqlOutput += `-- ========================================================\n`;
  sqlOutput += `-- ÍNDICES\n`;
  sqlOutput += `-- ========================================================\n\n`;

  const idxRes = await client.query(`
    SELECT indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname NOT LIKE '%_pkey'
    ORDER BY tablename, indexname;
  `);

  for (const idx of idxRes.rows) {
    sqlOutput += `${idx.indexdef};\n`;
  }
  sqlOutput += `\n`;

  // 6. Funções Customizadas (Functions)
  console.log('Extraindo Funções...');
  sqlOutput += `-- ========================================================\n`;
  sqlOutput += `-- FUNÇÕES\n`;
  sqlOutput += `-- ========================================================\n\n`;

  const funcRes = await client.query(`
    SELECT pg_get_functiondef(p.oid) as def 
    FROM pg_proc p 
    JOIN pg_namespace n ON n.oid = p.pronamespace 
    WHERE n.nspname = 'public';
  `);

  for (const func of funcRes.rows) {
    sqlOutput += `${func.def};\n\n`;
  }

  // 7. Políticas de RLS / Permissões básicas
  sqlOutput += `-- ========================================================\n`;
  sqlOutput += `-- RLS E PERMISSÕES\n`;
  sqlOutput += `-- ========================================================\n\n`;

  for (const table of tables) {
    sqlOutput += `ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY;\n`;
    sqlOutput += `DROP POLICY IF EXISTS "Permitir tudo publico em ${table}" ON public."${table}";\n`;
    sqlOutput += `CREATE POLICY "Permitir tudo publico em ${table}" ON public."${table}" FOR ALL USING (true) WITH CHECK (true);\n`;
  }

  const outputPath = path.join(__dirname, '..', 'schema_novo_supabase.sql');
  fs.writeFileSync(outputPath, sqlOutput, 'utf8');
  console.log(`Sucesso! Arquivo salvo em: ${outputPath}`);

  await client.end();
}

exportSchema().catch(err => {
  console.error('Erro ao exportar schema:', err);
  process.exit(1);
});
