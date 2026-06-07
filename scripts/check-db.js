// Verifica o que está no banco
import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
await client.connect();

const { rows } = await client.query(`SELECT cpf_cnpj, nome, fonte FROM sancoes LIMIT 10`);
console.log("Primeiros 10 registros:");
rows.forEach(r => console.log(`  cpf_cnpj="${r.cpf_cnpj}" nome="${r.nome}" fonte="${r.fonte}"`));

const { rows: stats } = await client.query(`
  SELECT
    LENGTH(cpf_cnpj) as len,
    COUNT(*) as qtd
  FROM sancoes
  GROUP BY len
  ORDER BY len
`);
console.log("\nDistribuição por tamanho do CPF/CNPJ:");
stats.forEach(r => console.log(`  ${r.len} dígitos: ${r.qtd} registros`));

await client.end();
process.exit(0);
