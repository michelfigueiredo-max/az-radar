// Integração CNDT — Certidão Negativa de Débitos Trabalhistas (TST)
// API pública do Tribunal Superior do Trabalho
// https://cndt-certidao.tst.jus.br

const BASE = "https://cndt-certidao.tst.jus.br/api/v1/certidao";

export async function consultarCNDT(cpfCnpj) {
  const doc = cpfCnpj.replace(/\D/g, "");

  try {
    const res = await fetch(`${BASE}/${doc}`, {
      headers: { "Accept": "application/json", "User-Agent": "AZRadar/1.0" },
    });

    if (res.status === 404) {
      return {
        fonte:       "CNDT — Débitos Trabalhistas (TST)",
        total:       0,
        ocorrencias: [],
        status:      "ok",
        mensagem:    "Certidão Negativa — sem débitos trabalhistas",
      };
    }

    if (!res.ok) {
      return {
        fonte:       "CNDT — Débitos Trabalhistas (TST)",
        status:      "erro",
        erro:        `HTTP ${res.status}`,
        total:       0,
        ocorrencias: [],
      };
    }

    const data = await res.json();

    // Tipos: NEGATIVA, POSITIVA_EFEITO_NEGATIVA, POSITIVA
    const tipo = (data.tipoCertidao || data.tipo || "").toUpperCase();
    const negativa = tipo.includes("NEGATIVA") && !tipo.includes("POSITIVA");
    const efeito   = tipo.includes("EFEITO_NEGATIVA") || tipo.includes("EFEITO NEGATIVA");

    const status = negativa ? "ok" : efeito ? "ok" : "alerta";

    const ocorrencias = negativa ? [] : [{
      nome:      data.nome || data.razaoSocial || "",
      situacao:  data.tipoCertidao || data.tipo || "Positiva",
      validade:  data.dataValidade || data.validade || "",
      mensagem:  data.observacao || data.mensagem || "",
    }];

    return {
      fonte:       "CNDT — Débitos Trabalhistas (TST)",
      total:       ocorrencias.length,
      ocorrencias,
      status,
      _raw: data,
    };
  } catch (e) {
    return {
      fonte:       "CNDT — Débitos Trabalhistas (TST)",
      status:      "erro",
      erro:        e.message,
      total:       0,
      ocorrencias: [],
    };
  }
}
