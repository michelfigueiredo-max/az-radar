// Integração DataJud — CNJ (Conselho Nacional de Justiça)
// API pública, sem chave para consultas básicas
// Documentação: https://datajud-wiki.cnj.jus.br

const BASE = "https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search";

// Tribunais disponíveis na API pública
const TRIBUNAIS = [
  { sigla: "tjsp", nome: "TJSP" },
  { sigla: "tjrj", nome: "TJRJ" },
  { sigla: "tjmg", nome: "TJMG" },
  { sigla: "tjrs", nome: "TJRS" },
  { sigla: "trf1", nome: "TRF1" },
  { sigla: "trf2", nome: "TRF2" },
  { sigla: "trf3", nome: "TRF3" },
  { sigla: "trf4", nome: "TRF4" },
  { sigla: "trf5", nome: "TRF5" },
  { sigla: "stj",  nome: "STJ"  },
];

async function _buscarTribunal(sigla, cpfCnpj) {
  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${sigla}/_search`;
  const body = {
    query: {
      bool: {
        should: [
          { match: { "partes.documento": cpfCnpj } },
        ],
      },
    },
    size: 10,
    _source: ["numeroProcesso", "classe", "assuntos", "dataAjuizamento", "partes", "tribunal"],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "ApiKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TaENhQlZQd2NwOS1zcw==" },
    body: JSON.stringify(body),
  });

  if (!res.ok) return [];
  const data = await res.json();
  return (data?.hits?.hits || []).map(h => h._source);
}

export async function consultarProcessos(cpfCnpj) {
  const doc = cpfCnpj.replace(/\D/g, "");

  // Consulta os principais tribunais em paralelo
  const tribunaisConsultar = ["tjsp", "tjrj", "tjmg", "trf1", "trf4", "stj"];
  const resultados = await Promise.allSettled(
    tribunaisConsultar.map(sigla => _buscarTribunal(sigla, doc))
  );

  const processos = resultados
    .filter(r => r.status === "fulfilled")
    .flatMap(r => r.value)
    .map(p => ({
      numero:      p.numeroProcesso || "",
      classe:      p.classe?.nome || "",
      assunto:     (p.assuntos || [])[0]?.nome || "",
      data:        p.dataAjuizamento ? p.dataAjuizamento.slice(0, 10) : "",
      tribunal:    p.tribunal?.nome || p.tribunal || "",
      partes:      (p.partes || []).map(pt => `${pt.nome} (${pt.polo})`).join(", "),
    }));

  return {
    fonte:       "DataJud — CNJ",
    total:       processos.length,
    ocorrencias: processos,
    status:      processos.length === 0 ? "ok" : "alerta",
  };
}
