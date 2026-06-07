import { useState, useCallback } from "react";
import { consultarCNPJ } from "./az_radar_api.js";
import {
  rodarVerificacoesCPF,
  rodarVerificacoesCNPJ,
} from "./az_radar_transparencia.js";
import { consultarProcessos } from "./az_radar_datajud.js";
import { consultarPGFN } from "./az_radar_pgfn.js";
import { consultarCNDT } from "./az_radar_cndt.js";

const C = {
  bg:"#F0F4F9", surface:"#FFFFFF", navy:"#0A1628", navyMid:"#1E3A5F",
  accent:"#1D55D4", accentBg:"#EBF1FF", border:"#DDE4EE",
  text:"#0D1B2E", textSub:"#3D5166", textMuted:"#7D90A5",
  green:"#0F7A3C", greenBg:"#EDFAF3", greenBorder:"#A3E8C0",
  red:"#B91C1C", redBg:"#FEF2F2", redBorder:"#FCA5A5",
  yellow:"#B45309", yellowBg:"#FFFBEB", yellowBorder:"#FCD34D",
  gray:"#64748B", grayBg:"#F8FAFC",
};

const PERFIS = [
  { id:"motorista",  emoji:"🚛", nome:"Motorista",          tipo:"cpf",  cor:"#EA580C", risco:"Crítico" },
  { id:"admin",      emoji:"💼", nome:"Administrativo",     tipo:"cpf",  cor:"#1D55D4", risco:"Médio" },
  { id:"confianca",  emoji:"👔", nome:"Cargo de Confiança", tipo:"cpf",  cor:"#7C3AED", risco:"Alto" },
  { id:"autonomo",   emoji:"🤝", nome:"Prestador / MEI",    tipo:"ambos",cor:"#059669", risco:"Médio-Alto" },
  { id:"empresa1",   emoji:"🏢", nome:"Empresa N1",         tipo:"cnpj", cor:"#0891B2", risco:"Médio" },
  { id:"empresa2",   emoji:"🏦", nome:"Empresa N2",         tipo:"cnpj", cor:"#DB2777", risco:"Alto" },
];

// Checks que serão executados por tipo de documento
const CHECKS_CPF  = ["CEIS — Impedimentos CGU","CNEP — Anticorrupção","Processos Judiciais — DataJud","PGFN — Dívida Ativa","CNDT — Débitos Trabalhistas","MTE — Trabalho Escravo","PEP — Pessoa Politicamente Exposta","Benefícios Sociais — CGU"];
const CHECKS_CNPJ = ["CNPJ — Receita Federal","Simples Nacional","CEIS — Impedimentos CGU","CNEP — Anticorrupção","Processos Judiciais — DataJud","PGFN — Dívida Ativa","CNDT — Débitos Trabalhistas","CEPIM — Convênios","MTE — Trabalho Escravo"];

