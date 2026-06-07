// Integração Portal da Transparência (CGU) — todas as fontes V0 gratuitas
// Em dev: chama API diretamente com VITE_TRANSPARENCIA_KEY (header client-side)
// Em prod (Vercel): chama /api/transparencia (chave no servidor)

const BASE_PROD = "/api/transparencia";
const BASE_DEV  = "https://api.portaldatransparencia.gov.br/api-de-dados";
const DEV_KEY   = typeof import.meta !== "undefined"
  ? import.meta.env?.VITE_TRANSPARENCIA_KEY
  : null;
const IS_DEV    = typeof import.meta !== "undefined"
  ? import.meta.env?.DEV === true
  : false;

// ─── CALL INTERNO ─────────────────────────────────────────────────────────────
async function _call(endpoint, params = {}) {
  let url;

  if (IS_DEV && DEV_KEY) {
    // Dev: chama direto com a chave no header
    url = new URL(`${BASE_DEV}/${endpoint}`);
    Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
    const res = await fetch(url.toString(), {
      headers: { "chave-api-dados": DEV_KEY, "Accept": "application/json" },
    });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${endpoint}`);
    return res.json();
  } else {
    // Prod: usa proxy Vercel
    url = new URL(BASE_PROD, window.location.origin);
    url.searchParams.set("endpoint", endpoint);
    Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if (res.status === 404) return [];
    if (res.status === 403) throw new Error("Acesso restrito — chave sem permissão para este endpoint");
    if (!res.ok) {
      let detail = "";
      try { const d = await res.json(); detail = d?.detalhe?.mensagem || d?.mensagem || d?.erro || ""; } catch {}
      throw new Error(`Erro ${res.status}${detail ? ` — ${detail}` : ` — ${endpoint}`}`);
    }
    return res.json();
  }
}

// Normaliza CPF/CNPJ para somente dígitos
function _clean(doc) { return doc.replace(/\D/g, ""); }

// Extrai string segura de campo que pode ser objeto ou string
function _sancao(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v.descricaoResumida || v.descricaoPortal || v.descricao || v.nome || "";
}

// ─── CEIS — Cadastro de Empresas Inidôneas e Suspensas ────────────────────────
export async function consultarCEIS(cpfCnpj) {
  const doc = _clean(cpfCnpj);
  const data = await _call("ceis", { cnpjCpf: doc, pagina: 1, quantidade: 10 });
  const ocorrencias = Array.isArray(data) ? data : (data?.data || []);
  return {
    fonte:       "CEIS — CGU",
    endpoint:    "ceis",
    total:       ocorrencias.length,
    ocorrencias: ocorrencias.map(o => ({
      nome:            o.sancionado?.nome || o.pessoa?.nome || o.nomeRazaoSocial || "",
      cpfCnpj:         o.pessoa?.cpfFormatado || o.pessoa?.cnpjFormatado || o.sancionado?.codigoFormatado || "",
      tipo:            o.pessoa?.tipo || "",
      sanção:          _sancao(o.tipoSancao),
      orgaoSancionador:o.orgaoSancionador?.nome || "",
      esfera:          o.orgaoSancionador?.esfera || "",
      dataInicio:      o.dataInicioSancao || "",
      dataFim:         o.dataFimSancao || "",
    })),
    status: ocorrencias.length === 0 ? "ok" : "alerta",
  };
}

// ─── CNEP — Cadastro Nacional de Empresas Punidas ─────────────────────────────
export async function consultarCNEP(cpfCnpj) {
  const doc = _clean(cpfCnpj);
  const data = await _call("cnep", { cnpjCpf: doc, pagina: 1, quantidade: 10 });
  const ocorrencias = Array.isArray(data) ? data : (data?.data || []);
  return {
    fonte:       "CNEP — CGU",
    endpoint:    "cnep",
    total:       ocorrencias.length,
    ocorrencias: ocorrencias.map(o => ({
      nome:            o.sancionado?.nome || o.pessoa?.nome || o.nomeRazaoSocial || "",
      cpfCnpj:         o.pessoa?.cpfFormatado || o.pessoa?.cnpjFormatado || "",
      sanção:          _sancao(o.tipoSancao),
      orgaoSancionador:o.orgaoSancionador?.nome || "",
      esfera:          o.orgaoSancionador?.esfera || "",
      dataInicio:      o.dataInicioSancao || "",
      dataFim:         o.dataFimSancao || "",
      multa:           typeof o.valorMulta === "number" ? `R$ ${o.valorMulta.toLocaleString("pt-BR")}` : "",
    })),
    status: ocorrencias.length === 0 ? "ok" : "alerta",
  };
}

// ─── CEPIM — Entidades Privadas Sem Fins Lucrativos Impedidas ────────────────
export async function consultarCEPIM(cnpj) {
  const doc = _clean(cnpj);
  if (doc.length !== 14) return { fonte: "CEPIM — CGU", total: 0, ocorrencias: [], status: "ok" };
  const data = await _call("cepim", { cnpjEntidade: doc, pagina: 1, quantidade: 10 });
  const ocorrencias = Array.isArray(data) ? data : (data?.data || []);
  return {
    fonte:       "CEPIM — CGU",
    endpoint:    "cepim",
    total:       ocorrencias.length,
    ocorrencias: ocorrencias.map(o => ({
      entidade:    o.entidade?.nome || o.nomeEntidade || "",
      cnpj:        o.entidade?.cnpj || o.cnpjEntidade || "",
      impedimento: o.motivoImpedimento || o.motivo || "",
      convenio:    o.convenio?.numero || "",
      orgao:       o.convenio?.orgaoSuperior?.nome || "",
    })),
    status: ocorrencias.length === 0 ? "ok" : "alerta",
  };
}

// ─── MTE — Lista de Trabalho Escravo ─────────────────────────────────────────
export async function consultarTrabalhoEscravo(cpfCnpj) {
  const doc = _clean(cpfCnpj);
  // O endpoint aceita tanto CPF quanto CNPJ
  const data = await _call("lista-trabalho-escravo", { cnpjCpf: doc, pagina: 1, quantidade: 10 });
  const ocorrencias = Array.isArray(data) ? data : (data?.data || []);
  return {
    fonte:       "MTE — Lista de Trabalho Escravo",
    endpoint:    "lista-trabalho-escravo",
    total:       ocorrencias.length,
    ocorrencias: ocorrencias.map(o => ({
      nome:         o.nomeEmpregador || o.nome || "",
      cpfCnpj:      o.cpfCnpj || o.cpf || "",
      uf:           o.uf || "",
      ano:          o.anoCadastro || o.ano || "",
      decisao:      o.decisaoAdministrativa || "",
    })),
    status: ocorrencias.length === 0 ? "ok" : "recusa",
  };
}

// ─── PEP — Pessoas Politicamente Expostas ────────────────────────────────────
export async function consultarPEP(cpfCnpj) {
  const doc = _clean(cpfCnpj);
  const data = await _call("pep", { cnpjCpf: doc, pagina: 1, quantidade: 10 });
  const ocorrencias = Array.isArray(data) ? data : (data?.data || []);
  return {
    fonte:       "PEP — Portal Transparência",
    endpoint:    "pep",
    total:       ocorrencias.length,
    ocorrencias: ocorrencias.map(o => ({
      nome:         o.nome || "",
      cpf:          o.cpf || "",
      cargo:        o.descricaoFuncao || o.cargo || "",
      orgao:        o.orgaoEntidade?.nome || o.orgao || "",
      dataInicio:   o.dataInicioExercicio || "",
      dataFim:      o.dataFimExercicio || "",
    })),
    status: ocorrencias.length === 0 ? "ok" : "alerta",
  };
}

// ─── Bolsa Família / BPC — Benefícios por CPF ────────────────────────────────
export async function consultarBeneficios(cpf) {
  const doc = _clean(cpf);
  if (doc.length !== 11) return { fonte: "Benefícios — CGU", total: 0, ocorrencias: [], status: "ok" };
  const data = await _call("bolsa-familia-disponivel-por-cpf-ou-nis", {
    codigoCpfCpf: doc, pagina: 1, quantidade: 5,
  });
  const ocorrencias = Array.isArray(data) ? data : (data?.data || []);
  return {
    fonte:       "Bolsa Família — Portal Transparência",
    endpoint:    "bolsa-familia",
    total:       ocorrencias.length,
    ocorrencias: ocorrencias.map(o => ({
      nome:          o.titularBolsaFamilia?.nome || "",
      nis:           o.titularBolsaFamilia?.nis || "",
      municipio:     o.municipio?.nomeIBGE || "",
      uf:            o.municipio?.uf?.sigla || "",
      competencia:   o.dataCompetencia || "",
      valor:         o.valor || 0,
    })),
    status: "ok",
  };
}

// ─── CONSULTA NO BANCO LOCAL (populado pelo GitHub Actions) ───────────────────
async function _consultarBanco(cpfCnpj) {
  const doc = _clean(cpfCnpj);
  const url = new URL("/api/sanctions", window.location.origin);
  url.searchParams.set("cpfCnpj", doc);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  return res.json();
}

function _filtrarFonte(ocorrencias, fonte) {
  return (ocorrencias || []).filter(o => o.fonte === fonte).map(o => ({
    nome:             o.nome || "",
    sanção:           o.sancao || "",
    orgaoSancionador: o.orgao || "",
    esfera:           o.esfera || "",
    dataInicio:       o.data_inicio || "",
    dataFim:          o.data_fim || "",
    multa:            o.multa ? `R$ ${Number(o.multa).toLocaleString("pt-BR")}` : "",
  }));
}

const _V1 = (fonte) => ({
  fonte,
  status:   "indisponivel",
  mensagem: "Banco de sanções ainda não sincronizado — rodando cron semanal",
  total:    0,
  ocorrencias: [],
});

// ─── BUNDLE — roda todas as verificações em paralelo para um CPF ──────────────
export async function rodarVerificacoesCPF(cpf) {
  let banco = null;
  try { banco = await _consultarBanco(cpf); } catch {}

  const ocorrencias = banco?.ocorrencias || null;

  const _fonte = (nome, fonteLabel) => {
    if (!ocorrencias) return _V1(fonteLabel);
    const items = _filtrarFonte(ocorrencias, nome);
    return { fonte: fonteLabel, total: items.length, ocorrencias: items, status: items.length === 0 ? "ok" : "alerta" };
  };

  // MTE: combina Trabalho Escravo + CEAC no mesmo card
  const mteItems = [
    ..._filtrarFonte(ocorrencias, "MTE — Trabalho Escravo"),
    ..._filtrarFonte(ocorrencias, "CEAC — Ajustamento de Conduta MTE"),
  ];
  const mte = !ocorrencias ? _V1("MTE — Lista de Trabalho Escravo") : {
    fonte: "MTE — Lista de Trabalho Escravo",
    total: mteItems.length,
    ocorrencias: mteItems,
    status: mteItems.some(i => i.sanção?.includes("escravi")) ? "recusa" : mteItems.length > 0 ? "alerta" : "ok",
  };

  return {
    ceis:       _fonte("CEIS", "CEIS — CGU"),
    cnep:       _fonte("CNEP", "CNEP — CGU"),
    mte,
    pep:        _V1("PEP — Portal Transparência"),
    beneficios: _V1("Benefícios Sociais — CGU"),
  };
}

// ─── BUNDLE — roda todas as verificações em paralelo para um CNPJ ─────────────
export async function rodarVerificacoesCNPJ(cnpj) {
  let banco = null;
  try { banco = await _consultarBanco(cnpj); } catch {}

  const ocorrencias = banco?.ocorrencias || null;

  const _fonte = (nome, fonteLabel) => {
    if (!ocorrencias) return _V1(fonteLabel);
    const items = _filtrarFonte(ocorrencias, nome);
    return { fonte: fonteLabel, total: items.length, ocorrencias: items, status: items.length === 0 ? "ok" : "alerta" };
  };

  const mteItemsCnpj = [
    ..._filtrarFonte(ocorrencias, "MTE — Trabalho Escravo"),
    ..._filtrarFonte(ocorrencias, "CEAC — Ajustamento de Conduta MTE"),
  ];
  const mteCnpj = !ocorrencias ? _V1("MTE — Lista de Trabalho Escravo") : {
    fonte: "MTE — Lista de Trabalho Escravo",
    total: mteItemsCnpj.length,
    ocorrencias: mteItemsCnpj,
    status: mteItemsCnpj.some(i => i.sanção?.includes("escravi")) ? "recusa" : mteItemsCnpj.length > 0 ? "alerta" : "ok",
  };

  return {
    ceis:  _fonte("CEIS", "CEIS — CGU"),
    cnep:  _fonte("CNEP", "CNEP — CGU"),
    cepim: _V1("CEPIM — CGU"),
    mte:   mteCnpj,
  };
}
