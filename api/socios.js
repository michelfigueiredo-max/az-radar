// Proxy para publica.cnpj.ws/socios/{cpf}
// GET /api/socios?cpf=12345678900

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const cpf = (req.query.cpf || "").replace(/\D/g, "");
  if (!cpf) return res.status(400).json({ erro: "cpf obrigatório" });

  try {
    const upstream = await fetch(`https://publica.cnpj.ws/socios/${cpf}`, {
      headers: { "Accept": "application/json", "User-Agent": "AZRadar/1.0" },
      signal: AbortSignal.timeout(10_000),
    });

    if (upstream.status === 404) return res.status(200).json({ sociedades: [] });
    if (upstream.status === 429) return res.status(200).json({ sociedades: [], aviso: "rate_limit" });
    if (!upstream.ok) return res.status(200).json({ sociedades: [], aviso: `http_${upstream.status}` });

    const data = await upstream.json();
    // Normaliza: pode vir como array ou objeto com empresas
    const lista = Array.isArray(data) ? data : (data?.empresas || data?.socios || []);

    const sociedades = lista.map(s => ({
      cnpj:         (s.cnpj || s.estabelecimento?.cnpj || "").replace(/\D/g, ""),
      razaoSocial:  s.razao_social || s.nome || s.estabelecimento?.razao_social || "",
      qualificacao: s.qualificacao_socio?.descricao || s.qualificacao || "",
      dataEntrada:  s.data_entrada_sociedade || "",
      situacao:     s.situacao_cadastral?.descricao || s.situacao || "",
      uf:           s.estabelecimento?.estado?.sigla || s.uf || "",
    })).filter(s => s.cnpj);

    return res.status(200).json({ sociedades });
  } catch (e) {
    return res.status(200).json({ sociedades: [], aviso: e.message });
  }
}
