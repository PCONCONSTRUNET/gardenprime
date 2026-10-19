const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Lucasduda28123@db.mpbmssohpjwijkyhtucm.supabase.co:5432/postgres';
const client = new Client({ connectionString });

async function run() {
  await client.connect();
  const res = await client.query(`SELECT codigo, nome FROM produtos ORDER BY created_at DESC;`);
  console.log("Todos os produtos:");
  res.rows.forEach(r => console.log(r.codigo, r.nome));
  await client.end();
}
run();
