// Cria a tabela de sanções no banco Neon
// Rodar uma vez: node scripts/init-db.js

import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS sancoes (
    id           SERIAL PRIMARY KEY,
    fonte        TEXT NOT NULL,
    cpf_cnpj     TEXT NOT NULL,
    nome         TEXT,
    sancao       TEXT,
    orgao        TEXT,
    esfera       TEXT,
    data_inicio  TEXT,
    data_fim     TEXT,
    multa        NUMERIC,
    atualizado   TIMESTAMPTZ DEFAULT NOW()
  )
`);

await client.query(`CREATE INDEX IF NOT EXISTS idx_sancoes_cpf_cnpj ON sancoes (cpf_cnpj)`);
await client.query(`CREATE INDEX IF NOT EXISTS idx_sancoes_fonte ON sancoes (fonte)`);

console.log("Tabela criada com sucesso.");
await client.end();
process.exit(0);
