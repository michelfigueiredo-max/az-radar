// Importa CSVs baixados manualmente do Portal da Transparência
// Uso: node --env-file=.env.local scripts/import-local-csv.js

import pg from "pg";
import { createReadStream, existsSync } from "fs";
import { parse } from "csv-parse";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const { Client } = pg;
const __dir = dirname(fileURLToPath(import.meta.url));

const FONTES = [
  {
    nome: "CEIS",
    arquivo: join(__dir, "CEIS.csv"),
    cpfCnpjCol: "CPF OU CNPJ DO SANCIONADO",
    nomeCol:    "NOME DO SANCIONADO",
    sancaoCol:  "TIPO DE SANÇÃO",
    orgaoCol:   "ÓRGÃO SANCIONADOR",
    esferaCol:  "ESFERA DO ÓRGÃO SANCIONADOR",
    inicioCol:  "DATA INÍCIO DA SANÇÃO",
    fimCol:     "DATA FIM DA SANÇÃO",
    multaCol:   null,
  },
  {
    nome: "CNEP",
    arquivo: join(__dir, "CNEP.csv"),
    cpfCnpjCol: "CPF OU CNPJ DO SANCIONADO",
    nomeCol:    "NOME DO SANCIONADO",
    sancaoCol:  "TIPO DE SANÇÃO",
    orgaoCol:   "ÓRGÃO SANCIONADOR",
    esferaCol:  "ESFERA DO ÓRGÃO SANCIONADOR",
    inicioCol:  "DATA INÍCIO DA SANÇÃO",
    fimCol:     "DATA FIM DA SANÇÃO",
    multaCol:   "VALOR DA MULTA APLICADA",
  },
];

async function importarCSV(client, fonte) {
  if (!existsSync(fonte.arquivo)) {
    console.log(`[${fonte.nome}] Arquivo não encontrado: ${fonte.arquivo} — pulando.`);
    return;
  }

  console.log(`[${fonte.nome}] Importando de ${fonte.arquivo}...`);
  await client.query("DELETE FROM sancoes WHERE fonte = $1", [fonte.nome]);

  const parser = createReadStream(fonte.arquivo).pipe(
    parse({ delimiter: ";", columns: true, skip_empty_lines: true, encoding: "latin1", trim: true })
  );

  let batch = [];
  let count = 0;

  const flush = async () => {
    if (!batch.length) return;
    const rows = batch;
    batch = [];
    // Insere em uma transação por lote
    await client.query("BEGIN");
    for (const r of rows) {
      await client.query(
        `INSERT INTO sancoes (fonte, cpf_cnpj, nome, sancao, orgao, esfera, data_inicio, data_fim, multa)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [r.fonte, r.cpf_cnpj, r.nome, r.sancao, r.orgao, r.esfera, r.data_inicio, r.data_fim, r.multa]
      );
    }
    await client.query("COMMIT");
    count += rows.length;
    if (count % 5000 === 0) console.log(`  ${count} registros...`);
  };

  for await (const record of parser) {
    const cpfCnpj = (record[fonte.cpfCnpjCol] || "").replace(/\D/g, "");
    if (!cpfCnpj) continue;
    batch.push({
      fonte:      fonte.nome,
      cpf_cnpj:   cpfCnpj,
      nome:       record[fonte.nomeCol] || "",
      sancao:     record[fonte.sancaoCol] || "",
      orgao:      record[fonte.orgaoCol] || "",
      esfera:     record[fonte.esferaCol] || "",
      data_inicio:record[fonte.inicioCol] || "",
      data_fim:   record[fonte.fimCol] || "",
      multa:      fonte.multaCol ? parseFloat((record[fonte.multaCol] || "0").replace(",", ".")) || null : null,
    });
    if (batch.length >= 500) await flush();
  }
  await flush();

  console.log(`[${fonte.nome}] Concluído: ${count} registros importados.`);
}

const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
await client.connect();

for (const fonte of FONTES) {
  await importarCSV(client, fonte);
}

await client.end();
console.log("\nImportação concluída.");
process.exit(0);
