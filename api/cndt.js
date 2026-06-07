export default async function handler(req, res) {
  const doc = (req.query.cpfCnpj || "").replace(/\D/g, "");
  if (!doc) return res.status(400).json({ erro: "cpfCnpj obrigatório" });

  try {
    const upstream = await fetch(
      `https://cndt-certidao.tst.jus.br/api/v1/certidao/${doc}`,
      { headers: { Accept: "application/json", "User-Agent": "AZRadar/1.0" } }
    );

    if (upstream.status === 404) {
      return res.status(200).json({
        fonte: "CNDT — Débitos Trabalhistas (TST)",
        total: 0, ocorrencias: [], status: "ok",
        mensagem: "Certidão Negativa — sem débitos trabalhistas",
      });
    }

    if (!upstream.ok) {
      return res.status(200).json({
        fonte: "CNDT — Débitos Trabalhistas (TST)",
        status: "erro", erro: `HTTP ${upstream.status}`, total: 0, ocorrencias: [],
      });
    }

    const data = await upstream.json();
    const tipo = (data.tipoCertidao || data.tipo || "").toUpperCase();
    const negativa = tipo.includes("NEGATIVA") && !tipo.includes("POSITIVA");
    const efeito   = tipo.includes("EFEITO_NEGATIVA") || tipo.includes("EFEITO NEGATIVA");
    const status   = negativa || efeito ? "ok" : "alerta";

    const ocorrencias = (negativa || efeito) ? [] : [{
      nome:     data.nome || data.razaoSocial || "",
      situacao: data.tipoCertidao || data.tipo || "Positiva",
      validade: data.dataValidade || data.validade || "",
      mensagem: data.observacao || data.mensagem || "",
    }];

    return res.status(200).json({
      fonte: "CNDT — Débitos Trabalhistas (TST)",
      total: ocorrencias.length, ocorrencias, status,
    });
  } catch (e) {
    return res.status(200).json({
      fonte: "CNDT — Débitos Trabalhistas (TST)",
      status: "erro", erro: e.message, total: 0, ocorrencias: [],
    });
  }
}
