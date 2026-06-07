// ─── AZRadar — Camada de APIs ──────────────────────────────────────────────────
// Para configurar uma API: altere apenas API_REGISTRY abaixo.
// Nunca altere o código de negócio para ajustar URLs ou tokens.

// ─── REGISTRY ─────────────────────────────────────────────────────────────────
export const API_REGISTRY = {
  cnpj_receita: {
    id:            "cnpj_receita",
    label:         "CNPJ — Receita Federal (publica.cnpj.ws)",
    version:       "V0",
    enabled:       true,
    baseUrl:       "https://publica.cnpj.ws/cnpj",
    timeout:       8_000,
    retries:       2,
    rateLimit:     { max: 3, windowMs: 60_000 },  // 3 req/min — limite da API pública
    cacheTtl:      86_400,                         // 24h — CNPJ não muda todo dia
    mock:          false,
    requiresProxy: false,
    healthCnpj:    "00000000000191",               // CNPJ da própria Receita Federal
  },
  cnpj_receita_fallback: {
    id:            "cnpj_receita_fallback",
    label:         "CNPJ — ReceitaWS (fallback)",
    version:       "V0",
    enabled:       true,
    baseUrl:       "https://receitaws.com.br/v1/cnpj",
    timeout:       10_000,
    retries:       1,
    rateLimit:     { max: 3, windowMs: 60_000 },
    cacheTtl:      86_400,
    mock:          false,
    requiresProxy: false,
    healthCnpj:    "00000000000191",
  },
  ceis_cgu: {
    id:            "ceis_cgu",
    label:         "CEIS — CGU (Empresas Inidôneas)",
    version:       "V0",
    enabled:       false,
    baseUrl:       "https://api.portaldatransparencia.gov.br/api-de-dados/ceis",
    timeout:       10_000,
    retries:       1,
    rateLimit:     { max: 30, windowMs: 60_000 },
    cacheTtl:      3_600,
    mock:          false,
    requiresProxy: true,
    apiKeyHeader:  "chave-api-dados-abertos",
    apiKey:        "",                             // preencher com a chave CGU
  },
  cndt_tst: {
    id:            "cndt_tst",
    label:         "CNDT — Débitos Trabalhistas (TST)",
    version:       "V0",
    enabled:       false,
    baseUrl:       "https://cndt-certidao.tst.jus.br",
    timeout:       15_000,
    retries:       1,
    rateLimit:     { max: 5, windowMs: 60_000 },
    cacheTtl:      86_400,
    mock:          false,
    requiresProxy: true,
  },
  pgfn_divida: {
    id:            "pgfn_divida",
    label:         "PGFN — Dívida Ativa da União",
    version:       "V0",
    enabled:       false,
    baseUrl:       "https://www.regularize.pgfn.gov.br",
    timeout:       12_000,
    retries:       1,
    rateLimit:     { max: 5, windowMs: 60_000 },
    cacheTtl:      86_400,
    mock:          false,
    requiresProxy: true,
  },
  portal_transparencia: {
    id:            "portal_transparencia",
    label:         "Portal Transparência — CGU",
    version:       "V0",
    enabled:       false,
    baseUrl:       "https://api.portaldatransparencia.gov.br/api-de-dados",
    timeout:       10_000,
    retries:       1,
    rateLimit:     { max: 30, windowMs: 60_000 },
    cacheTtl:      3_600,
    mock:          false,
    requiresProxy: true,
    apiKeyHeader:  "chave-api-dados-abertos",
    apiKey:        "",
  },
  bnmp_cnj: {
    id:            "bnmp_cnj",
    label:         "BNMP — Mandados de Prisão (CNJ)",
    version:       "V0",
    enabled:       false,
    baseUrl:       "https://bnmp.cnj.jus.br/api",
    timeout:       12_000,
    retries:       1,
    rateLimit:     { max: 10, windowMs: 60_000 },
    cacheTtl:      3_600,
    mock:          false,
    requiresProxy: true,
  },
  simples_nacional: {
    id:            "simples_nacional",
    label:         "Simples Nacional — Receita Federal",
    version:       "V0",
    enabled:       false,
    baseUrl:       "https://www8.receita.fazenda.gov.br/SimplesNacional",
    timeout:       10_000,
    retries:       1,
    rateLimit:     { max: 5, windowMs: 60_000 },
    cacheTtl:      86_400,
    mock:          false,
    requiresProxy: true,
  },
  rntrc_antt: {
    id:            "rntrc_antt",
    label:         "RNTRC — Registro ANTT",
    version:       "V0",
    enabled:       false,
    baseUrl:       "https://www.antt.gov.br/rntrc",
    timeout:       10_000,
    retries:       1,
    rateLimit:     { max: 5, windowMs: 60_000 },
    cacheTtl:      86_400,
    mock:          false,
    requiresProxy: true,
  },
};

