const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Lucasduda28123@db.mpbmssohpjwijkyhtucm.supabase.co:5432/postgres';
const client = new Client({ connectionString });

async function run() {
  await client.connect();
  
  // 1. Get all codes to find the max numeric code
  const res = await client.query('SELECT codigo FROM produtos');
  let maxCode = 0;
  for (const row of res.rows) {
    const num = parseInt(row.codigo, 10);
    if (!isNaN(num) && num.toString() === row.codigo.trim()) {
      if (num > maxCode) {
        maxCode = num;
      }
    }
  }
  console.log(`Maior código numérico encontrado: ${maxCode}`);
  
  // 2. Get the new products that we just inserted (they start with VC)
  const newProductsRes = await client.query(`
    SELECT id, codigo, nome 
    FROM produtos 
    WHERE categoria = 'Vasos Cerâmicas' AND codigo LIKE 'VC%'
    ORDER BY codigo ASC
  `);
  
  console.log(`Encontrados ${newProductsRes.rowCount} novos produtos para atualizar.`);
  
  // 3. Update them sequentially
  let currentCode = maxCode + 1;
  for (const prod of newProductsRes.rows) {
    const novoCodigo = currentCode.toString();
    await client.query('UPDATE produtos SET codigo = $1 WHERE id = $2', [novoCodigo, prod.id]);
    console.log(`Atualizando ${prod.codigo} (${prod.nome}) -> ${novoCodigo}`);
    currentCode++;
  }
  
  await client.end();
}

run();
