// Importa MTE (Trabalho Escravo) e CEAC (Ajustamento de Conduta) para o banco
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";
import pg from "pg";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const { Client } = pg;

const __dir = dirname(fileURLToPath(import.meta.url));

const ARQUIVOS = [
  {
    arquivo: "MTE.xlsx",
    fonte:   "MTE — Trabalho Escravo",
    sancao:  "Trabalho análogo à escravidão",
  },
  {
    arquivo: "CEAC.xlsx",
    fonte:   "CEAC — Ajustamento de Conduta MTE",
    sancao:  "Empregador em ajustamento de conduta",
  },
];

function limparDoc(v) {
  if (v == null) return "";
  return String(v).replace(/\D/g, "");
}

function lerPlanilha(caminho) {
  const wb = XLSX.readFile(caminho, { cellText: true, cellDates: false, raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Encontra a linha de cabeçalho procurando por "CNPJ/CPF" ou "Empregador"
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].map(c => String(c).trim());
    if (row.some(c => c.includes("CNPJ") || c === "Empregador")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) throw new Error("Cabeçalho não encontrado");

  const headers = rows[headerIdx].map(c => String(c).trim());
  const data    = rows.slice(headerIdx + 1).filter(r => r.some(c => c !== ""));

  const colIdx = (nomes) => {
    for (const nome of nomes) {
      const i = headers.findIndex(h => h.includes(nome));
      if (i !== -1) return i;
    }
    return -1;
  };

  const iDoc      = colIdx(["CNPJ/CPF", "CPF/CNPJ"]);
  const iNome     = colIdx(["Empregador"]);
  const iUF       = colIdx(["UF"]);
  const iInicio   = colIdx(["Inclusão no Cadastro de Empregadores", "Inclusão no CEAC"]);
  const iDecisao  = colIdx(["Decisão administrativa", "Termo de Ajustamento"]);

  console.log(`  Colunas detectadas: doc=${iDoc} nome=${iNome} uf=${iUF} inicio=${iInicio}`);
  console.log(`  Total de linhas de dados: ${data.length}`);

  return data.map(row => ({
    doc:    limparDoc(row[iDoc]),
    nome:   String(row[iNome] || "").trim(),
    uf:     String(row[iUF]   || "").trim(),
    inicio: String(row[iInicio] || "").trim(),
    extra:  iDecisao !== -1 ? String(row[iDecisao] || "").trim() : "",
  })).filter(r => r.doc.length >= 11);
}

const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
await client.connect();

let totalGeral = 0;

for (const { arquivo, fonte, sancao } of ARQUIVOS) {
  const caminho = join(__dir, arquivo);
  let registros;
  try {
    registros = lerPlanilha(caminho);
  } catch (e) {
    console.log(`⚠  ${arquivo} não encontrado ou erro: ${e.message}`);
    continue;
  }

  console.log(`\nImportando ${fonte} — ${registros.length} registros...`);

  // Remove registros antigos desta fonte
  await client.query("DELETE FROM sancoes WHERE fonte = $1", [fonte]);

  let count = 0;
  const BATCH = 200;
  for (let i = 0; i < registros.length; i += BATCH) {
    const lote = registros.slice(i, i + BATCH);
    await client.query("BEGIN");
    for (const r of lote) {
      await client.query(
        `INSERT INTO sancoes (fonte, cpf_cnpj, nome, sancao, orgao, esfera, data_inicio)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [fonte, r.doc, r.nome, sancao, "MTE — Ministério do Trabalho e Emprego", "Federal", r.inicio]
      );
      count++;
    }
    await client.query("COMMIT");
    process.stdout.write(`\r  ${count}/${registros.length}`);
  }
  console.log(`\n  ✓ ${count} registros importados`);
  totalGeral += count;
}

await client.end();
console.log(`\nTotal importado: ${totalGeral} registros`);
process.exit(0);
