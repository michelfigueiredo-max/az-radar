// Integração PGFN — Procuradoria-Geral da Fazenda Nacional
// Certidão de Regularidade Fiscal (dívida ativa da União)
// API pública: https://regularize.pgfn.gov.br

const BASE = "https://regularize.pgfn.gov.br/api/v1/contribuinte";

export async function consultarPGFN(cpfCnpj) {
  const doc = cpfCnpj.replace(/\D/g, "");

  try {
    const res = await fetch(`${BASE}/${doc}/situacao`, {
      headers: { "Accept": "application/json", "User-Agent": "AZRadar/1.0" },
    });

    if (res.status === 404) {
      return {
        fonte:       "PGFN — Dívida Ativa da União",
        total:       0,
        ocorrencias: [],
        status:      "ok",
        mensagem:    "Sem débitos na dívida ativa federal",
      };
    }

    if (!res.ok) {
      return {
        fonte:   "PGFN — Dívida Ativa da União",
        status:  "erro",
        erro:    `HTTP ${res.status}`,
        total:   0,
        ocorrencias: [],
      };
    }

    const data = await res.json();

    // Situação: REGULAR ou IRREGULAR
    const regular = (data.situacao || "").toUpperCase().includes("REGULAR") &&
                    !(data.situacao || "").toUpperCase().includes("IRREGULAR");

    const ocorrencias = regular ? [] : [{
      nome:     data.nome || data.razaoSocial || "",
      situacao: data.situacao || "Irregular",
      mensagem: data.descricao || data.mensagem || "",
    }];

    return {
      fonte:       "PGFN — Dívida Ativa da União",
      total:       ocorrencias.length,
      ocorrencias,
      status:      regular ? "ok" : "alerta",
      _raw:        data,
    };
  } catch (e) {
    return {
      fonte:       "PGFN — Dívida Ativa da União",
      status:      "erro",
      erro:        e.message,
      total:       0,
      ocorrencias: [],
    };
  }
}
