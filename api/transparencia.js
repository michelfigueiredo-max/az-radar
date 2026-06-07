// Vercel Serverless Function — proxy seguro para o Portal da Transparência (CGU)
// A chave de API fica no servidor (TRANSPARENCIA_API_KEY), nunca exposta no browser.

const BASE = "https://api.portaldatransparencia.gov.br/api-de-dados";

// Endpoints válidos — whitelist explícita para evitar proxy aberto
const ENDPOINTS_PERMITIDOS = new Set([
  "ceis",
  "cnep",
  "cepim",
  "lista-trabalho-escravo",
  "pep",
  "beneficios-cidadao/bolsa-familia",
  "bolsa-familia-disponivel-por-cpf-ou-nis",
  "beneficios-cidadao/bpc",
]);

export default async function handler(req, res) {
  // CORS — permite chamada do frontend hospedado no Vercel
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  const { endpoint, ...params } = req.query;

  if (!endpoint || !ENDPOINTS_PERMITIDOS.has(endpoint)) {
    return res.status(400).json({
      erro: "Endpoint não permitido",
      permitidos: [...ENDPOINTS_PERMITIDOS],
    });
  }

  const apiKey = process.env.TRANSPARENCIA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ erro: "Chave de API não configurada no servidor" });
  }

  // Monta URL com query params passados pelo frontend
  const url = new URL(`${BASE}/${endpoint}`);
  url.searchParams.set("pagina", params.pagina || "1");
  url.searchParams.set("quantidade", params.quantidade || "10");

  // Parâmetros de filtro opcionais
  const filtros = ["cpfCnpj", "cnpjCpf", "cnpjEntidade", "codigoCpfCpf", "nomePessoa", "uf", "ano"];
  for (const f of filtros) {
    if (params[f]) url.searchParams.set(f, params[f]);
  }

  try {
    const resp = await fetch(url.toString(), {
      headers: {
        "chave-api-dados": apiKey,
        "Accept": "application/json",
        "User-Agent": "AZRadar/1.0",
      },
    });

    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!resp.ok) {
      return res.status(resp.status).json({
        erro: `API ${resp.status}`,
        detalhe: data,
        endpoint,
        keyLen: apiKey.length,
      });
    }

    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({
      erro: "Falha ao conectar com o Portal da Transparência",
      detalhe: e.message,
    });
  }
}