// ─── LOG ──────────────────────────────────────────────────────────────────────
const LOG_KEY = "azradar_api_log";
const MAX_LOG = 500;

function _getLog() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); }
  catch { return []; }
}

function _appendLog(entry) {
  const log = _getLog();
  log.unshift({ ...entry, ts: new Date().toISOString() });
  if (log.length > MAX_LOG) log.length = MAX_LOG;
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch {}
}

export function getApiLog(limit = 100) {
  return _getLog().slice(0, limit);
}

export function clearApiLog() {
  localStorage.removeItem(LOG_KEY);
}

// ─── CACHE ────────────────────────────────────────────────────────────────────
const CACHE_KEY = "azradar_api_cache";

function _getCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); }
  catch { return {}; }
}

function _getCached(apiId, key) {
  const entry = _getCache()[`${apiId}:${key}`];
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry.data;
}

function _setCache(apiId, key, data, ttlSeconds) {
  const c = _getCache();
  c[`${apiId}:${key}`] = { data, expiresAt: Date.now() + ttlSeconds * 1000 };
  // Prune expired antes de salvar
  for (const k of Object.keys(c)) {
    if (Date.now() > c[k].expiresAt) delete c[k];
  }
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {}
}

export function clearApiCache() {
  localStorage.removeItem(CACHE_KEY);
}

export function getCacheStats() {
  const c = _getCache();
  const entries = Object.entries(c);
  const valid = entries.filter(([, v]) => Date.now() <= v.expiresAt);
  return { total: entries.length, valid: valid.length, expired: entries.length - valid.length };
}

// ─── CIRCUIT BREAKER ──────────────────────────────────────────────────────────
const CB_KEY       = "azradar_cb";
const CB_THRESHOLD = 3;       // falhas consecutivas para abrir o circuit
const CB_HALF_OPEN = 300_000; // 5 min antes de tentar novamente (half-open)

function _getCB() {
  try { return JSON.parse(localStorage.getItem(CB_KEY) || "{}"); }
  catch { return {}; }
}

function _saveCB(cb) {
  try { localStorage.setItem(CB_KEY, JSON.stringify(cb)); } catch {}
}

function _cbIsOpen(apiId) {
  const cb = _getCB()[apiId];
  if (!cb || cb.state !== "open") return false;
  // Tenta half-open após tempo de espera
  if (Date.now() - cb.openedAt > CB_HALF_OPEN) {
    const all = _getCB();
    all[apiId] = { ...cb, state: "half-open" };
    _saveCB(all);
    return false;
  }
  return true;
}

function _cbSuccess(apiId) {
  const all = _getCB();
  all[apiId] = { state: "closed", failures: 0 };
  _saveCB(all);
}

function _cbFailure(apiId) {
  const all = _getCB();
  const prev = all[apiId] || { state: "closed", failures: 0 };
  const failures = (prev.failures || 0) + 1;
  all[apiId] = failures >= CB_THRESHOLD
    ? { state: "open", failures, openedAt: Date.now() }
    : { state: "closed", failures };
  _saveCB(all);
}

export function getCircuitBreakerState() {
  return _getCB();
}

export function resetCircuitBreaker(apiId) {
  const all = _getCB();
  if (apiId) { delete all[apiId]; }
  else { Object.keys(all).forEach(k => delete all[k]); }
  _saveCB(all);
}

// ─── RATE LIMITER ─────────────────────────────────────────────────────────────
const RL_KEY = "azradar_rl";

function _checkRateLimit(apiId, cfg) {
  if (!cfg.rateLimit) return true;
  try {
    const rl = JSON.parse(localStorage.getItem(RL_KEY) || "{}");
    const now = Date.now();
    const bucket = rl[apiId] || { calls: [] };
    const { max, windowMs } = cfg.rateLimit;
    const valid = bucket.calls.filter(t => now - t < windowMs);
    if (valid.length >= max) return false;
    valid.push(now);
    rl[apiId] = { calls: valid };
    localStorage.setItem(RL_KEY, JSON.stringify(rl));
    return true;
  } catch { return true; }
}

