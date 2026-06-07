// Cria a tabela de sanções no Vercel Postgres
// Rodar uma vez: node scripts/init-db.js

import { sql } from "@vercel/postgres";

await sql`
  CREATE TABLE IF NOT EXISTS sancoes (
    id           SERIAL PRIMARY KEY,
    fonte        TEXT NOT NULL,          -- 'CEIS', 'CNEP', 'CEPIM'
    cpf_cnpj     TEXT NOT NULL,          -- somente dígitos
    nome         TEXT,
    sancao       TEXT,
    orgao        TEXT,
    esfera       TEXT,
    data_inicio  TEXT,
    data_fim     TEXT,
    multa        NUMERIC,
    raw          JSONB,
    atualizado   TIMESTAMPTZ DEFAULT NOW()
  );
`;

await sql`CREATE INDEX IF NOT EXISTS idx_sancoes_cpf_cnpj ON sancoes (cpf_cnpj);`;
await sql`CREATE INDEX IF NOT EXISTS idx_sancoes_fonte ON sancoes (fonte);`;

console.log("Tabela criada com sucesso.");
process.exit(0);
