// Pagina a API do Portal da Transparência e importa todos os registros no banco Neon
// Rodado pelo GitHub Actions toda semana (domingo 3h)
// Rodar manualmente: node --env-file=.env.local scripts/sync-sanctions.js

import pg from "pg";

const { Client } = pg;
const API_BASE = "https://api.portaldatransparencia.gov.br/api-de-dados";
const API_KEY  = process.env.TRANSPARENCIA_API_KEY;
const POR_PAG  = 500;

if (!API_KEY) { console.error("TRANSPARENCIA_API_KEY não definida"); process.exit(1); }

// ─── busca uma página da API ──────────────────────────────────────────────────
async function fetchPagina(endpoint, pagina) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  url.searchParams.set("pagina", pagina);
  url.searchParams.set("quantidade", POR_PAG);

  const res = await fetch(url.toString(), {
    headers: { "chave-api-dados": API_KEY, "Accept": "application/json" },
  });

  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${endpoint} pág ${pagina}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data?.data || []);
}

// ─── importa todos os registros de um endpoint ───────────────────────────────
async function importarFonte(client, fonte) {
  const { nome, endpoint, mapear } = fonte;
  console.log(`\n[${nome}] Iniciando importação...`);

  await client.query("DELETE FROM sancoes WHERE fonte = $1", [nome]);

  let pagina = 1;
  let total = 0;

  while (true) {
    const registros = await fetchPagina(endpoint, pagina);
    if (registros.length === 0) break;

    for (const r of registros) {
      const row = mapear(r);
      if (!row.cpf_cnpj) continue;
      await client.query(
        `INSERT INTO sancoes (fonte, cpf_cnpj, nome, sancao, orgao, esfera, data_inicio, data_fim, multa)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [nome, row.cpf_cnpj, row.nome, row.sancao, row.orgao, row.esfera, row.data_inicio, row.data_fim, row.multa ?? null]
      );
    }

    total += registros.length;
    console.log(`  pág ${pagina} — ${total} registros acumulados`);

    if (registros.length < POR_PAG) break;
    pagina++;

    // Pausa leve para não sobrecarregar a API
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[${nome}] Concluído: ${total} registros.`);
}

// ─── mapeadores de campos ─────────────────────────────────────────────────────
function _clean(v) { return (v || "").replace(/\D/g, ""); }
function _sancao(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v.descricaoResumida || v.descricaoPortal || v.descricao || v.nome || "";
}

const FONTES = [
  {
    nome: "CEIS",
    endpoint: "ceis",
    mapear: o => ({
      cpf_cnpj:   _clean(o.pessoa?.cnpjFormatado || o.pessoa?.cpfFormatado || o.sancionado?.codigoFormatado || ""),
      nome:       o.sancionado?.nome || o.pessoa?.nome || o.nomeRazaoSocial || "",
      sancao:     _sancao(o.tipoSancao),
      orgao:      o.orgaoSancionador?.nome || "",
      esfera:     o.orgaoSancionador?.esfera || "",
      data_inicio:o.dataInicioSancao || "",
      data_fim:   o.dataFimSancao || "",
      multa:      null,
    }),
  },
  {
    nome: "CNEP",
    endpoint: "cnep",
    mapear: o => ({
      cpf_cnpj:   _clean(o.pessoa?.cnpjFormatado || o.pessoa?.cpfFormatado || ""),
      nome:       o.sancionado?.nome || o.pessoa?.nome || o.nomeRazaoSocial || "",
      sancao:     _sancao(o.tipoSancao),
      orgao:      o.orgaoSancionador?.nome || "",
      esfera:     o.orgaoSancionador?.esfera || "",
      data_inicio:o.dataInicioSancao || "",
      data_fim:   o.dataFimSancao || "",
      multa:      typeof o.valorMulta === "number" ? o.valorMulta : null,
    }),
  },
];

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
await client.connect();

for (const fonte of FONTES) {
  try {
    await importarFonte(client, fonte);
  } catch (e) {
    console.error(`Erro em ${fonte.nome}:`, e.message);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log("\nSincronização concluída.");
process.exit(0);
