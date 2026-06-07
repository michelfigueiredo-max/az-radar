// Baixa CSVs do Portal da Transparência e importa no Vercel Postgres
// Rodado pelo GitHub Actions toda semana (domingo 3h)
// Rodar manualmente: node scripts/sync-sanctions.js

import { sql } from "@vercel/postgres";
import { createReadStream } from "fs";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { parse } from "csv-parse";
import { createGunzip } from "zlib";
import fetch from "node-fetch";
import * as fs from "fs";

// Fontes disponíveis para download (arquivos CSV completos)
const FONTES = [
  {
    nome: "CEIS",
    url: "https://portaldatransparencia.gov.br/download-de-dados/ceis/CEIS_CSV.zip",
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
    url: "https://portaldatransparencia.gov.br/download-de-dados/cnep/CNEP_CSV.zip",
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

async function downloadAndExtract(url, destPath) {
  console.log(`Baixando ${url}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar ${url}`);

  // Salva o ZIP
  const zipPath = destPath + ".zip";
  await pipeline(res.body, createWriteStream(zipPath));

  // Extrai usando unzipper
  const unzipper = await import("unzipper");
  const zip = fs.createReadStream(zipPath).pipe(unzipper.Parse({ forceStream: true }));

  for await (const entry of zip) {
    if (entry.path.endsWith(".csv") || entry.path.endsWith(".CSV")) {
      await pipeline(entry, createWriteStream(destPath));
      console.log(`Extraído: ${entry.path} → ${destPath}`);
    } else {
      entry.autodrain();
    }
  }

  fs.unlinkSync(zipPath);
}

async function importCSV(fonte, csvPath) {
  console.log(`Importando ${fonte.nome} de ${csvPath}...`);

  // Limpa registros antigos desta fonte
  await sql`DELETE FROM sancoes WHERE fonte = ${fonte.nome}`;

  let count = 0;
  const batch = [];

  await new Promise((resolve, reject) => {
    const parser = parse({
      delimiter: ";",
      columns: true,
      skip_empty_lines: true,
      encoding: "latin1",
      trim: true,
    });

    parser.on("readable", async function () {
      let record;
      while ((record = parser.read()) !== null) {
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

        // Insere em lotes de 500
        if (batch.length >= 500) {
          await flushBatch(batch.splice(0));
          count += 500;
          if (count % 10000 === 0) console.log(`  ${count} registros importados...`);
        }
      }
    });

    parser.on("error", reject);
    parser.on("end", resolve);

    createReadStream(csvPath).pipe(parser);
  });

  // Flush restante
  if (batch.length > 0) {
    await flushBatch(batch.splice(0));
    count += batch.length;
  }

  console.log(`${fonte.nome}: ${count} registros importados.`);
}

async function flushBatch(records) {
  // Insere múltiplos registros
  for (const r of records) {
    await sql`
      INSERT INTO sancoes (fonte, cpf_cnpj, nome, sancao, orgao, esfera, data_inicio, data_fim, multa)
      VALUES (${r.fonte}, ${r.cpf_cnpj}, ${r.nome}, ${r.sancao}, ${r.orgao}, ${r.esfera}, ${r.data_inicio}, ${r.data_fim}, ${r.multa})
    `;
  }
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
for (const fonte of FONTES) {
  const csvPath = `/tmp/${fonte.nome}.csv`;
  try {
    await downloadAndExtract(fonte.url, csvPath);
    await importCSV(fonte, csvPath);
    if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
  } catch (e) {
    console.error(`Erro ao processar ${fonte.nome}:`, e.message);
    process.exit(1);
  }
}

console.log("Sincronização concluída.");
process.exit(0);
