export default async function handler(req, res) {
  const doc = (req.query.cpfCnpj || "").replace(/\D/g, "");
  if (!doc) return res.status(400).json({ erro: "cpfCnpj obrigatório" });

  try {
    const upstream = await fetch(
      `https://regularize.pgfn.gov.br/api/v1/contribuinte/${doc}/situacao`,
      { headers: { Accept: "application/json", "User-Agent": "AZRadar/1.0" } }
    );

    if (upstream.status === 404) {
      return res.status(200).json({
        fonte: "PGFN — Dívida Ativa da União",
        total: 0, ocorrencias: [], status: "ok",
        mensagem: "Sem débitos na dívida ativa federal",
      });
    }

    if (!upstream.ok) {
      return res.status(200).json({
        fonte: "PGFN — Dívida Ativa da União",
        status: "erro", erro: `HTTP ${upstream.status}`, total: 0, ocorrencias: [],
      });
    }

    const data = await upstream.json();
    const regular = (data.situacao || "").toUpperCase().includes("REGULAR") &&
                    !(data.situacao || "").toUpperCase().includes("IRREGULAR");
    const ocorrencias = regular ? [] : [{
      nome:     data.nome || data.razaoSocial || "",
      situacao: data.situacao || "Irregular",
      mensagem: data.descricao || data.mensagem || "",
    }];

    return res.status(200).json({
      fonte: "PGFN — Dívida Ativa da União",
      total: ocorrencias.length, ocorrencias,
      status: regular ? "ok" : "alerta",
    });
  } catch (e) {
    return res.status(200).json({
      fonte: "PGFN — Dívida Ativa da União",
      status: "erro", erro: e.message, total: 0, ocorrencias: [],
    });
  }
}