// ─── FETCH COM TIMEOUT ────────────────────────────────────────────────────────
async function _fetchTimeout(url, options, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function _fetchWithRetry(url, options, cfg) {
  const retries = cfg.retries ?? 1;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt));
    try {
      const res = await _fetchTimeout(url, options, cfg.timeout);
      if (res.ok) return res;
      // 4xx não retenta (exceto 429)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw Object.assign(new Error(`HTTP ${res.status}`), { httpCode: res.status });
      }
      lastErr = Object.assign(new Error(`HTTP ${res.status}`), { httpCode: res.status });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// ─── PARSE CNPJ — normaliza dois formatos:
//   publica.cnpj.ws  → dados aninhados em json.estabelecimento
//   receitaws / outros → dados planos no json raiz
function _str(v) { return (typeof v === "object" && v !== null) ? (v.descricao || v.nome || v.sigla || v.text || "") : (v || ""); }

function _parseCNPJ(json) {
  // publica.cnpj.ws usa estabelecimento; demais são planos
  const e = json.estabelecimento || json;

  const socios = (json.qsa || json.socios || []).map(s => ({
    nome:          s.nome_socio || s.nome || "",
    qualificacao:  _str(s.qualificacao_socio) || s.descricao_qualificacao_socio || s.qual || "",
    cpfCnpj:       s.cnpj_cpf_do_socio || s.cpf_cnpj_socio || "",
    dataEntrada:   s.data_entrada || "",
    faixaEtaria:   s.faixa_etaria || "",
  }));

  // CNAE principal
  const cnaeObj  = e.atividade_principal || json.cnae_fiscal_principal;
  const cnaeCode = String(e.cnae_fiscal || cnaeObj?.id || json.cnae_fiscal || "");
  const cnaeDesc = e.cnae_fiscal_descricao || cnaeObj?.descricao || json.cnae_fiscal_descricao || "";

  // Simples / MEI
  const simples = json.simples || {};
  const regimeTributario = simples.mei === "Sim" ? "MEI"
    : simples.simples === "Sim" ? "Simples Nacional"
    : "";

  return {
    cnpj:            e.cnpj || json.cnpj || json.CNPJ || "",
    razaoSocial:     json.razao_social || json.nome || "",
    nomeFantasia:    e.nome_fantasia || json.nome_fantasia || json.fantasia || "",
    situacao:        _str(e.situacao_cadastral) || json.descricao_situacao_cadastral || json.situacao || "",
    dataSituacao:    e.data_situacao_cadastral || json.data_situacao_cadastral || json.data_situacao || "",
    porte:           _str(json.porte) || json.descricao_porte || "",
    capitalSocial:   parseFloat(json.capital_social) || 0,
    natureza:        _str(json.natureza_juridica) || json.descricao_natureza_juridica || "",
    abertura:        e.data_inicio_atividade || json.data_inicio_atividade || json.abertura || "",
    cnaeCode,
    cnaeDesc,
    regimeTributario,
    simplesOpcao:    simples.data_opcao_simples || "",
    simplesExclusao: simples.data_exclusao_simples || "",
    socios,
    email:           e.email || json.email || "",
    telefone:        e.ddd1 && e.telefone1
                       ? `(${e.ddd1}) ${e.telefone1}`.trim()
                       : json.ddd_telefone_1
                         ? `(${json.ddd_telefone_1}) ${json.telefone_1 || ""}`.trim()
                         : (json.telefone || ""),
    endereco: {
      logradouro: [e.tipo_logradouro, e.logradouro].filter(Boolean).join(" ") || json.logradouro || "",
      numero:     e.numero || json.numero || "",
      bairro:     e.bairro || json.bairro || "",
      municipio:  _str(e.cidade) || _str(json.municipio) || json.descricao_municipio || "",
      uf:         _str(e.estado) || _str(json.uf) || "",
      cep:        (e.cep || json.cep || "").replace(/\D/g, "").replace(/(\d{5})(\d{3})/, "$1-$2"),
    },
    _raw: json,
  };
}