function formatDoc(v, tipo) {
  const d = v.replace(/\D/g, "");
  if (tipo === "cpf") {
    if (d.length <= 3)  return d;
    if (d.length <= 6)  return `${d.slice(0,3)}.${d.slice(3)}`;
    if (d.length <= 9)  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`;
  }
  if (d.length <= 2)  return d;
  if (d.length <= 5)  return `${d.slice(0,2)}.${d.slice(2)}`;
  if (d.length <= 8)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
}

function detectTipo(v) {
  return v.replace(/\D/g, "").length <= 11 ? "cpf" : "cnpj";
}

// ─── Componente de resultado de uma verificação ───────────────────────────────
function CheckResult({ label, resultado }) {
  if (!resultado) return (
    <div style={{ display:"flex", gap:10, padding:"10px 14px", borderRadius:8, background:C.grayBg, border:`1px solid ${C.border}`, alignItems:"center" }}>
      <div style={{ width:22, height:22, borderRadius:"50%", background:C.border, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, flexShrink:0 }}>…</div>
      <span style={{ fontSize:12, color:C.textMuted }}>{label}</span>
    </div>
  );

  if (resultado.status === "indisponivel") return (
    <div style={{ display:"flex", gap:10, padding:"10px 14px", borderRadius:8, background:C.grayBg, border:`1px solid ${C.border}`, alignItems:"flex-start" }}>
      <div style={{ width:22, height:22, borderRadius:"50%", background:C.border, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, flexShrink:0, color:C.textMuted }}>🔒</div>
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:C.textSub }}>{label}</div>
        <div style={{ fontSize:10, color:C.textMuted, marginTop:2 }}>{resultado.mensagem}</div>
      </div>
    </div>
  );

  if (resultado.erro) return (
    <div style={{ display:"flex", gap:10, padding:"10px 14px", borderRadius:8, background:C.yellowBg, border:`1px solid ${C.yellowBorder}`, alignItems:"flex-start" }}>
      <div style={{ width:22, height:22, borderRadius:"50%", background:C.yellowBg, border:`1.5px solid ${C.yellowBorder}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:C.yellow, flexShrink:0 }}>!</div>
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{label}</div>
        <div style={{ fontSize:11, color:C.yellow, marginTop:2 }}>Indisponível — {resultado.erro}</div>
      </div>
    </div>
  );

  const isOk     = resultado.status === "ok";
  const isRecusa = resultado.status === "recusa";
  const cor      = isRecusa ? C.red    : isOk ? C.green    : C.yellow;
  const bg       = isRecusa ? C.redBg  : isOk ? C.greenBg  : C.yellowBg;
  const bd       = isRecusa ? C.redBorder : isOk ? C.greenBorder : C.yellowBorder;
  const icon     = isRecusa ? "✕" : isOk ? "✓" : "!";

  return (
    <div style={{ borderRadius:8, background:bg, border:`1px solid ${bd}`, overflow:"hidden" }}>
      <div style={{ display:"flex", gap:10, padding:"10px 14px", alignItems:"flex-start" }}>
        <div style={{ width:22, height:22, borderRadius:"50%", background:bg, border:`1.5px solid ${bd}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:cor, flexShrink:0, marginTop:1 }}>{icon}</div>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:6 }}>
            <span style={{ fontSize:12, fontWeight:700, color:C.text }}>{label}</span>
            <span style={{ fontSize:10, fontWeight:800, color:cor }}>{isOk ? "SEM OCORRÊNCIA" : isRecusa ? "OCORRÊNCIA — RECUSA" : `${resultado.total} OCORRÊNCIA${resultado.total !== 1 ? "S" : ""}`}</span>
          </div>
          <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{resultado.fonte}</div>
        </div>
      </div>

      {/* Detalhe das ocorrências */}
      {resultado.ocorrencias?.length > 0 && (
        <div style={{ borderTop:`1px solid ${bd}`, padding:"8px 14px 10px 46px" }}>
          {resultado.ocorrencias.slice(0,5).map((o, i) => (
            <div key={i} style={{ fontSize:11, color:C.text, padding:"6px 0", borderBottom: i < Math.min(resultado.ocorrencias.length,5)-1 ? `1px solid ${bd}` : "none" }}>
              <div style={{ fontWeight:700 }}>{String(o.nome || o.razaoSocial || o.entidade || "—")}</div>
              {o.cpfCnpj     && <div style={{ color:C.textMuted, fontFamily:"monospace", fontSize:10 }}>{String(o.cpfCnpj)}</div>}
              {o.tipo        && <div style={{ color:C.textSub, fontSize:10 }}>{String(o.tipo)}</div>}
              {o.sanção      && <div style={{ color:cor, fontWeight:600 }}>⚠ {String(o.sanção)}</div>}
              {o.impedimento && <div style={{ color:cor, fontWeight:600 }}>⚠ {String(o.impedimento)}</div>}
              {o.cargo       && <div style={{ color:C.textSub }}>Cargo: {String(o.cargo)}{o.orgao ? ` — ${String(o.orgao)}` : ""}</div>}
              {o.orgaoSancionador && <div style={{ color:C.textSub, fontSize:10 }}>Órgão: {String(o.orgaoSancionador)}{o.esfera ? ` (${String(o.esfera)})` : ""}</div>}
              {o.multa       && <div style={{ color:cor, fontSize:10 }}>Multa: {String(o.multa)}</div>}
              {o.numero      && <div style={{ color:C.textMuted, fontFamily:"monospace", fontSize:10 }}>{String(o.numero)}</div>}
              {o.classe      && <div style={{ color:C.textSub, fontSize:10 }}>Classe: {String(o.classe)}</div>}
              {o.assunto     && <div style={{ color:C.textSub, fontSize:10 }}>Assunto: {String(o.assunto)}</div>}
              {o.tribunal    && <div style={{ color:C.textSub, fontSize:10 }}>Tribunal: {String(o.tribunal)}</div>}
              {o.data        && <div style={{ color:C.textMuted, fontSize:10 }}>Ajuizamento: {String(o.data)}</div>}
              {o.situacao    && <div style={{ color:cor, fontWeight:600 }}>⚠ {String(o.situacao)}</div>}
              {o.validade    && <div style={{ color:C.textMuted, fontSize:10 }}>Validade: {String(o.validade)}</div>}
              {o.mensagem    && <div style={{ color:C.textSub, fontSize:10 }}>{String(o.mensagem)}</div>}
              {o.valor != null && o.valor > 0 && <div style={{ color:C.textSub }}>Valor: R$ {Number(o.valor).toLocaleString("pt-BR",{minimumFractionDigits:2})}</div>}
              {o.dataInicio  && <div style={{ color:C.textMuted, fontSize:10 }}>Início: {String(o.dataInicio)}{o.dataFim && o.dataFim !== "Sem informação" ? ` · Fim: ${String(o.dataFim)}` : " · Em vigor"}</div>}
            </div>
          ))}
          {resultado.ocorrencias.length > 5 && (
            <div style={{ fontSize:10, color:cor, marginTop:4, fontWeight:700 }}>+ {resultado.ocorrencias.length - 5} mais ocorrência(s)</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Resultado CNPJ ───────────────────────────────────────────────────────────
function CnpjCard({ data }) {
  if (!data) return null;
  const ok = (data.situacao || "").toLowerCase().includes("ativa");
  const bd = ok ? C.greenBorder : C.yellowBorder;
  const bg = ok ? C.greenBg : C.yellowBg;
  const cor = ok ? C.green : C.yellow;

  const cnaeFormatado = [data.cnaeCode, data.cnaeDesc].filter(Boolean).join(" — ") || "—";
  const capitalFormatado = data.capitalSocial > 0
    ? `R$ ${data.capitalSocial.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : "—";
  const endFormatado = [
    data.endereco?.logradouro,
    data.endereco?.numero,
    data.endereco?.bairro,
    data.endereco?.municipio && data.endereco?.uf
      ? `${data.endereco.municipio} / ${data.endereco.uf}`
      : (data.endereco?.municipio || data.endereco?.uf),
    data.endereco?.cep,
  ].filter(Boolean).join(", ") || "—";

  return (
    <div style={{ borderRadius:8, background:bg, border:`1px solid ${bd}`, padding:"12px 14px", marginBottom:0 }}>
      {/* Cabeçalho */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:C.text }}>{data.razaoSocial}</div>
          {data.nomeFantasia && <div style={{ fontSize:11, color:C.textSub }}>Fantasia: {data.nomeFantasia}</div>}
          <div style={{ fontSize:11, color:C.textSub, fontFamily:"monospace", marginTop:2 }}>
            {(data.cnpj || "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
          </div>
        </div>
        <span style={{ fontSize:10, fontWeight:800, padding:"3px 10px", borderRadius:20, background:bg, color:cor, border:`1.5px solid ${bd}`, whiteSpace:"nowrap" }}>
          {ok ? "✓" : "!"} {data.situacao || "—"}
        </span>
      </div>

      {/* Grid campos principais */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginTop:10 }}>
        {[
          { l:"Abertura",  v: data.abertura },
          { l:"Porte",     v: data.porte },
          { l:"Capital",   v: capitalFormatado },
          { l:"Natureza",  v: data.natureza },
          { l:"Regime",    v: data.regimeTributario || "Não optante" },
          { l:"Email",     v: data.email },
        ].map(f => (
          <div key={f.l} style={{ background:"rgba(255,255,255,0.65)", borderRadius:6, padding:"6px 8px" }}>
            <div style={{ fontSize:9, color:C.textMuted, textTransform:"uppercase", letterSpacing:1, fontWeight:700 }}>{f.l}</div>
            <div style={{ fontSize:10, color:C.text, fontWeight:600, marginTop:2, wordBreak:"break-word" }}>{f.v||"—"}</div>
          </div>
        ))}
      </div>

      {/* CNAE */}
      <div style={{ background:"rgba(255,255,255,0.55)", borderRadius:6, padding:"6px 8px", marginTop:6 }}>
        <div style={{ fontSize:9, color:C.textMuted, textTransform:"uppercase", letterSpacing:1, fontWeight:700 }}>CNAE Principal</div>
        <div style={{ fontSize:10, color:C.text, fontWeight:600, marginTop:2 }}>{cnaeFormatado}</div>
      </div>

      {/* Endereço */}
      {endFormatado !== "—" && (
        <div style={{ background:"rgba(255,255,255,0.55)", borderRadius:6, padding:"6px 8px", marginTop:6 }}>
          <div style={{ fontSize:9, color:C.textMuted, textTransform:"uppercase", letterSpacing:1, fontWeight:700 }}>Endereço</div>
          <div style={{ fontSize:10, color:C.text, fontWeight:600, marginTop:2 }}>{endFormatado}</div>
        </div>
      )}

      {/* QSA */}
      {data.socios?.length > 0 && (
        <div style={{ marginTop:8 }}>
          <div style={{ fontSize:9, color:C.textMuted, textTransform:"uppercase", letterSpacing:1, fontWeight:700, marginBottom:5 }}>QSA — {data.socios.length} sócio(s)</div>
          {data.socios.slice(0,5).map((s,i) => (
            <div key={i} style={{ fontSize:11, display:"flex", justifyContent:"space-between", background:"rgba(255,255,255,0.6)", borderRadius:6, padding:"4px 8px", marginBottom:3 }}>
              <span style={{ fontWeight:600, color:C.text }}>{s.nome}</span>
              <span style={{ color:C.textMuted }}>{s.qualificacao}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── VIEW PRINCIPAL ───────────────────────────────────────────────────────────
export default function ConsultaView({ mobile }) {
  const [doc,         setDoc]         = useState("");
  const [perfilId,    setPerfilId]    = useState(null);
  const [fase,        setFase]        = useState("form");     // form | loading | resultado
  const [progresso,   setProgresso]   = useState({});
  const [resultados,  setResultados]  = useState(null);
  const [cnpjData,    setCnpjData]    = useState(null);
  const [erro,        setErro]        = useState(null);

  const perfil = PERFIS.find(p => p.id === perfilId);
  const tipoPerfil = perfil?.tipo;
  const docLimpo = doc.replace(/\D/g, "");
  // "ambos" = Prestador/MEI aceita CPF (11) ou CNPJ (14)
  const docTipoReal = docLimpo.length <= 11 ? "cpf" : "cnpj";
  const docValido = tipoPerfil === "cpf"
    ? docLimpo.length === 11
    : tipoPerfil === "cnpj"
      ? docLimpo.length === 14
      : (docLimpo.length === 11 || docLimpo.length === 14);

  const handleDocChange = (e) => {
    const raw = e.target.value;
    const tipo = detectTipo(raw);
    const formatted = formatDoc(raw, tipo);
    // Limita ao tamanho máximo do formato
    const maxLen = tipo === "cpf" ? 14 : 18;
    setDoc(formatted.slice(0, maxLen));
  };

  const iniciarConsulta = useCallback(async () => {
    if (!perfilId || !docValido) return;
    setFase("loading");
    setErro(null);
    setProgresso({});
    setResultados(null);
    setCnpjData(null);

    // Para perfil "ambos" (MEI/Prestador) usa o tipo detectado do documento
    const tipoReal = tipoPerfil === "ambos" ? docTipoReal : tipoPerfil;
    const checks = tipoReal === "cnpj" ? CHECKS_CNPJ : CHECKS_CPF;
    const prog = {};
    checks.forEach(c => { prog[c] = "pendente"; });
    setProgresso({ ...prog });

    try {
      if (tipoReal === "cnpj") {
        // CNPJ RF primeiro
        setProgresso(p => ({ ...p, "CNPJ — Receita Federal": "loading", "Simples Nacional": "loading" }));
        const cnpj = await consultarCNPJ(docLimpo).catch(e => { throw e; });
        setCnpjData(cnpj);
        setProgresso(p => ({ ...p, "CNPJ — Receita Federal": "ok", "Simples Nacional": "ok" }));

        // Portal Transparência em paralelo
        const keys = ["CEIS — Impedimentos CGU","CNEP — Anticorrupção","Processos Judiciais — DataJud","CEPIM — Convênios","MTE — Trabalho Escravo"];
        keys.forEach(k => setProgresso(p => ({ ...p, [k]: "loading" })));

        const [res, processos, pgfn, cndt] = await Promise.all([
          rodarVerificacoesCNPJ(docLimpo),
          consultarProcessos(docLimpo).catch(() => ({ status:"erro", erro:"Indisponível", total:0, ocorrencias:[] })),
          consultarPGFN(docLimpo).catch(() => ({ status:"erro", erro:"Indisponível", total:0, ocorrencias:[] })),
          consultarCNDT(docLimpo).catch(() => ({ status:"erro", erro:"Indisponível", total:0, ocorrencias:[] })),
        ]);
        const map = {
          "CEIS — Impedimentos CGU":      res.ceis,
          "CNEP — Anticorrupção":         res.cnep,
          "Processos Judiciais — DataJud":processos,
          "PGFN — Dívida Ativa":          pgfn,
          "CNDT — Débitos Trabalhistas":  cndt,
          "CEPIM — Convênios":            res.cepim,
          "MTE — Trabalho Escravo":       res.mte,
        };
        keys.forEach(k => setProgresso(p => ({ ...p, [k]: map[k]?.erro ? "erro" : "ok" })));
        setResultados(map);
      } else {
        const keys = CHECKS_CPF;
        keys.forEach(k => setProgresso(p => ({ ...p, [k]: "loading" })));
        const [res, processos, pgfn, cndt] = await Promise.all([
          rodarVerificacoesCPF(docLimpo),
          consultarProcessos(docLimpo).catch(() => ({ status:"erro", erro:"Indisponível", total:0, ocorrencias:[] })),
          consultarPGFN(docLimpo).catch(() => ({ status:"erro", erro:"Indisponível", total:0, ocorrencias:[] })),
          consultarCNDT(docLimpo).catch(() => ({ status:"erro", erro:"Indisponível", total:0, ocorrencias:[] })),
        ]);
        const map = {
          "CEIS — Impedimentos CGU":           res.ceis,
          "CNEP — Anticorrupção":              res.cnep,
          "Processos Judiciais — DataJud":     processos,
          "PGFN — Dívida Ativa":              pgfn,
          "CNDT — Débitos Trabalhistas":       cndt,
          "MTE — Trabalho Escravo":            res.mte,
          "PEP — Pessoa Politicamente Exposta":res.pep,
          "Benefícios Sociais — CGU":          res.beneficios,
        };
        keys.forEach(k => setProgresso(p => ({ ...p, [k]: map[k]?.erro ? "erro" : "ok" })));
        setResultados(map);
      }
      setFase("resultado");
    } catch (e) {
      setErro(e.message || "Erro na consulta");
      setFase("form");
    }
  }, [perfilId, docLimpo, tipoPerfil, docTipoReal, docValido]);

  const resetar = () => { setFase("form"); setDoc(""); setPerfilId(null); };

  // ── TELA DE FORMULÁRIO ──────────────────────────────────────────────────────
  if (fase === "form") return (
    <div style={{ padding: mobile ? "16px 12px" : "32px 24px", maxWidth: 700, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>Nova Consulta</h2>
        <p style={{ fontSize: 13, color: C.textMuted }}>Selecione o perfil e informe o CPF ou CNPJ para iniciar a análise.</p>
      </div>

      {erro && (
        <div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.red, marginBottom: 16 }}>
          ✕ {erro}
        </div>
      )}

      {/* Seletor de perfil */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
          Perfil de análise
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 8 }}>
          {PERFIS.map(p => {
            const ativo = perfilId === p.id;
            return (
              <button key={p.id} onClick={() => { setPerfilId(p.id); setDoc(""); }}
                style={{ padding: "12px 14px", borderRadius: 10, border: `2px solid ${ativo ? p.cor : C.border}`, background: ativo ? `${p.cor}12` : C.surface, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{p.emoji}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: ativo ? p.cor : C.text }}>{p.nome}</div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{p.tipo.toUpperCase()} · Risco {p.risco}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Input documento */}
      {perfilId && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
            {tipoPerfil === "cpf" ? "CPF do candidato" : tipoPerfil === "cnpj" ? "CNPJ da empresa" : "CPF ou CNPJ"}
          </div>
          <input
            value={doc}
            onChange={handleDocChange}
            onKeyDown={e => e.key === "Enter" && docValido && iniciarConsulta()}
            placeholder={tipoPerfil === "cpf" ? "000.000.000-00" : tipoPerfil === "cnpj" ? "00.000.000/0001-00" : "CPF ou CNPJ"}
            style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `2px solid ${docValido ? C.green : C.border}`, fontSize: 15, fontFamily: "monospace", outline: "none", background: C.surface, transition: "border-color 0.15s" }}
          />
          {docValido && (
            <div style={{ fontSize: 11, color: C.green, marginTop: 6, fontWeight: 600 }}>✓ Formato válido</div>
          )}
        </div>
      )}

      {/* Prévia das verificações */}
      {perfilId && (
        <div style={{ background: C.grayBg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
            Verificações que serão executadas
          </div>
          {(tipoPerfil === "cnpj" ? CHECKS_CNPJ : CHECKS_CPF).map(c => (
            <div key={c} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 12, color: C.textSub }}>
              <span style={{ color: C.green, fontSize: 13 }}>✓</span> {c}
            </div>
          ))}
          <div style={{ marginTop: 8, fontSize: 10, color: C.textMuted }}>
            Fontes: Receita Federal · Portal da Transparência (CGU) · Dados V0 gratuitos
          </div>
        </div>
      )}

      <button
        onClick={iniciarConsulta}
        disabled={!perfilId || !docValido}
        style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: perfilId && docValido ? C.accent : C.border, color: perfilId && docValido ? "#fff" : C.textMuted, fontSize: 14, fontWeight: 800, cursor: perfilId && docValido ? "pointer" : "not-allowed", letterSpacing: 0.5 }}>
        Iniciar Análise
      </button>
    </div>
  );

  // ── TELA DE LOADING ─────────────────────────────────────────────────────────
  if (fase === "loading") return (
    <div style={{ padding: mobile ? "16px 12px" : "40px 24px", maxWidth: 520, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>{perfil?.emoji}</div>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 4 }}>Consultando fontes oficiais…</h2>
        <p style={{ fontSize: 12, color: C.textMuted }}>{tipoPerfil?.toUpperCase()} {doc}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Object.entries(progresso).map(([check, estado]) => {
          const cor   = estado === "ok" ? C.green : estado === "erro" ? C.yellow : estado === "loading" ? C.accent : C.gray;
          const bg    = estado === "ok" ? C.greenBg : estado === "erro" ? C.yellowBg : estado === "loading" ? C.accentBg : C.grayBg;
          const icon  = estado === "ok" ? "✓" : estado === "erro" ? "!" : estado === "loading" ? "⟳" : "·";
          return (
            <div key={check} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: bg, border: `1px solid ${cor}30` }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: cor, width: 18, textAlign: "center", flexShrink: 0,
                animation: estado === "loading" ? "spin 1s linear infinite" : "none" }}>{icon}</span>
              <span style={{ fontSize: 12, color: estado === "loading" ? C.accent : C.textSub, fontWeight: estado === "loading" ? 700 : 400 }}>{check}</span>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </div>
  );

  // ── TELA DE RESULTADO ───────────────────────────────────────────────────────
  const todasOk    = resultados && Object.values(resultados).every(r => r.status === "ok");
  const temRecusa  = resultados && Object.values(resultados).some(r => r.status === "recusa");
  const statusGeral = temRecusa ? "recusa" : todasOk ? "ok" : "alerta";
  const sgCor   = statusGeral === "recusa" ? C.red    : statusGeral === "ok" ? C.green    : C.yellow;
  const sgBg    = statusGeral === "recusa" ? C.redBg  : statusGeral === "ok" ? C.greenBg  : C.yellowBg;
  const sgBd    = statusGeral === "recusa" ? C.redBorder : statusGeral === "ok" ? C.greenBorder : C.yellowBorder;
  const sgLabel = statusGeral === "recusa" ? "RECUSADO" : statusGeral === "ok" ? "APROVADO" : "ATENÇÃO";
  const sgEmoji = statusGeral === "recusa" ? "❌" : statusGeral === "ok" ? "✅" : "⚠️";

  return (
    <div style={{ padding: mobile ? "14px 12px" : "24px 24px", maxWidth: 700, margin: "0 auto" }}>
      {/* Header resultado */}
      <div style={{ background: C.navy, borderRadius: 12, padding: mobile ? "16px" : "18px 24px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginBottom: 3 }}>
            {perfil?.emoji} {perfil?.nome} · {tipoPerfil?.toUpperCase()} {doc}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>
            {cnpjData ? cnpjData.razaoSocial : "Análise CPF"}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
            {new Date().toLocaleString("pt-BR")} · Fontes V0 gratuitas
          </div>
        </div>
        <div style={{ background: sgBg, border: `1.5px solid ${sgBd}`, borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 22 }}>{sgEmoji}</div>
          <div style={{ fontSize: 11, fontWeight: 800, color: sgCor }}>{sgLabel}</div>
        </div>
      </div>

      {/* Dados CNPJ RF */}
      {cnpjData && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
            📋 Receita Federal — Dados Cadastrais
          </div>
          <CnpjCard data={cnpjData} />
        </div>
      )}

      {/* Verificações Portal Transparência */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
          🏛️ Portal da Transparência — CGU
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {resultados && Object.entries(resultados).map(([label, res]) => (
            <CheckResult key={label} label={label} resultado={res} />
          ))}
        </div>
      </div>

      {/* Fontes pendentes de integração */}
      <div style={{ background: C.grayBg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
          ⏳ Verificações adicionais (V1/V3 — requerem parceiro)
        </div>
        {["BNMP — Mandados de Prisão (CNJ)", "Antecedentes Criminais — SSPs"].map(c => (
          <div key={c} style={{ fontSize: 12, color: C.textMuted, padding: "4px 0", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: C.textMuted }}>○</span> {c}
          </div>
        ))}
      </div>

      {/* Ações */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={resetar} style={{ padding: "10px 18px", borderRadius: 8, border: `1.5px solid ${C.accent}30`, background: C.accentBg, color: C.accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          ← Nova Consulta
        </button>
        <button onClick={() => window.print()} style={{ padding: "10px 18px", borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.surface, color: C.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          📄 Imprimir
        </button>
      </div>
    </div>
  );
}
