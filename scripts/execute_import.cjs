const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Lucasduda28123@db.mpbmssohpjwijkyhtucm.supabase.co:5432/postgres';
const client = new Client({ connectionString });

async function run() {
  const { mogiProducts } = await import('./mogi_mirim_data.mjs');

  await client.connect();

  try {
    await client.query('BEGIN');

    // 1. Remove os 2 registros inativos de teste anteriores de MOGI MIRIM
    const delRes = await client.query("DELETE FROM produtos WHERE categoria = 'MOGI MIRIM'");
    console.log(`Removidos ${delRes.rowCount} registros anteriores de MOGI MIRIM.`);

    // 2. Calcula o maior código numérico atual (deve ser 206)
    const resMax = await client.query('SELECT codigo FROM produtos');
    let maxCode = 0;
    for (const row of resMax.rows) {
      const num = parseInt(row.codigo, 10);
      if (!isNaN(num) && num.toString() === (row.codigo || '').trim()) {
        if (num > maxCode) maxCode = num;
      }
    }
    console.log(`Maior código numérico encontrado antes da inserção: ${maxCode}`);

    let currentCode = maxCode + 1; // 207

    // 3. Insere todos os 195 produtos sequencialmente
    for (const item of mogiProducts) {
      const codigoSistema = currentCode.toString();
      const nomeFormatado = `${item.nome} CODIGO ${item.codFornecedor}`;
      const descComp = `Embalagem: ${item.embalagem}${item.valor_fardo ? ` | Fardo: R$ ${item.valor_fardo.toFixed(2)}` : ''} | Cód. Tabela: ${item.codFornecedor}`;

      const query = `
        INSERT INTO produtos (
          codigo,
          nome,
          categoria,
          valor,
          status,
          unidade_medida,
          referencia_extra,
          peso_bruto,
          descricao_complementar,
          tipo_item,
          controle_estoque,
          estoque,
          qtd_minima,
          qtd_reserva,
          custo_compra,
          custo_medio,
          lucro_bruto_perc,
          comissao_perc,
          taxa_icms_iss_contrib,
          taxa_icms_iss_cfe_nfe_nao_contrib,
          cfop_ecf,
          cfop_nf,
          iat,
          ippt,
          credito_presumido_tipo,
          credito_presumido_aliquota,
          credito_presumido_aliquota_uf,
          credito_presumido_uf_list,
          cores
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29
        )
      `;

      const values = [
        codigoSistema,                            // $1 codigo
        nomeFormatado,                            // $2 nome
        'MOGI MIRIM',                             // $3 categoria
        item.valor_unitario,                      // $4 valor
        'Ativo',                                  // $5 status
        item.unidade_medida || 'Unidade',         // $6 unidade_medida
        item.codFornecedor,                       // $7 referencia_extra
        item.ref_peso || 0,                       // $8 peso_bruto
        descComp,                                 // $9 descricao_complementar
        'Mercadoria para Revenda',                // $10 tipo_item
        'Nenhum',                                 // $11 controle_estoque
        0,                                        // $12 estoque
        0,                                        // $13 qtd_minima
        0,                                        // $14 qtd_reserva
        0,                                        // $15 custo_compra
        0,                                        // $16 custo_medio
        0,                                        // $17 lucro_bruto_perc
        0,                                        // $18 comissao_perc
        'Tributação Isenta',                      // $19 taxa_icms_iss_contrib
        'Venda à vista',                          // $20 taxa_icms_iss_cfe_nfe_nao_contrib
        '5102',                                   // $21 cfop_ecf
        '5102',                                   // $22 cfop_nf
        'A-Arredondamento',                       // $23 iat
        'T-Terceiros',                            // $24 ippt
        'NF-e',                                   // $25 credito_presumido_tipo
        0,                                        // $26 credito_presumido_aliquota
        false,                                    // $27 credito_presumido_aliquota_uf
        '[]',                                     // $28 credito_presumido_uf_list
        '[]'                                      // $29 cores
      ];

      await client.query(query, values);
      currentCode++;
    }

    await client.query('COMMIT');
    console.log(`Sucesso! Inseridos ${mogiProducts.length} produtos de MOGI MIRIM (códigos ${maxCode + 1} a ${currentCode - 1}).`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro na transação, feito ROLLBACK:', err);
  } finally {
    await client.end();
  }
}

run();
