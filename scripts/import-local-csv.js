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
    sancaoCol:  "CATEGORIA DA SANÇÃO",
    orgaoCol:   "ÓRGÃO SANCIONADOR",
    esferaCol:  "ESFERA ÓRGÃO SANCIONADOR",
    inicioCol:  "DATA INÍCIO SANÇÃO",
    fimCol:     "DATA FINAL SANÇÃO",
    multaCol:   null,
  },
  {
    nome: "CNEP",
    arquivo: join(__dir, "CNEP.csv"),
    cpfCnpjCol: "CPF OU CNPJ DO SANCIONADO",
    nomeCol:    "NOME DO SANCIONADO",
    sancaoCol:  "CATEGORIA DA SANÇÃO",
    orgaoCol:   "ÓRGÃO SANCIONADOR",
    esferaCol:  "ESFERA ÓRGÃO SANCIONADOR",
    inicioCol:  "DATA INÍCIO SANÇÃO",
    fimCol:     "DATA FINAL SANÇÃO",
    multaCol:   "VALOR DA MULTA",
  },
  {
    nome: "CEPIM",
    arquivo: join(__dir, "CEPIM.csv"),
    cpfCnpjCol: "CNPJ ENTIDADE",
    nomeCol:    "NOME ENTIDADE",
    sancaoCol:  "MOTIVO DO IMPEDIMENTO",
    orgaoCol:   "ÓRGÃO CONCEDENTE",
    esferaCol:  null,
    inicioCol:  null,
    fimCol:     null,
    multaCol:   null,
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
  let headersValidated = false;

  // Colunas esperadas para esta fonte (ignora nulos — campos opcionais)
  const COLS_ESPERADAS = {
    cpfCnpj: fonte.cpfCnpjCol,
    nome:    fonte.nomeCol,
    sancao:  fonte.sancaoCol,
    orgao:   fonte.orgaoCol,
    esfera:  fonte.esferaCol,
    inicio:  fonte.inicioCol,
    fim:     fonte.fimCol,
    multa:   fonte.multaCol,
  };

  const validarCabecalho = (record) => {
    const colsReais = Object.keys(record);
    let erros = 0;
    for (const [campo, col] of Object.entries(COLS_ESPERADAS)) {
      if (!col) continue; // opcional
      if (!colsReais.includes(col)) {
        console.error(`  ⚠ COLUNA NÃO ENCONTRADA [${campo}]: "${col}"`);
        erros++;
      }
    }
    if (erros > 0) {
      console.error(`  Colunas reais do CSV (${colsReais.length}):`);
      colsReais.forEach(c => console.error(`    • "${c}"`));
      throw new Error(`[${fonte.nome}] ${erros} coluna(s) com mapeamento incorreto — abortando importação.`);
    }
    console.log(`  ✓ Cabeçalho validado (${colsReais.length} colunas)`);
  };

  const flush = async () => {
    if (!batch.length) return;
    const rows = batch;
    batch = [];
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
    if (!headersValidated) {
      validarCabecalho(record); // lança se alguma coluna não bater
      headersValidated = true;
    }
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