// ─── CALL PRINCIPAL ───────────────────────────────────────────────────────────
export async function callApi(apiId, params = {}) {
  const cfg = API_REGISTRY[apiId];
  if (!cfg)             throw new Error(`API desconhecida: ${apiId}`);
  if (!cfg.enabled)     throw Object.assign(new Error("API desabilitada"), { code: "DISABLED" });
  if (cfg.requiresProxy)throw Object.assign(new Error("Requer proxy backend"), { code: "PROXY_REQUIRED" });
  if (_cbIsOpen(apiId)) throw Object.assign(new Error("Circuit breaker aberto — API instável"), { code: "CIRCUIT_OPEN" });
  if (!_checkRateLimit(apiId, cfg)) throw Object.assign(new Error("Rate limit atingido"), { code: "RATE_LIMIT" });

  const cacheKey = JSON.stringify(params);
  const cached   = _getCached(apiId, cacheKey);
  if (cached) {
    _appendLog({ api: apiId, status: "cache", latencyMs: 0, params: _safeParams(params) });
    return cached;
  }

  const path = Object.values(params).join("/");
  const url  = `${cfg.baseUrl}/${path}`;
  const t0   = Date.now();

  try {
    const res  = await _fetchWithRetry(url, { headers: cfg.headers || {} }, cfg);
    const data = await res.json();
    const ms   = Date.now() - t0;
    _cbSuccess(apiId);
    _setCache(apiId, cacheKey, data, cfg.cacheTtl);
    _appendLog({ api: apiId, status: "ok", latencyMs: ms, httpCode: res.status, params: _safeParams(params) });
    return data;
  } catch (e) {
    const ms   = Date.now() - t0;
    const code = e.code || (e.name === "AbortError" ? "TIMEOUT" : "ERROR");
    _cbFailure(apiId);
    _appendLog({ api: apiId, status: "fail", latencyMs: ms, code, error: e.message, params: _safeParams(params) });
    throw e;
  }
}

function _safeParams(params) {
  const s = JSON.stringify(params);
  if (s.length <= 8) return s;
  return s.slice(0, 3) + "***" + s.slice(-3);
}

// ─── CONSULTAR CNPJ (API pública — V0) ───────────────────────────────────────
export async function consultarCNPJ(cnpj) {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) throw new Error("CNPJ deve ter 14 dígitos");

  // Cache próprio (independe do callApi para usar cacheKey = cnpj limpo)
  const cached = _getCached("cnpj_receita", clean);
  if (cached) return _parseCNPJ(cached);

  // Tenta primário → fallback
  for (const apiId of ["cnpj_receita", "cnpj_receita_fallback"]) {
    try {
      const raw = await callApi(apiId, { cnpj: clean });
      _setCache("cnpj_receita", clean, raw, API_REGISTRY.cnpj_receita.cacheTtl);
      return _parseCNPJ(raw);
    } catch (e) {
      if (apiId === "cnpj_receita_fallback") throw e;
      // continua para fallback
    }
  }
}

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
const HEALTH_KEY = "azradar_health";

export async function runHealthCheck() {
  const results = {};

  for (const [id, cfg] of Object.entries(API_REGISTRY)) {
    if (cfg.requiresProxy || !cfg.enabled) {
      results[id] = {
        id, label: cfg.label, version: cfg.version,
        status: cfg.requiresProxy ? "proxy_required" : "disabled",
        latencyMs: null, ts: new Date().toISOString(),
      };
      continue;
    }

    const cnpj = cfg.healthCnpj || "00000000000191";
    const url  = `${cfg.baseUrl}/${cnpj}`;
    const t0   = Date.now();
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), cfg.timeout);
      const res   = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      const ms = Date.now() - t0;
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { httpCode: res.status });
      results[id] = {
        id, label: cfg.label, version: cfg.version,
        status: ms > 5_000 ? "slow" : "ok",
        latencyMs: ms, ts: new Date().toISOString(), httpCode: res.status,
      };
      _cbSuccess(id);
    } catch (e) {
      const ms = Date.now() - t0;
      results[id] = {
        id, label: cfg.label, version: cfg.version,
        status:    e.name === "AbortError" ? "timeout" : "fail",
        latencyMs: ms, ts: new Date().toISOString(),
        error:     e.message, httpCode: e.httpCode,
      };
      _cbFailure(id);
    }
  }

  const report = { ts: new Date().toISOString(), results };
  try { localStorage.setItem(HEALTH_KEY, JSON.stringify(report)); } catch {}
  _appendLog({ api: "_health_check", status: "run", summary: _summarizeHealth(results) });
  return report;
}

export function getLastHealthCheck() {
  try { return JSON.parse(localStorage.getItem(HEALTH_KEY)); }
  catch { return null; }
}

function _summarizeHealth(results) {
  const vals = Object.values(results);
  return {
    ok:    vals.filter(r => r.status === "ok").length,
    slow:  vals.filter(r => r.status === "slow").length,
    fail:  vals.filter(r => ["fail", "timeout"].includes(r.status)).length,
    proxy: vals.filter(r => r.status === "proxy_required").length,
    dis:   vals.filter(r => r.status === "disabled").length,
  };
}

export function getHealthSummary() {
  const h = getLastHealthCheck();
  if (!h) return null;
  return { ts: h.ts, ..._summarizeHealth(h.results), results: h.results };
}
