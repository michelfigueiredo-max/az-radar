import { useState, useMemo, useEffect, useCallback, Component } from "react";
import {
  consultarCNPJ, runHealthCheck, getLastHealthCheck,
  getApiLog, clearApiLog, API_REGISTRY,
  getCircuitBreakerState, resetCircuitBreaker, clearApiCache, getCacheStats,
} from "./az_radar_api.js";
import ConsultaView from "./ConsultaView.jsx";

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 32, fontFamily: "monospace", color: "#B91C1C", background: "#FEF2F2", minHeight: "100vh" }}>
        <h2 style={{ marginBottom: 12 }}>Erro na aplicação</h2>
        <pre style={{ fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{String(this.state.error)}</pre>
        <pre style={{ fontSize: 11, marginTop: 12, color: "#7D90A5", whiteSpace: "pre-wrap" }}>{this.state.error?.stack}</pre>
        <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: "8px 16px", cursor: "pointer" }}>Tentar novamente</button>
      </div>
    );
    return this.props.children;
  }
}

const C = {
  bg:"#F0F4F9", surface:"#FFFFFF", navy:"#0A1628", navyMid:"#1E3A5F",
  accent:"#1D55D4", accentBg:"#EBF1FF", border:"#DDE4EE",
  text:"#0D1B2E", textSub:"#3D5166", textMuted:"#7D90A5",
  v0:"#0F7A3C", v0bg:"#EDFAF3", v0border:"#A3E8C0",
  v2:"#B45309", v2bg:"#FFFBEB", v2border:"#FCD34D",
  v3:"#7C3AED", v3bg:"#F5F3FF", v3border:"#C4B5FD",
  green:"#0F7A3C", greenBg:"#EDFAF3", greenBorder:"#A3E8C0",
  red:"#B91C1C", redBg:"#FEF2F2", redBorder:"#FCA5A5",
  yellow:"#B45309", yellowBg:"#FFFBEB", yellowBorder:"#FCD34D",
  gray:"#64748B", grayBg:"#F8FAFC",
};

function useIsMobile() {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth < 640 : false);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return m;
}

function AZLogo({ dark = false, size = "md" }) {
  const s = size === "lg" ? 1.5 : size === "sm" ? 0.72 : 1;
  const w = Math.round(36 * s);
  const fg = dark ? "#FFFFFF" : C.navy;
  const ac = dark ? "#60A5FA" : C.accent;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:Math.round(9*s) }}>
      <svg width={w} height={w} viewBox="0 0 36 36" fill="none" style={{ flexShrink:0 }}>
        <circle cx="15" cy="15" r="12.5" stroke={ac} strokeWidth="1.2" strokeDasharray="2.5 2" opacity="0.25"/>
        <circle cx="15" cy="15" r="8"   stroke={ac} strokeWidth="1.2" strokeDasharray="2.5 2" opacity="0.45"/>
        <circle cx="15" cy="15" r="10"  stroke={ac} strokeWidth="2.2"/>
        <circle cx="15" cy="15" r="3.2" fill={ac} opacity="0.2"/>
        <circle cx="15" cy="15" r="1.8" fill={ac}/>
        <line x1="15" y1="4"    x2="15" y2="7.5"  stroke={ac} strokeWidth="1.6" strokeLinecap="round"/>
        <line x1="15" y1="22.5" x2="15" y2="26"   stroke={ac} strokeWidth="1.6" strokeLinecap="round"/>
        <line x1="4"  y1="15"   x2="7.5"  y2="15" stroke={ac} strokeWidth="1.6" strokeLinecap="round"/>
        <line x1="22.5" y1="15" x2="26"  y2="15"  stroke={ac} strokeWidth="1.6" strokeLinecap="round"/>
        <line x1="23"  y1="23"  x2="32"  y2="32"  stroke={ac} strokeWidth="2.6" strokeLinecap="round"/>
      </svg>
      <div style={{ lineHeight:1, display:"flex", flexDirection:"column", gap:Math.round(2*s) }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:1 }}>
          <span style={{ fontSize:Math.round(20*s), fontWeight:900, color:fg, fontFamily:"'Barlow Condensed','Impact',sans-serif", letterSpacing:-0.5 }}>AZ</span>
          <span style={{ fontSize:Math.round(20*s), fontWeight:800, color:ac, fontFamily:"'Barlow Condensed','Impact',sans-serif", letterSpacing:-0.5 }}>Radar</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:Math.round(4*s), fontSize:Math.round(8*s), fontWeight:700, letterSpacing:Math.round(1.4*s), textTransform:"uppercase", color:dark?"rgba(255,255,255,0.5)":C.textMuted }}>
          <span>BUSCA</span>
          <svg width={Math.round(28*s)} height={Math.round(10*s)} viewBox="0 0 28 10" fill="none">
            <path d="M2 7 Q14 0 26 7" stroke={ac} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <polyline points="22,5 26,7 24,10.5" stroke={ac} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="2" cy="7" r="1.4" fill={ac}/>
            <text x="0" y="10.5" fontSize="5.5" fontWeight="900" fill={ac} fontFamily="sans-serif">A</text>
            <text x="22.5" y="10.5" fontSize="5.5" fontWeight="900" fill={ac} fontFamily="sans-serif">Z</text>
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─── DADOS COMPLETOS ──────────────────────────────────────────────────────────
const PERFIL_META = {
  motorista: { nome:"Motorista", emoji:"🚛", cor:"#EA580C" },
  admin:     { nome:"Administrativo", emoji:"💼", cor:"#1D55D4" },
  confianca: { nome:"Cargo de Confiança", emoji:"👔", cor:"#7C3AED" },
  autonomo:  { nome:"Prestador/MEI", emoji:"🤝", cor:"#059669" },
  empresa1:  { nome:"Empresa N1", emoji:"🏢", cor:"#0891B2" },
  empresa2:  { nome:"Empresa N2", emoji:"🏦", cor:"#DB2777" },
};

const STATUS_CFG = {
  ok:      { label:"Aprovado",  icon:"✓", cor:C.green,  bg:C.greenBg,  border:C.greenBorder },
  alerta:  { label:"Atenção",   icon:"!", cor:C.yellow,  bg:C.yellowBg, border:C.yellowBorder },
  recusa:  { label:"Recusado",  icon:"✕", cor:C.red,    bg:C.redBg,    border:C.redBorder },
  pendente:{ label:"Pendente",  icon:"…", cor:C.gray,   bg:C.grayBg,   border:C.border },
};

const VER_CFG = {
  V0:{ icon:"✓", cor:C.v0, bg:C.v0bg, border:C.v0border, label:"Gratuito / Estável" },
  V2:{ icon:"⚡", cor:C.v2, bg:C.v2bg, border:C.v2border, label:"Parceiro" },
  V3:{ icon:"💳", cor:C.v3, bg:C.v3bg, border:C.v3border, label:"Pago/consulta" },
};

// Todos os grupos por perfil — V0 completo incorporado
const PERFIS_COMPLETOS = {

  // ══════════════════════════════════════════════════
  motorista: {
    titulo:"Motorista / Operador", emoji:"🚛", cor:"#EA580C", risco:"CRÍTICO",
    descricao:"Acesso direto a cargas, veículos e rotas. Qualquer gap gera risco operacional, criminal e responsabilidade civil para a transportadora.",
    entrega:"Express — 2 a 5 min",
    grupos:[
      { titulo:"Identidade & Cadastro", cor:C.accent,
        regra:"Base de qualquer análise — confirmar que a pessoa é quem diz ser.",
        itens:[
          { label:"CPF — Validação Receita Federal",
            oq:"Nome, data de nascimento, nome da mãe, situação cadastral (ativo/suspenso/cancelado/nulo).",
            pq:"CPF irregular = fraude de identidade ou sonegação grave. Primeira barreira de qualquer dossiê.",
            ok:"CPF ativo — dados consistentes com documentos",
            alerta:"CPF suspenso, cancelado, nulo ou inconsistência de nome",
            obrig:true, v:"V3", custo:"R$ 0,56", cobrado:2.50, status:"ok",
            resultado:"CPF ativo — João Silva Santos — 12/03/1982" },
        ]},
      { titulo:"CNH & Trânsito — SENATRAN", cor:"#EA580C",
        regra:"Verificações exigidas por lei. CNH inválida torna a operação ilegal — transportadora responde civil e criminalmente.",
        itens:[
          { label:"CNH — Categoria e validade",
            oq:"Categoria (C/D/E para carga), validade, situação (ativo/suspenso/cassado), restrições.",
            pq:"CNH vencida, categoria errada ou cassada proíbe a operação. Responsabilidade civil da transportadora em acidentes.",
            ok:"Categoria D ativa — Válida até 15/08/2026",
            alerta:"Suspensa, cassada, categoria incompatível ou vencida",
            obrig:true, v:"V3", custo:"R$ 0,83", cobrado:3.50, status:"ok",
            resultado:"Categoria D — Válida até 15/08/2026 — Ativa" },
          { label:"CNH — Pontuação e suspensões",
            oq:"Pontos acumulados, histórico de suspensões e cassações, reabilitações.",
            pq:"18+ pontos = suspensão automática (6 meses). 20 pontos em 12 meses = paralisa operações.",
            ok:"Até 10 pontos — sem suspensões recentes",
            alerta:"15+ pontos (risco alto), 18+ (suspensão iminente), cassação prévia",
            obrig:true, v:"V3", custo:"R$ 1,00", cobrado:4.00, status:"alerta",
            resultado:"12 pontos acumulados — Atenção: risco de suspensão" },
          { label:"Infrações de trânsito — RENAINF (nacional)",
            oq:"Multas em aberto em todo o Brasil: tipo, órgão autuador, valor, data.",
            pq:"Infrações gravíssimas indicam padrão de risco + risco de bloqueio iminente da CNH.",
            ok:"Sem multas graves ou infrações leves esporádicas",
            alerta:"Infrações gravíssimas, acúmulo acima de R$ 2.000",
            obrig:true, v:"V3", custo:"R$ 0,83", cobrado:3.50, status:"ok",
            resultado:"2 infrações leves — R$ 293,47 em multas" },
          { label:"Laudo Toxicológico — SENATRAN (categorias C/D/E)",
            oq:"Registro de laudo toxicológico válido — exigido pela Lei 13.103/2015.",
            pq:"OBRIGAÇÃO LEGAL. Sem laudo o motorista não pode operar. Transportadora responde administrativa e criminalmente.",
            ok:"Laudo válido — emitido dentro do prazo — resultado negativo",
            alerta:"Sem laudo, laudo vencido ou resultado positivo",
            obrig:true, v:"V3", custo:"R$ 0,66", cobrado:2.90, status:"ok",
            resultado:"Laudo válido — 03/2025 — Negativo" },
          { label:"RNTRC — Registro ANTT (autônomos)",
            oq:"Motorista autônomo registrado como TAC no Registro Nacional de Transportadores Rodoviários de Cargas.",
            pq:"OBRIGAÇÃO LEGAL. Sem RNTRC não pode transportar carga. Transportadora responde solidariamente.",
            ok:"TAC ativo e válido na ANTT",
            alerta:"Sem registro, cancelado ou suspenso pela ANTT",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"TAC ativo — Registro 00123456 — Válido" },
        ]},
      { titulo:"Antecedentes Criminais", cor:C.red,
        regra:"Motorista com acesso a carga deve ter histórico criminal limpo. Ocorrência grave relacionada a transporte = recusa imediata.",
        itens:[
          { label:"SINIC — Polícia Federal (certidão criminal federal)",
            oq:"Condenações com trânsito em julgado: PF, PRF, Polícias Civis (parcial), Polícias Penais, Tribunais.",
            pq:"Certidão oficial da PF. Gratuita e estável. Cobertura parcial das Polícias Civis (participação não obrigatória por lei).",
            ok:"Nada consta na base federal",
            alerta:"Condenação registrada — checar natureza e data",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Nada consta — Certidão PF emitida" },
          { label:"BNMP — Mandados de Prisão (CNJ)",
            oq:"Mandados de prisão em aberto com status 'Aguardando Cumprimento' — cobertura nacional.",
            pq:"Mandado de prisão em aberto = recusa imediata, qualquer perfil, qualquer cargo.",
            ok:"Sem mandados de prisão em aberto",
            alerta:"Mandado de prisão em aberto — recusa imediata",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem mandados de prisão em aberto" },
          { label:"Criminal completo — TJs + PF + MP + Diários (agregador)",
            oq:"Varredura nacional: todos os TJs estaduais, Polícia Federal, Ministério Público, Diários Oficiais — por CPF/nome.",
            pq:"Cobertura total além do SINIC. Antecedente de roubo de carga, receptação, tráfico = risco direto à operação.",
            ok:"Nada consta em nenhuma instância — varredura nacional completa",
            alerta:"Processo de roubo, receptação, tráfico, crime de trânsito grave",
            obrig:true, v:"V3", custo:"~R$ 8–12", cobrado:18.00, status:"ok",
            resultado:"Nada consta — Varredura nacional completa" },
        ]},
      { titulo:"Certidões Fiscais & Trabalhistas", cor:C.green,
        regra:"Fontes gratuitas de alto impacto. Motorista com dívida ativa ou condenação trabalhista indica instabilidade financeira e perfil de risco.",
        itens:[
          { label:"CNDT — Certidão Negativa Débitos Trabalhistas (TST)",
            oq:"Ausência de débitos trabalhistas condenatórios com trânsito em julgado.",
            pq:"Motorista autônomo com débito trabalhista indica histórico de conflito com contratantes anteriores.",
            ok:"Certidão negativa — sem débitos trabalhistas",
            alerta:"Débito trabalhista com trânsito em julgado",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Certidão Negativa — Válida até 15/12/2025" },
          { label:"PGFN — Dívida Ativa Federal",
            oq:"CPF inscrito em dívida ativa federal — montante, origem, situação.",
            pq:"Dívida ativa = risco de penhora de veículos e bens. Motorista autônomo com penhora de caminhão paralisa operações.",
            ok:"Sem inscrição em dívida ativa",
            alerta:"CPF inscrito em dívida ativa federal",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem inscrição em dívida ativa federal" },
        ]},
      { titulo:"Listas Restritivas & Compliance", cor:C.red,
        regra:"Impedimentos legais. Fontes públicas gratuitas. Retorno imediato. Alto impacto sobre elegibilidade.",
        itens:[
          { label:"CEIS — Cadastro de Empresas Inidôneas (CGU)",
            oq:"Pessoa física impedida de contratar com a administração pública federal.",
            pq:"Para transportadoras com contratos públicos: CEIS gera nulidade do contrato com motorista vinculado.",
            ok:"Sem ocorrência no CEIS",
            alerta:"Ocorrência ativa — verificar vigência e motivo",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem ocorrência — CEIS limpo" },
          { label:"MTE — Lista de Trabalho Escravo",
            oq:"Pessoa autuada por manter trabalhadores em condições análogas à escravidão.",
            pq:"Risco ESG e reputacional com grandes embarcadores. Critério de exclusão de fornecedores em certificações internacionais.",
            ok:"Sem ocorrência na lista MTE",
            alerta:"Ocorrência ativa — recusa imediata",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem ocorrência — Lista MTE limpa" },
          { label:"Portal da Transparência — Benefícios sociais (CGU)",
            oq:"Bolsa Família, BPC, benefícios previdenciários recebidos pelo CPF.",
            pq:"Cruzamento de consistência: renda declarada vs. benefícios ativos. Motorista com perfil incompatível.",
            ok:"Sem inconsistência relevante",
            alerta:"Benefício ativo incompatível com a renda declarada",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem benefícios ativos" },
        ]},
      { titulo:"Judiciário — Processos Públicos", cor:C.yellow,
        regra:"CNJ Datajud cobre todos os tribunais gratuitamente. Busca por número CNJ — complementar ao criminal por CPF.",
        itens:[
          { label:"CNJ Datajud — Processos por nº CNJ (todas instâncias)",
            oq:"Capas, movimentações, partes, assuntos, valores — todos os tribunais do Brasil.",
            pq:"Triagem judicial gratuita. Localizado um processo, confirma classe (criminal, trabalhista, cível) e polo.",
            ok:"Sem processos relevantes identificados",
            alerta:"Processo criminal ativo ou execução trabalhista",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Nenhum processo relevante identificado" },
          { label:"Justiça Militar — Certidão (STM)",
            oq:"Antecedentes na Justiça Militar para ex-militares.",
            pq:"Aplicar condicionalmente para candidatos com histórico ou vínculo militar.",
            ok:"Sem ocorrências na Justiça Militar",
            alerta:"Processo ou condenação na Justiça Militar",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Não aplicável — sem histórico militar" },
        ]},
    ]},

  // ══════════════════════════════════════════════════
  admin: {
    titulo:"Administrativo / Escritório", emoji:"💼", cor:C.accent, risco:"MÉDIO",
    descricao:"Sem acesso a carga ou veículos. Verificação proporcional ao cargo — princípio da minimização LGPD.",
    entrega:"Express — 2 a 5 min",
    grupos:[
      { titulo:"Identidade & Vínculos", cor:C.accent,
        regra:"Confirmar identidade e verificar vínculos societários que possam gerar conflito de interesses.",
        itens:[
          { label:"CPF — Validação Receita Federal",
            oq:"Nome, situação cadastral, data de nascimento, nome da mãe.",
            pq:"Verificação básica de identidade. Evita documentação falsa.",
            ok:"CPF ativo e consistente",
            alerta:"CPF irregular ou inconsistente",
            obrig:true, v:"V3", custo:"R$ 0,56", cobrado:2.50, status:"ok",
            resultado:"CPF ativo — Carlos Mendes — 05/07/1990" },
          { label:"CNPJ — Vínculos societários (RF Open Data)",
            oq:"Empresas em que a pessoa é ou foi sócia/administradora, situação de cada empresa.",
            pq:"Candidato com empresa com dívida fiscal ou falência = conflito de interesses e risco de responsabilização solidária.",
            ok:"Sem empresas ou empresas regulares e ativas",
            alerta:"Empresa irregular, cancelada por débito ou com passivo relevante",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem vínculos societários identificados" },
        ]},
      { titulo:"Listas Restritivas", cor:C.red,
        regra:"Triagem básica de integridade. Custo zero. Retorno imediato.",
        itens:[
          { label:"CEIS / CGU",
            oq:"Pessoa impedida de contratar com o governo federal.",
            pq:"Triagem obrigatória de integridade para qualquer contratação.",
            ok:"Sem ocorrência",
            alerta:"Ocorrência ativa",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem ocorrência — CEIS limpo" },
          { label:"MTE — Lista Trabalho Escravo",
            oq:"Ocorrência em lista de trabalho análogo à escravidão.",
            pq:"Critério ESG de integridade. Custo zero.",
            ok:"Sem ocorrência",
            alerta:"Ocorrência ativa — recusa imediata",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem ocorrência" },
          { label:"CNDT — Débitos Trabalhistas (TST)",
            oq:"Ausência de débitos trabalhistas condenatórios.",
            pq:"Histórico de conflitos trabalhistas como réu indica perfil problemático.",
            ok:"Certidão negativa",
            alerta:"Débito trabalhista em aberto",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Certidão Negativa" },
          { label:"BNMP — Mandados de Prisão (CNJ)",
            oq:"Mandados de prisão em aberto — cobertura nacional.",
            pq:"Mandado em aberto = recusa imediata.",
            ok:"Sem mandados em aberto",
            alerta:"Mandado em aberto — recusa imediata",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem mandados de prisão" },
        ]},
      { titulo:"Crédito (somente para acesso financeiro)", cor:C.green,
        regra:"Aplicar apenas para funções com acesso a caixa ou valores. Proporcionalidade LGPD.",
        itens:[
          { label:"Serasa — Score básico + negativações",
            oq:"Score 0–1.000, negativações, protestos, cheques sem fundo.",
            pq:"Pessoa muito endividada com acesso a caixa = incentivo financeiro para desvios.",
            ok:"Score acima de 500 — sem negativações relevantes",
            alerta:"Score abaixo de 300, múltiplas negativações, CCF recente",
            obrig:false, v:"V3", custo:"~R$ 2–3", cobrado:5.00, status:"ok",
            resultado:"Score 720 — Sem negativações" },
        ]},
    ]},

  // ══════════════════════════════════════════════════
  confianca: {
    titulo:"Cargo de Confiança / Gestor", emoji:"👔", cor:"#7C3AED", risco:"ALTO",
    descricao:"Acesso a informações estratégicas, contratos e fluxo financeiro. Profundidade máxima — sem concessões.",
    entrega:"Dossiê Completo — até 48h",
    grupos:[
      { titulo:"Identidade & Histórico Societário", cor:C.accent,
        regra:"CPF + mapa completo de empresas vinculadas. Padrão de abrir/fechar CNPJs é red flag documentado.",
        itens:[
          { label:"CPF + CNPJ — Histórico societário completo",
            oq:"CPF ativo + todas as empresas abertas/fechadas/ativas: participação %, datas, situação, falências.",
            pq:"Múltiplos CNPJs cancelados por débito = fuga de passivos. Empresa falida gerida por ele = má gestão comprovada.",
            ok:"Empresas regulares ou sem vínculo societário problemático",
            alerta:"Empresas canceladas por débito, falências, múltiplas aberturas em curto prazo",
            obrig:true, v:"V3", custo:"R$ 0,56", cobrado:2.50, status:"ok",
            resultado:"2 empresas ativas — Regulares — Sem falências" },
          { label:"Simples Nacional — Situação e optante",
            oq:"Empresa vinculada enquadrada no Simples, exclusões, situação atual.",
            pq:"Empresa excluída do Simples por débito = passivo fiscal relevante do gestor.",
            ok:"Optante regular ou regime coerente com o porte",
            alerta:"Excluída por débito — sinal de passivo fiscal",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Empresa vinculada optante regular Simples Nacional" },
        ]},
      { titulo:"Certidões Fiscais Completas", cor:C.green,
        regra:"Gestor com dívida fiscal de empresa que controla = responsabilidade pessoal potencial. Certidões gratuitas.",
        itens:[
          { label:"CND Federal — Receita Federal / PGFN",
            oq:"Tributos federais (IRPF/IRPJ/CSLL/PIS/COFINS/INSS) + dívida ativa da União.",
            pq:"Dívida ativa do CPF = risco de penhora judicial de ativos pessoais.",
            ok:"Certidão negativa — sem débitos federais",
            alerta:"Débito federal exigível ou inscrição em dívida ativa",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Certidão Negativa — Federal e PGFN" },
          { label:"CNDT — Débitos Trabalhistas (TST)",
            oq:"Ausência de débitos trabalhistas condenatórios — PF.",
            pq:"Gestor com histórico de demissão por justa causa + processo trabalhista = padrão de conflito.",
            ok:"Certidão negativa",
            alerta:"Débito trabalhista em execução",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Certidão Negativa Trabalhista" },
          { label:"PGFN — Dívida Ativa da União",
            oq:"CPF inscrito em dívida ativa federal — origem e montante.",
            pq:"Gestor com dívida ativa = pressão financeira que incentiva desvio.",
            ok:"Sem inscrição em dívida ativa",
            alerta:"Inscrito em dívida ativa federal",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem inscrição em dívida ativa" },
        ]},
      { titulo:"Listas Restritivas & Compliance", cor:C.red,
        regra:"Para cargo de confiança: qualquer ocorrência em lista nacional é critério de recusa. PEPs exigem due diligence reforçada.",
        itens:[
          { label:"CEIS + CNEP + CEPIM (CGU)",
            oq:"Impedimentos legais, punições anticorrupção, convênios irregulares.",
            pq:"Gestor em CEIS = impedido de firmar contratos públicos. CNEP = punição Lei Anticorrupção.",
            ok:"Sem ocorrência em nenhuma lista CGU",
            alerta:"Qualquer ocorrência ativa",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem ocorrência — Todas as listas CGU limpas" },
          { label:"MTE — Lista Trabalho Escravo",
            oq:"Autuação por trabalho análogo à escravidão.",
            pq:"Recusa imediata. Risco ESG, reputacional e criminal.",
            ok:"Sem ocorrência",
            alerta:"Ocorrência ativa — recusa imediata",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem ocorrência" },
          { label:"BNMP — Mandados de Prisão (CNJ)",
            oq:"Mandados de prisão em aberto — cobertura nacional.",
            pq:"Mandado em aberto = recusa imediata.",
            ok:"Sem mandados",
            alerta:"Mandado em aberto",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem mandados de prisão" },
          { label:"PEPs + Listas Internacionais (OFAC/ONU/INTERPOL)",
            oq:"Pessoa Politicamente Exposta, sanções OFAC, ONU, UE, FBI, INTERPOL.",
            pq:"PEP em cargo de confiança = due diligence reforçada obrigatória. Sanção internacional = recusa.",
            ok:"Sem ocorrência em nenhuma lista nacional ou internacional",
            alerta:"PEP ativo ou qualquer sanção internacional vigente",
            obrig:true, v:"V2", custo:"Via parceiro", cobrado:3.00, status:"ok",
            resultado:"Sem ocorrência — PEP e listas internacionais limpas" },
        ]},
      { titulo:"Criminal Nacional Completo", cor:C.red,
        regra:"Para cargo de confiança não há margem. Qualquer processo criminal ativo = recusa imediata.",
        itens:[
          { label:"SINIC — Polícia Federal",
            oq:"Condenações com trânsito em julgado na base federal.",
            pq:"Primeira camada gratuita de antecedentes.",
            ok:"Nada consta",
            alerta:"Condenação registrada",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Nada consta — Certidão PF" },
          { label:"Criminal completo — TJs + PF + MP + Diários",
            oq:"Varredura nacional em todos os tribunais, Ministério Público e Diários Oficiais.",
            pq:"Cobertura total. Crime contra patrimônio ou administração = inviabiliza o cargo.",
            ok:"Nada consta em nenhuma instância",
            alerta:"Processo criminal ativo ou condenação recente por crime grave",
            obrig:true, v:"V3", custo:"~R$ 10–15", cobrado:22.00, status:"ok",
            resultado:"Nada consta — Varredura nacional completa" },
        ]},
      { titulo:"Crédito & Situação Financeira", cor:C.green,
        regra:"Gestor com desequilíbrio financeiro grave tem incentivo concreto para desvio.",
        itens:[
          { label:"Serasa — Análise Completa PF",
            oq:"Score, negativações, protestos, CCF, renda presumida, cadastro positivo.",
            pq:"Dívida muito superior à renda presumida = risco de desvio. Cruzar com salário ofertado.",
            ok:"Score acima de 600 — dívidas proporcionais à renda",
            alerta:"Score abaixo de 400, dívida acima de 3× renda presumida",
            obrig:true, v:"V3", custo:"~R$ 8–14", cobrado:20.00, status:"ok",
            resultado:"Score 680 — Sem negativações" },
        ]},
      { titulo:"Registros Profissionais (condicional ao cargo)", cor:"#6366F1",
        regra:"Aplicar conforme a área de atuação do cargo. Conselhos têm portal gratuito e estável.",
        itens:[
          { label:"OAB — Registro de Advogado (se cargo jurídico)",
            oq:"Inscrição ativa, especialização, histórico disciplinar.",
            pq:"Advogado com inscrição suspensa ou cancelada não pode exercer a função. Verificação obrigatória.",
            ok:"Inscrição ativa — sem suspensões disciplinares",
            alerta:"Inscrição suspensa, cancelada ou processo disciplinar ativo",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Não aplicável — cargo não exige OAB" },
          { label:"CRC — Registro de Contador (se cargo contábil/financeiro)",
            oq:"Registro ativo no conselho de contabilidade, situação e punições.",
            pq:"Contador sem CRC ativo não pode assinar balanços ou relatórios contábeis.",
            ok:"Registro ativo — sem punições disciplinares",
            alerta:"Registro inativo ou punição disciplinar",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Não aplicável neste caso" },
          { label:"CREA — Registro de Engenheiro (se cargo técnico)",
            oq:"Registro ativo, tipo de atribuições, situação.",
            pq:"Engenheiro sem CREA ativo não pode assinar projetos ou laudos técnicos.",
            ok:"Registro ativo — atribuições compatíveis com o cargo",
            alerta:"Registro inativo ou atribuições incompatíveis",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Não aplicável neste caso" },
          { label:"e-MEC — Validação de Diploma / Instituição",
            oq:"IES reconhecida pelo MEC e curso autorizado.",
            pq:"Diploma falso ou de IES não reconhecida é fraude. e-MEC valida a instituição.",
            ok:"IES reconhecida — curso autorizado",
            alerta:"IES não reconhecida ou curso não autorizado",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Não solicitado neste dossiê" },
        ]},
    ]},

  // ══════════════════════════════════════════════════
  autonomo: {
    titulo:"Prestador / MEI / Autônomo", emoji:"🤝", cor:"#059669", risco:"MÉDIO-ALTO",
    descricao:"Sem CLT, com acesso às instalações ou carga. Risco duplo: segurança física + risco trabalhista.",
    entrega:"Express — 2 a 5 min",
    grupos:[
      { titulo:"Identidade & MEI", cor:"#059669",
        regra:"Confirmar identidade e verificar regularidade do MEI. MEI irregular = risco de reconhecimento de vínculo empregatício.",
        itens:[
          { label:"CPF — Validação Receita Federal",
            oq:"Situação cadastral, nome, data de nascimento, nome da mãe.",
            pq:"Base de qualquer checagem.",
            ok:"CPF ativo e consistente",
            alerta:"CPF irregular",
            obrig:true, v:"V3", custo:"R$ 0,56", cobrado:2.50, status:"ok",
            resultado:"CPF ativo — Prestador Silva" },
          { label:"MEI — Situação e regularidade (Portal do Empreendedor)",
            oq:"MEI ativo ou cancelado, CNAE declarado, pendências de DAS, data de abertura.",
            pq:"CNAE incompatível = risco trabalhista. MEI cancelado = sem cobertura previdenciária e risco de vínculo.",
            ok:"MEI ativo — CNAE compatível — sem pendências",
            alerta:"MEI cancelado, CNAE incompatível, +3 meses sem DAS",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"MEI ativo — CNAE 49.30-2/02 — Regular" },
          { label:"RNTRC — Registro ANTT (se transporte)",
            oq:"TAC ativo na ANTT — obrigatório para autônomo de transporte de cargas.",
            pq:"OBRIGAÇÃO LEGAL para transportadores. Sem RNTRC = infração ANTT.",
            ok:"TAC ativo e válido",
            alerta:"Sem registro ou cancelado",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"TAC ativo — aplicável neste caso" },
          { label:"Simples Nacional — Situação (se não MEI)",
            oq:"Situação no Simples, exclusões, regime tributário.",
            pq:"Prestador excluído do Simples por débito = instabilidade fiscal.",
            ok:"Optante regular",
            alerta:"Excluído por débito",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"MEI — não aplicável Simples Nacional separado" },
        ]},
      { titulo:"Certidões & Listas", cor:C.red,
        regra:"Triagem de integridade básica — todas gratuitas e de retorno imediato.",
        itens:[
          { label:"CNDT — Débitos Trabalhistas (TST)",
            oq:"Ausência de débitos trabalhistas — PF e PJ.",
            pq:"Prestador com processo trabalhista como réu = precedente de reconhecimento de vínculo.",
            ok:"Certidão negativa",
            alerta:"Débito trabalhista em execução",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Certidão Negativa" },
          { label:"PGFN — Dívida Ativa Federal",
            oq:"MEI/CPF inscrito em dívida ativa.",
            pq:"Dívida ativa = risco de bloqueio de conta e ativos. Prestador insolvente = risco operacional.",
            ok:"Sem dívida ativa",
            alerta:"Inscrito em dívida ativa",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem inscrição em dívida ativa" },
          { label:"CEIS / CGU + MTE",
            oq:"Impedimentos legais e lista de trabalho escravo.",
            pq:"Triagem básica. Custo zero. Alto impacto.",
            ok:"Sem ocorrência",
            alerta:"Qualquer ocorrência ativa",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem ocorrência em nenhuma lista" },
          { label:"BNMP — Mandados de Prisão (CNJ)",
            oq:"Mandados em aberto — cobertura nacional.",
            pq:"Prestador com mandado em aberto não pode exercer atividade.",
            ok:"Sem mandados",
            alerta:"Mandado em aberto — recusa imediata",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem mandados de prisão" },
        ]},
      { titulo:"Criminal (acesso às instalações)", cor:C.red,
        regra:"Prestador com acesso a galpões ou carga. Antecedente de furto, roubo ou receptação = risco direto ao patrimônio.",
        itens:[
          { label:"SINIC — Polícia Federal",
            oq:"Condenações criminais na base federal.",
            pq:"Primeira camada gratuita. Cobertura parcial estadual.",
            ok:"Nada consta",
            alerta:"Condenação registrada",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Nada consta" },
          { label:"Criminal completo — Agregador (BGC/Netrin)",
            oq:"TJs estaduais + BNMP + MP — cobertura nacional por CPF.",
            pq:"Cobertura completa. Crimes contra patrimônio = recusa para qualquer acesso a instalações.",
            ok:"Sem antecedentes criminais relevantes",
            alerta:"Furto, roubo, receptação, tráfico, violência",
            obrig:true, v:"V3", custo:"~R$ 5–10", cobrado:12.00, status:"ok",
            resultado:"Nada consta — Varredura completa" },
        ]},
    ]},

  // ══════════════════════════════════════════════════
  empresa1: {
    titulo:"Empresa — Nível 1", emoji:"🏢", cor:"#0891B2", risco:"MÉDIO",
    descricao:"Fornecedor, parceiro ou subcontratado de baixo risco. Regularidade básica: existe, está ativa, sem impedimentos críticos.",
    entrega:"Express PJ — 2 a 5 min",
    grupos:[
      { titulo:"Cadastro & Existência", cor:"#0891B2",
        regra:"Confirmar que a empresa existe, está ativa e opera com o CNAE declarado.",
        itens:[
          { label:"CNPJ — Receita Federal (API pública)",
            oq:"Razão social, QSA (sócios e admins), CNAE, porte, capital social, situação, endereço.",
            pq:"CNPJ inapto ou suspenso = empresa fantasma ou em encerramento. CNAE incompatível = risco operacional.",
            ok:"CNPJ ativo — situação regular — CNAE compatível",
            alerta:"Inapto, suspenso, CNAE incompatível, razão social divergente",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"CNPJ ativo — Regular — CNAE 4930-2/02" },
          { label:"Simples Nacional — Situação e regime",
            oq:"Empresa enquadrada no Simples, exclusões, situação atual.",
            pq:"Exclusão do Simples por débito = passivo fiscal relevante. Sinal de instabilidade financeira.",
            ok:"Optante regular ou regime coerente com porte",
            alerta:"Excluída por débito",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Optante Simples Nacional — Regular" },
          { label:"ANTT — ETC/CTC (se transportadora)",
            oq:"Empresa registrada como ETC ou Cooperativa de Transporte (CTC), situação e validade.",
            pq:"OBRIGAÇÃO LEGAL. Subcontratada sem registro ANTT = operação ilegal. Transportadora responde solidariamente.",
            ok:"ETC ativo e válido na ANTT",
            alerta:"Sem registro, cancelado ou suspenso",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"ETC ativa — Registro válido — ANTT" },
        ]},
      { titulo:"Regularidade Fiscal & Trabalhista", cor:C.green,
        regra:"Empresa com débito = risco de responsabilidade solidária do contratante. As três certidões são gratuitas.",
        itens:[
          { label:"CND Federal — RF/PGFN (tributos + dívida ativa)",
            oq:"IRPJ, CSLL, PIS, COFINS, INSS, dívida ativa da União — certidão unificada.",
            pq:"Empresa com débito federal = risco de bloqueio de bens e responsabilidade solidária do contratante.",
            ok:"Certidão negativa — sem débitos federais",
            alerta:"Débito federal exigível ou dívida ativa",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Certidão Negativa Federal — Válida" },
          { label:"CRF FGTS — Caixa Econômica",
            oq:"Empresa em dia com recolhimento do FGTS de todos os funcionários.",
            pq:"FGTS irregular = passivo trabalhista crescente. Contratante pode ser responsabilizado.",
            ok:"CRF regular — FGTS em dia",
            alerta:"Irregularidade no recolhimento FGTS",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"CRF regular — Caixa Econômica" },
          { label:"CNDT — Certidão Negativa Débitos Trabalhistas (TST)",
            oq:"Ausência de débitos trabalhistas condenatórios com trânsito em julgado.",
            pq:"Múltiplos débitos trabalhistas = má gestão de RH e instabilidade operacional.",
            ok:"Certidão negativa",
            alerta:"Débito trabalhista com trânsito em julgado",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Certidão Negativa Trabalhista" },
          { label:"PGFN — Dívida Ativa da União",
            oq:"CNPJ inscrito em dívida ativa federal — montante, origem.",
            pq:"Dívida ativa = risco de penhora de bens e bloqueio de conta bancária da empresa.",
            ok:"Sem inscrição em dívida ativa",
            alerta:"Inscrita em dívida ativa federal",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem inscrição em dívida ativa" },
        ]},
      { titulo:"Listas Restritivas", cor:C.red,
        regra:"Todas gratuitas. Alto impacto. Ocorrência ativa = risco imediato para o contratante.",
        itens:[
          { label:"CEIS + CEPIM + CNEP (CGU)",
            oq:"Empresa impedida de contratar com governo, convênio irregular, punição anticorrupção.",
            pq:"CEIS = nulidade de contratos públicos. CNEP = Lei Anticorrupção. CEPIM = convênio irregular.",
            ok:"Sem ocorrência em nenhuma lista CGU",
            alerta:"Qualquer ocorrência ativa",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem ocorrência — Todas as listas CGU limpas" },
          { label:"MTE — Lista Trabalho Escravo",
            oq:"Empresa autuada por trabalho análogo à escravidão.",
            pq:"Risco ESG crítico. Grandes embarcadores e clientes internacionais exigem ausência nesta lista.",
            ok:"Sem ocorrência",
            alerta:"Ocorrência ativa — recusa imediata",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem ocorrência" },
          { label:"Portal da Transparência — Benefícios / Convênios",
            oq:"Contratos, convênios e benefícios recebidos da União.",
            pq:"Empresa dependente de contratos públicos com irregularidade = risco operacional.",
            ok:"Sem irregularidades em contratos públicos",
            alerta:"Irregularidade em convênio ou contrato federal",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem irregularidades identificadas" },
        ]},
      { titulo:"Processos Judiciais", cor:C.yellow,
        regra:"Volume e tipo de processos revelam saúde operacional real da empresa.",
        itens:[
          { label:"CNJ Datajud — Processos por CNPJ",
            oq:"Processos trabalhistas, cíveis, fiscais — capas e movimentações.",
            pq:"Volume desproporcional ao porte = empresa em dificuldade. Execuções fiscais = dívidas não negociadas.",
            ok:"Sem processos ou volume proporcional ao porte",
            alerta:"Múltiplos trabalhistas, execuções fiscais ativas",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"3 processos trabalhistas — dentro do esperado para o porte" },
          { label:"Processos por CNPJ — Agregador (Escavador/JUDIT)",
            oq:"Busca por CNPJ/razão social em todos os tribunais — com valores e status.",
            pq:"Cobertura mais completa que o Datajud para busca por empresa.",
            ok:"Sem processos relevantes ou volume proporcional",
            alerta:"Execuções fiscais acima de R$ 500k, processo criminal da PJ",
            obrig:false, v:"V3", custo:"~R$ 3–6", cobrado:8.00, status:"ok",
            resultado:"14 processos — maioria trabalhista encerrada" },
        ]},
    ]},

  // ══════════════════════════════════════════════════
  empresa2: {
    titulo:"Empresa — Nível 2 (Due Diligence)", emoji:"🏦", cor:"#DB2777", risco:"ALTO",
    descricao:"Parceiro estratégico, fornecedor crítico ou M&A. Análise completa: empresa + sócios + cadeia societária + compliance + patrimônio.",
    entrega:"Due Diligence — 24 a 48h",
    grupos:[
      { titulo:"Cadastro & Estrutura Societária", cor:"#DB2777",
        regra:"Empresa pode ter sido vendida a sócios problemáticos recentemente. Alterações contratuais antes de assinar = blindagem patrimonial.",
        itens:[
          { label:"CNPJ + Histórico societário completo",
            oq:"Sócios atuais e históricos, participação %, datas de entrada/saída, alterações contratuais.",
            pq:"Alteração societária recente (menos de 6 meses) antes de assinar = red flag de blindagem patrimonial.",
            ok:"Estrutura estável — sócios sem ocorrências individuais",
            alerta:"Alteração societária recente, sócios com problemas individuais",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"CNPJ ativo — 3 sócios — Estrutura estável" },
          { label:"Simples Nacional + MEI dos sócios",
            oq:"Regime tributário da empresa + situação MEI de sócios que atuam como PF.",
            pq:"Sócio MEI irregular = risco trabalhista indireto para a empresa.",
            ok:"Regimes regulares — sócios sem pendências",
            alerta:"Exclusão por débito ou MEI irregular de sócio",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Simples regular — Sócios sem MEI ativo" },
          { label:"CAUC — Regularidade para Transferências Federais",
            oq:"Regularidade para receber transferências voluntárias federais.",
            pq:"Empresa que firma convênios com governo precisa estar regular no CAUC.",
            ok:"Regular no CAUC",
            alerta:"Irregularidade — convênios bloqueados",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Regular — CAUC" },
        ]},
      { titulo:"Regularidade Fiscal Completa", cor:C.green,
        regra:"Parceiro estratégico com débito em qualquer esfera = risco de bloqueio de operações e responsabilidade solidária.",
        itens:[
          { label:"CND Federal + CRF FGTS + CNDT Trabalhista",
            oq:"Pacote completo: federal, FGTS, trabalhista — todas as esferas.",
            pq:"Empresa com débito em qualquer esfera = instabilidade que contamina a parceria.",
            ok:"Todas as certidões negativas",
            alerta:"Qualquer certidão positiva com débito exigível",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Todas as certidões negativas — Válidas" },
          { label:"PGFN — Dívida Ativa da União",
            oq:"CNPJ inscrito em dívida ativa federal.",
            pq:"Dívida ativa elevada = risco de penhora e bloqueio judicial que paralisa operações.",
            ok:"Sem inscrição",
            alerta:"Inscrita em dívida ativa",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem inscrição em dívida ativa" },
        ]},
      { titulo:"Licenças & Autorizações Regulatórias", cor:"#0891B2",
        regra:"Licenças governamentais gratuitas para consulta. Obrigatórias conforme o setor de atuação.",
        itens:[
          { label:"ANTT — ETC/CTC/RNTRC (transportadoras)",
            oq:"Registro como ETC ou CTC, situação e validade.",
            pq:"Subcontratada sem ANTT = operação ilegal. Responsabilidade solidária por acidentes.",
            ok:"ETC/CTC ativo e válido",
            alerta:"Sem registro, cancelado ou suspenso",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"ETC ativa — Registro válido" },
          { label:"ANVISA — Autorização de Funcionamento (AFE)",
            oq:"Empresa autorizada a fabricar/importar/distribuir produtos sujeitos à vigilância sanitária.",
            pq:"Sem AFE = infração sanitária com risco de interdição. Obrigatório para saúde/alimentos.",
            ok:"AFE válida e compatível com atividades",
            alerta:"Sem autorização, vencida ou incompatível",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Não aplicável — setor de transporte" },
          { label:"IBAMA — Certificado de Regularidade (CTF/APP)",
            oq:"Regularidade ambiental — ausência de embargos e regularidade no CTF.",
            pq:"Embargo ambiental ativo pode paralisar operações conjuntas e contaminar o contratante.",
            ok:"CTF regular — sem embargos",
            alerta:"Embargo ambiental ativo",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Regular — CTF/IBAMA" },
          { label:"BACEN — IF.data (se parceiro financeiro)",
            oq:"Instituição financeira autorizada pelo Banco Central.",
            pq:"Parceiro financeiro não regulado pelo BACEN = risco de operação ilegal.",
            ok:"IF autorizada e regular",
            alerta:"Sem autorização BACEN",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Não aplicável — não é IF" },
        ]},
      { titulo:"Processos & Criminal dos Sócios", cor:C.yellow,
        regra:"Volume e tipo de processos + criminal dos decisores reais. Empresa pode ser limpa, sócios não.",
        itens:[
          { label:"CNJ Datajud + Processos Agregador",
            oq:"Processos por CNPJ — trabalhistas, cíveis, fiscais, criminais — valor, polo, status.",
            pq:"Execuções fiscais acima de R$ 500k = provável insolvência. Processo criminal da PJ = risco imediato.",
            ok:"Volume proporcional ao porte — sem processos criminais",
            alerta:"Execuções acima de R$ 500k, processo criminal da PJ",
            obrig:true, v:"V3", custo:"~R$ 4–8", cobrado:12.00, status:"alerta",
            resultado:"14 processos trabalhistas — volume acima do esperado" },
          { label:"Criminal — Sócio 1 (CPF incluído no dossiê)",
            oq:"Antecedentes criminais + mandados + processos do sócio principal.",
            pq:"Os sócios são os decisores reais. Crime financeiro de sócio contamina toda a empresa.",
            ok:"Nada consta para o sócio principal",
            alerta:"Processo criminal ativo ou condenação por crime grave",
            obrig:true, v:"V3", custo:"~R$ 8–12", cobrado:18.00, status:"ok",
            resultado:"Sócio 1: nada consta — varredura nacional" },
          { label:"Criminal — Sócios adicionais (cobrado por CPF)",
            oq:"Cada sócio adicional consultado individualmente.",
            pq:"Empresa com 3 sócios = 3 análises. Cobrança adicional a partir do 2º CPF.",
            ok:"Todos os sócios sem antecedentes relevantes",
            alerta:"Qualquer sócio com processo criminal ativo",
            obrig:false, v:"V3", custo:"~R$ 8–12/sócio", cobrado:18.00, status:"ok",
            resultado:"2 sócios adicionais: nada consta" },
        ]},
      { titulo:"Compliance & Listas Internacionais", cor:C.red,
        regra:"Qualquer ocorrência ativa inviabiliza parceria estratégica. PEPs exigem due diligence reforçada.",
        itens:[
          { label:"CEIS + CNEP + CEPIM + MTE (CGU)",
            oq:"Impedimentos, anticorrupção, convênios, trabalho escravo — empresa e todos os sócios.",
            pq:"CEIS da empresa ou sócio = nulidade de contratos públicos. CNEP = punição anticorrupção.",
            ok:"Empresa e todos os sócios sem ocorrência",
            alerta:"Qualquer ocorrência ativa",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Empresa e sócios sem ocorrência — todas as listas CGU" },
          { label:"BNMP — Mandados de prisão dos sócios",
            oq:"Mandados em aberto para cada sócio — cobertura nacional.",
            pq:"Sócio com mandado em aberto = risco operacional imediato para toda a empresa.",
            ok:"Todos os sócios sem mandados",
            alerta:"Mandado de prisão em aberto de qualquer sócio",
            obrig:true, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Todos os sócios sem mandados de prisão" },
          { label:"PEPs + OFAC + ONU + UE + INTERPOL",
            oq:"Empresa e sócios em listas restritivas nacionais e internacionais.",
            pq:"Sócio PEP = due diligence reforçada BCB/COAF. Empresa em lista OFAC = operações internacionais bloqueadas.",
            ok:"Empresa e sócios sem ocorrência nacional ou internacional",
            alerta:"Qualquer ocorrência ativa — empresa ou sócio",
            obrig:true, v:"V2", custo:"Via parceiro", cobrado:5.00, status:"ok",
            resultado:"Sem ocorrência — PEP e listas internacionais limpas" },
          { label:"Grafo societário (Kronoos / upLexis)",
            oq:"Mapa de vínculos: sócios das empresas dos sócios, familiares, conexões com entidades de risco.",
            pq:"Expõe beneficiários finais ocultos. Exigência regulatória COAF/BCB para compliance.",
            ok:"Estrutura sem conexões problemáticas",
            alerta:"Beneficiário final oculto ou conexão com entidade em lista restritiva",
            obrig:false, v:"V2", custo:"Via parceiro", cobrado:5.00, status:"ok",
            resultado:"Sem vínculos problemáticos — grafo limpo" },
        ]},
      { titulo:"Patrimônio & Capacidade", cor:"#0EA5E9",
        regra:"Frota declarada vs. registrada. Patrimônio imaterial. Capacidade operacional real.",
        itens:[
          { label:"ANAC — Aeronaves registradas no CNPJ",
            oq:"Aeronaves em nome da empresa: matrícula, modelo, gravames.",
            pq:"Patrimônio aéreo confirma capacidade financeira e operacional declarada.",
            ok:"Frota aérea compatível com o declarado",
            alerta:"Gravame sobre aeronave ou frota muito inferior ao declarado",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Sem aeronaves registradas" },
          { label:"INPI — Marcas e Patentes",
            oq:"Marcas registradas, patentes, desenhos industriais.",
            pq:"Patrimônio intangível. Relevante para M&A e avaliação de ativos.",
            ok:"Marcas e patentes regulares e ativas",
            alerta:"Marca não registrada ou em disputa",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"2 marcas registradas — INPI" },
          { label:"CVM — Registro de participantes (se financeiro)",
            oq:"Empresa registrada na CVM como corretora, fundo ou assessor.",
            pq:"Parceiro financeiro sem CVM = operação irregular.",
            ok:"Registrado e habilitado CVM",
            alerta:"Sem registro ou registro cancelado",
            obrig:false, v:"V0", custo:"Gratuito", cobrado:0, status:"ok",
            resultado:"Não aplicável — não é IF" },
        ]},
    ]},
};

// ─── HISTORICO & MASTER DATA (igual ao V2) ────────────────────────────────────
const HISTORICO = [
  { id:"001", data:"07/06/2025", cliente:"Transportadora Veloz Ltda", doc:"012.345.678-90", tipo:"motorista", itens:10, cobrado:34.40, custo_api:13.32, status:"ok",    nome:"João Silva Santos" },
  { id:"002", data:"06/06/2025", cliente:"Log & Frete S.A.",          doc:"98.765.432/0001-10", tipo:"empresa2", itens:16, cobrado:120.00, custo_api:48.00, status:"alerta", nome:"Fretes Rápidos Ltda" },
  { id:"003", data:"05/06/2025", cliente:"Uso Próprio",               doc:"234.567.890-12", tipo:"confianca", itens:13, cobrado:0,     custo_api:18.56, status:"ok",    nome:"Ana Paula Ferreira" },
  { id:"004", data:"04/06/2025", cliente:"RH Terceiriza Ltda",        doc:"345.678.901-23", tipo:"admin",     itens:7,  cobrado:15.00, custo_api:4.56,  status:"ok",    nome:"Carlos Mendes" },
  { id:"005", data:"03/06/2025", cliente:"Transportadora Veloz Ltda", doc:"456.789.012-34", tipo:"motorista", itens:10, cobrado:34.40, custo_api:13.32, status:"recusa", nome:"Pedro Rocha Lima" },
  { id:"006", data:"02/06/2025", cliente:"Construtora Nova Era",      doc:"11.222.333/0001-44", tipo:"empresa1", itens:9, cobrado:45.00, custo_api:8.56, status:"ok",  nome:"Nova Era Engenharia" },
];

// ─── VIEWS ────────────────────────────────────────────────────────────────────

function CnpjRealBanner({ mobile, perfilId }) {
  const [cnpj, setCnpj]       = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState(null);
  const [error, setError]     = useState(null);

  const isEmpresa = perfilId === "empresa1" || perfilId === "empresa2";
  if (!isEmpresa) return null;

  const buscar = async () => {
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14) { setError("CNPJ inválido — informe 14 dígitos"); return; }
    setLoading(true); setError(null); setData(null);
    try {
      const res = await consultarCNPJ(clean);
      setData(res);
    } catch (e) {
      setError(e.message || "Erro ao consultar CNPJ");
    } finally {
      setLoading(false);
    }
  };

  const situacaoOk = data && (data.situacao || "").toLowerCase().includes("ativa");

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: mobile ? "14px" : "16px 20px", marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
        🔌 Consulta CNPJ Real — Receita Federal (V0 gratuito)
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: data || error ? 12 : 0 }}>
        <input
          value={cnpj}
          onChange={e => setCnpj(e.target.value.replace(/[^\d.\/\-]/g, ""))}
          placeholder="00.000.000/0001-00"
          onKeyDown={e => e.key === "Enter" && buscar()}
          style={{ flex: 1, minWidth: 160, padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "monospace", outline: "none" }}
        />
        <button onClick={buscar} disabled={loading} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: loading ? C.border : C.accent, color: loading ? C.textMuted : "#fff", fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Consultando…" : "Consultar"}
        </button>
      </div>

      {error && (
        <div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.red }}>
          ✕ {error}
        </div>
      )}

      {data && (
        <div style={{ background: situacaoOk ? C.greenBg : C.yellowBg, border: `1px solid ${situacaoOk ? C.greenBorder : C.yellowBorder}`, borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{data.razaoSocial}</div>
              {data.nomeFantasia && <div style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>Fantasia: {data.nomeFantasia}</div>}
              <div style={{ fontSize: 11, color: C.textSub, fontFamily: "monospace", marginTop: 2 }}>{data.cnpj}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 12px", borderRadius: 20, background: situacaoOk ? C.greenBg : C.yellowBg, color: situacaoOk ? C.green : C.yellow, border: `1.5px solid ${situacaoOk ? C.greenBorder : C.yellowBorder}` }}>
              {situacaoOk ? "✓" : "!"} {data.situacao}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 8 }}>
            {[
              { l: "CNAE", v: `${data.cnaeCode} — ${data.cnaeDesc}` },
              { l: "Abertura", v: data.abertura },
              { l: "Porte", v: data.porte },
              { l: "Capital Social", v: data.capitalSocial ? `R$ ${Number(data.capitalSocial).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—" },
              { l: "Natureza", v: data.natureza },
              { l: "Endereço", v: `${data.endereco.municipio} — ${data.endereco.uf}` },
            ].map(f => (
              <div key={f.l} style={{ background: "rgba(255,255,255,0.6)", borderRadius: 7, padding: "7px 10px" }}>
                <div style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 3 }}>{f.l}</div>
                <div style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>{f.v || "—"}</div>
              </div>
            ))}
          </div>
          {data.socios.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>QSA — Quadro Societário ({data.socios.length} {data.socios.length === 1 ? "sócio" : "sócios"})</div>
              {data.socios.map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.6)", borderRadius: 7, padding: "6px 10px", marginBottom: 4, fontSize: 11 }}>
                  <span style={{ color: C.text, fontWeight: 600 }}>{s.nome}</span>
                  <span style={{ color: C.textMuted }}>{s.qualificacao}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 10, color: C.textMuted }}>
            ✓ Dado real — Receita Federal · Cache 24h · {new Date().toLocaleString("pt-BR")}
          </div>
        </div>
      )}
    </div>
  );
}

function DossieView({ mobile, perfilId }) {
  const perfil = PERFIS_COMPLETOS[perfilId];
  if (!perfil) return null;
  // Todos os grupos abertos por padrão
  const defaultOpen = () => new Set(perfil.grupos.map((_, i) => i));
  const [gruposAbertos, setGruposAbertos] = useState(defaultOpen);
  // Reset via key prop no componente pai (ver App)
  const toggleGrupo = (gi) => {
    setGruposAbertos(prev => {
      const next = new Set(prev);
      if (next.has(gi)) next.delete(gi); else next.add(gi);
      return next;
    });
  };

  const totalGrupos = perfil.grupos.length;
  const todosItens = perfil.grupos.flatMap(g => g.itens);
  const totalItens = todosItens.length;
  const totalObrig = todosItens.filter(i => i.obrig).length;
  const totalV0 = todosItens.filter(i => i.v === "V0").length;
  const totalCobrado = todosItens.reduce((a, i) => a + i.cobrado, 0);
  const statusGeral = todosItens.some(i => i.status === "recusa") ? "recusa"
    : todosItens.some(i => i.status === "alerta") ? "alerta" : "ok";
  const S = STATUS_CFG[statusGeral];

  return (
    <div style={{ padding: mobile ? "14px 12px" : "22px 24px", maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ background: C.navy, borderRadius: 12, padding: mobile ? "16px" : "20px 26px", marginBottom: 14, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <AZLogo dark size="sm" />
        <div style={{ textAlign: mobile ? "left" : "right" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginBottom: 2 }}>RELATÓRIO Nº 001/2025</div>
          <div style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>Emitido em 07/06/2025 — 14h32</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>Válido por 90 dias</div>
        </div>
      </div>

      {/* Resumo */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: mobile ? "14px" : "18px 22px", marginBottom: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 12, justifyContent: "space-between" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Objeto da análise</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 3 }}>{perfilId === "empresa1" || perfilId === "empresa2" ? "Nova Era Engenharia Ltda" : "João Silva Santos"}</div>
            <div style={{ fontSize: 12, color: C.textSub, marginBottom: 2 }}>
              {perfilId === "empresa1" || perfilId === "empresa2" ? "CNPJ: 11.222.333/0001-44" : "CPF: 012.345.678-90"}
              {" · "}{perfil.emoji} {perfil.titulo}
            </div>
            <div style={{ fontSize: 12, color: C.textSub }}>Solicitado por: Transportadora Veloz Ltda</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: S.bg, border: `1.5px solid ${S.border}`, borderRadius: 10, padding: "13px 18px", minWidth: 110 }}>
            <div style={{ fontSize: 24, marginBottom: 3 }}>{statusGeral === "ok" ? "✅" : statusGeral === "alerta" ? "⚠️" : "❌"}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: S.cor }}>{S.label.toUpperCase()}</div>
          </div>
        </div>
        {/* Stats + valor */}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 8 }}>
          {[
            { l: "Verificações", v: `${totalItens}`, c: C.accent },
            { l: "Obrigatórias", v: `${totalObrig}`, c: C.red },
            { l: "Gratuitas (V0)", v: `${totalV0}`, c: C.v0 },
            { l: "Valor do dossiê", v: totalCobrado > 0 ? `R$ ${totalCobrado.toFixed(2)}` : "Uso próprio", c: totalCobrado > 0 ? C.accent : C.gray },
          ].map(s => (
            <div key={s.l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>{s.l}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: s.c, fontFamily: "monospace" }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      <CnpjRealBanner mobile={mobile} perfilId={perfilId} />

      {/* Grupos */}
      {perfil.grupos.map((g, gi) => {
        const ab = gruposAbertos.has(gi);
        const gStatus = g.itens.some(i => i.status === "recusa") ? "recusa"
          : g.itens.some(i => i.status === "alerta") ? "alerta" : "ok";
        const GS = STATUS_CFG[gStatus];
        return (
          <div key={gi} style={{ marginBottom: 8 }}>
            <button onClick={() => toggleGrupo(gi)} style={{
              width: "100%", background: C.surface, border: `1px solid ${ab ? g.cor : C.border}`,
              borderLeft: `4px solid ${g.cor}`, borderRadius: ab ? "10px 10px 0 0" : "10px",
              padding: mobile ? "12px 13px" : "13px 17px",
              display: "flex", alignItems: "flex-start", flexDirection: "column", gap: 6, cursor: "pointer", textAlign: "left",
            }}>
              <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{g.titulo}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: GS.bg, color: GS.cor, border: `1px solid ${GS.border}` }}>
                    {GS.icon} {GS.label}
                  </span>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{ab ? "▲" : "▼"}</span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.4 }}>{g.regra}</div>
            </button>

            {ab && (
              <div style={{ border: `1px solid ${g.cor}`, borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden", background: C.surface }}>
                {g.itens.map((item, ii) => {
                  const IS = STATUS_CFG[item.status];
                  const VC = VER_CFG[item.v];
                  return (
                    <div key={ii} style={{ borderBottom: ii < g.itens.length - 1 ? `1px solid ${C.border}` : "none", background: ii % 2 === 0 ? C.surface : "#F8FAFC" }}>
                      <div style={{ padding: mobile ? "12px 12px" : "13px 17px", display: "flex", alignItems: "flex-start", gap: 10, flexWrap: mobile ? "wrap" : "nowrap" }}>
                        {/* Check circle */}
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: IS.bg, border: `1.5px solid ${IS.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: IS.cor, lineHeight: 1 }}>{IS.icon}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 2 }}>{item.label}</div>
                          <div style={{ fontSize: 11, color: IS.cor, fontWeight: 600, marginBottom: 6 }}>{item.resultado}</div>
                          {/* 4 quadrantes */}
                          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 6 }}>
                            {[
                              { l: "🔍 O que enxergamos", v: item.oq },
                              { l: "💡 Por que monitoramos", v: item.pq },
                              { l: "✓ Resultado esperado OK", v: item.ok, bg: C.greenBg, bc: C.greenBorder },
                              { l: "⚠ Flag de alerta / recusa", v: item.alerta, bg: C.redBg, bc: C.redBorder },
                            ].map(box => (
                              <div key={box.l} style={{ background: box.bg || "#F8FAFC", borderRadius: 7, padding: "8px 10px", border: `1px solid ${box.bc || C.border}` }}>
                                <div style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, fontWeight: 700 }}>{box.l}</div>
                                <div style={{ fontSize: 11, color: C.textSub, lineHeight: 1.55 }}>{box.v}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Tags direita */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0, minWidth: 70, alignItems: "flex-end" }}>
                          <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 8, background: VC.bg, color: VC.cor, border: `1px solid ${VC.border}`, whiteSpace: "nowrap" }}>{VC.icon} {item.v}</span>
                          <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 8, background: item.obrig ? C.redBg : "#F8FAFC", color: item.obrig ? C.red : C.gray, border: `1px solid ${item.obrig ? C.redBorder : C.border}` }}>{item.obrig ? "OBRIG." : "OPCION."}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 8, fontFamily: "monospace", background: item.v === "V0" ? C.v0bg : item.v === "V2" ? C.v2bg : C.v3bg, color: item.v === "V0" ? C.v0 : item.v === "V2" ? C.v2 : C.v3, border: `1px solid ${item.v === "V0" ? C.v0border : item.v === "V2" ? C.v2border : C.v3border}` }}>{item.custo === "Gratuito" ? "FREE" : item.custo}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Exportação */}
      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { l: "📄 Exportar PDF", c: C.accent, bg: C.accentBg },
          { l: "📧 E-mail", c: C.navyMid, bg: "#EEF2F8" },
          { l: "💬 WhatsApp", c: "#15803D", bg: "#F0FDF4" },
          { l: "🔗 Copiar link", c: C.gray, bg: "#F8FAFC" },
        ].map(b => (
          <button key={b.l} style={{ padding: mobile ? "9px 14px" : "8px 15px", borderRadius: 8, border: `1.5px solid ${b.c}30`, background: b.bg, color: b.c, fontSize: 12, fontWeight: 600, cursor: "pointer", flex: mobile ? "1" : "unset", textAlign: "center" }}>{b.l}</button>
        ))}
      </div>
    </div>
  );
}

function HistoricoView({ mobile, isMaster }) {
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const filtered = useMemo(() => HISTORICO.filter(h => {
    const b = !busca || h.doc.includes(busca) || h.nome.toLowerCase().includes(busca.toLowerCase()) || h.cliente.toLowerCase().includes(busca.toLowerCase());
    const t = filtroTipo === "todos" || h.tipo === filtroTipo;
    const s = filtroStatus === "todos" || h.status === filtroStatus;
    return b && t && s;
  }), [busca, filtroTipo, filtroStatus]);

  return (
    <div style={{ padding: mobile ? "14px 12px" : "22px 24px", maxWidth: 1000, margin: "0 auto" }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: "0 0 4px" }}>Histórico de Consultas</h2>
      <p style={{ fontSize: 12, color: C.textMuted, margin: "0 0 16px" }}>Filtro por CPF/CNPJ, cliente, tipo e status</p>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : `repeat(${isMaster ? 4 : 3}, 1fr)`, gap: 8, marginBottom: 14 }}>
        {[
          { l: "Consultas", v: filtered.length, c: C.accent },
          { l: "Receita", v: `R$ ${filtered.reduce((a, h) => a + h.cobrado, 0).toFixed(2)}`, c: C.green },
          ...(isMaster ? [
            { l: "Custo de API", v: `R$ ${filtered.reduce((a, h) => a + h.custo_api, 0).toFixed(2)}`, c: C.yellow },
            { l: "Margem", v: `${Math.round((filtered.reduce((a, h) => a + (h.cobrado - h.custo_api), 0)) / Math.max(filtered.reduce((a, h) => a + h.cobrado, 0), 1) * 100)}%`, c: C.v0 },
          ] : [{ l: "Status OK", v: filtered.filter(h => h.status === "ok").length, c: C.green }]),
        ].map(s => (
          <div key={s.l} style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${s.c}`, borderRadius: 8, padding: "11px 13px" }}>
            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>{s.l}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: s.c, fontFamily: "monospace" }}>{s.v}</div>
          </div>
        ))}
      </div>
      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar nome, CPF, CNPJ, cliente..."
          style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, flex: 1, minWidth: 160, outline: "none", background: C.surface }} />
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, background: C.surface }}>
          <option value="todos">Todos os perfis</option>
          {Object.entries(PERFIL_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.nome}</option>)}
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, background: C.surface }}>
          <option value="todos">Todos os status</option>
          <option value="ok">✓ Aprovado</option>
          <option value="alerta">! Atenção</option>
          <option value="recusa">✕ Recusado</option>
        </select>
      </div>
      {/* Cards mobile / Tabela desktop */}
      {mobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(h => {
            const S = STATUS_CFG[h.status];
            const P = PERFIL_META[h.tipo];
            return (
              <div key={h.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${P.cor}`, borderRadius: 10, padding: "13px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{h.nome}</div>
                    <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "monospace" }}>{h.doc}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: S.bg, color: S.cor, border: `1px solid ${S.border}`, alignSelf: "flex-start", whiteSpace: "nowrap" }}>{S.icon} {S.label}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, fontSize: 11, color: C.textSub }}>
                  <div><span style={{ color: C.textMuted }}>Data: </span>{h.data}</div>
                  <div><span style={{ color: C.textMuted }}>Itens: </span>{h.itens}</div>
                  <div><span style={{ color: C.textMuted }}>Cliente: </span>{h.cliente}</div>
                  <div style={{ fontWeight: 700, color: h.cobrado > 0 ? C.accent : C.textMuted }}>
                    <span style={{ color: C.textMuted, fontWeight: 400 }}>Valor: </span>
                    {h.cobrado > 0 ? `R$ ${h.cobrado.toFixed(2)}` : "Próprio"}
                  </div>
                  {isMaster && <div style={{ fontWeight: 700, color: C.yellow }}><span style={{ color: C.textMuted, fontWeight: 400 }}>API: </span>R$ {h.custo_api.toFixed(2)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: `55px 90px 1fr 130px 100px 60px 90px${isMaster ? " 80px 75px" : ""}`, padding: "9px 16px", background: "#F1F5FB", borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", gap: 8 }}>
            <span>Nº</span><span>Data</span><span>Nome / Doc</span><span>Cliente</span><span>Perfil</span><span>Itens</span><span>Valor</span>
            {isMaster && <><span>Custo API</span><span>Margem</span></>}
          </div>
          {filtered.map((h, i) => {
            const S = STATUS_CFG[h.status];
            const P = PERFIL_META[h.tipo];
            const margem = h.cobrado - h.custo_api;
            const pct = h.cobrado > 0 ? Math.round(margem / h.cobrado * 100) : 0;
            return (
              <div key={h.id} style={{ display: "grid", gridTemplateColumns: `55px 90px 1fr 130px 100px 60px 90px${isMaster ? " 80px 75px" : ""}`, padding: "11px 16px", borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", background: i % 2 === 0 ? C.surface : "#F8FAFC", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: C.textMuted, fontFamily: "monospace" }}>#{h.id}</span>
                <span style={{ fontSize: 11, color: C.textSub }}>{h.data}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{h.nome}</div>
                  <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "monospace" }}>{h.doc}</div>
                </div>
                <span style={{ fontSize: 11, color: C.textSub }}>{h.cliente}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 13 }}>{P.emoji}</span>
                  <span style={{ fontSize: 10, color: P.cor, fontWeight: 700 }}>{P.nome}</span>
                </div>
                <span style={{ fontSize: 11, textAlign: "center", color: C.textSub }}>{h.itens}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: h.cobrado > 0 ? C.accent : C.textMuted, fontFamily: "monospace" }}>{h.cobrado > 0 ? `R$ ${h.cobrado.toFixed(2)}` : "Próprio"}</span>
                  <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 6, background: S.bg, color: S.cor, border: `1px solid ${S.border}`, fontWeight: 700 }}>{S.icon}</span>
                </div>
                {isMaster && <>
                  <span style={{ fontSize: 11, color: C.yellow, fontFamily: "monospace" }}>R$ {h.custo_api.toFixed(2)}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: pct > 50 ? C.green : C.yellow }}>{h.cobrado > 0 ? `${pct}%` : "—"}</span>
                </>}
              </div>
            );
          })}
        </div>
      )}
      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button style={{ padding: "8px 15px", borderRadius: 8, border: `1.5px solid ${C.accent}30`, background: C.accentBg, color: C.accent, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>📊 Excel</button>
        <button style={{ padding: "8px 15px", borderRadius: 8, border: `1.5px solid ${C.navyMid}30`, background: "#EEF2F8", color: C.navyMid, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>📄 PDF</button>
      </div>
    </div>
  );
}

function MasterView({ mobile }) {
  const totalR = HISTORICO.reduce((a, h) => a + h.cobrado, 0);
  const totalC = HISTORICO.reduce((a, h) => a + h.custo_api, 0);
  const totalM = totalR - totalC;
  const porCliente = useMemo(() => {
    const m = {};
    HISTORICO.forEach(h => {
      if (!m[h.cliente]) m[h.cliente] = { c: h.cliente, n: 0, cob: 0, api: 0 };
      m[h.cliente].n++;
      m[h.cliente].cob += h.cobrado;
      m[h.cliente].api += h.custo_api;
    });
    return Object.values(m).sort((a, b) => b.cob - a.cob);
  }, []);

  return (
    <div style={{ padding: mobile ? "14px 12px" : "22px 24px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: 0 }}>Painel Master</h2>
        <span style={{ fontSize: 9, background: C.navy, color: "#fff", padding: "2px 8px", borderRadius: 10, fontWeight: 700, letterSpacing: 1 }}>CONFIDENCIAL</span>
      </div>
      <p style={{ fontSize: 12, color: C.textMuted, margin: "0 0 18px" }}>Receita, custo de API e margem — restrito a este painel</p>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10, marginBottom: 22 }}>
        {[
          { l: "Receita total", v: `R$ ${totalR.toFixed(2)}`, c: C.green, sub: `${HISTORICO.length} consultas` },
          { l: "Custo de API", v: `R$ ${totalC.toFixed(2)}`, c: C.yellow, sub: "Efetivo" },
          { l: "Margem bruta", v: `R$ ${totalM.toFixed(2)}`, c: C.accent, sub: `${Math.round(totalM / totalR * 100)}%` },
          { l: "Ticket médio", v: `R$ ${(totalR / HISTORICO.filter(h => h.cobrado > 0).length).toFixed(2)}`, c: C.navyMid, sub: "Dossiês pagos" },
        ].map(s => (
          <div key={s.l} style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${s.c}`, borderRadius: 10, padding: "13px 15px" }}>
            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 3 }}>{s.l}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: s.c, fontFamily: "monospace" }}>{s.v}</div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>{s.sub}</div>
          </div>
        ))}
      </div>
      <ApiHealthPanel mobile={mobile} />

      <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Por cliente</h3>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
        {mobile ? (
          porCliente.map((c, i) => {
            const m = c.cob - c.api; const pct = c.cob > 0 ? Math.round(m / c.cob * 100) : 0;
            return (
              <div key={i} style={{ padding: "13px 14px", borderBottom: i < porCliente.length - 1 ? `1px solid ${C.border}` : "none", background: i % 2 === 0 ? C.surface : "#F8FAFC" }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: C.text, marginBottom: 7 }}>{c.c}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, fontSize: 11 }}>
                  <div><span style={{ color: C.textMuted }}>Consultas: </span><strong>{c.n}</strong></div>
                  <div><span style={{ color: C.textMuted }}>Receita: </span><strong style={{ color: C.accent }}>{c.cob > 0 ? `R$ ${c.cob.toFixed(2)}` : "Próprio"}</strong></div>
                  <div><span style={{ color: C.textMuted }}>Custo API: </span><strong style={{ color: C.yellow }}>R$ {c.api.toFixed(2)}</strong></div>
                  <div><span style={{ color: C.textMuted }}>Margem: </span><strong style={{ color: C.green }}>{c.cob > 0 ? `${pct}%` : "—"}</strong></div>
                </div>
                {c.cob > 0 && <div style={{ marginTop: 8, height: 4, background: C.border, borderRadius: 4 }}><div style={{ width: `${pct}%`, height: "100%", background: C.green, borderRadius: 4 }} /></div>}
              </div>
            );
          })
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 90px 85px 80px 70px", padding: "9px 16px", background: "#F1F5FB", borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", gap: 8 }}>
              <span>Cliente</span><span>Consul.</span><span>Receita</span><span>Custo API</span><span>Margem</span><span>%</span>
            </div>
            {porCliente.map((c, i) => {
              const m = c.cob - c.api; const pct = c.cob > 0 ? Math.round(m / c.cob * 100) : 0;
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 90px 85px 80px 70px", padding: "12px 16px", borderBottom: i < porCliente.length - 1 ? `1px solid ${C.border}` : "none", background: i % 2 === 0 ? C.surface : "#F8FAFC", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{c.c}</span>
                  <span style={{ fontSize: 12, textAlign: "center", color: C.textSub }}>{c.n}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c.cob > 0 ? C.accent : C.textMuted, fontFamily: "monospace" }}>{c.cob > 0 ? `R$ ${c.cob.toFixed(2)}` : "Próprio"}</span>
                  <span style={{ fontSize: 12, color: C.yellow, fontFamily: "monospace" }}>R$ {c.api.toFixed(2)}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: m > 0 ? C.green : C.textMuted, fontFamily: "monospace" }}>{c.cob > 0 ? `R$ ${m.toFixed(2)}` : "—"}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: pct > 50 ? C.green : C.yellow }}>{c.cob > 0 ? `${pct}%` : "—"}</span>
                </div>
              );
            })}
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={{ padding: "8px 15px", borderRadius: 8, border: `1.5px solid ${C.accent}30`, background: C.accentBg, color: C.accent, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>📊 Excel</button>
        <button style={{ padding: "8px 15px", borderRadius: 8, border: `1.5px solid ${C.navyMid}30`, background: "#EEF2F8", color: C.navyMid, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>📄 Master PDF</button>
      </div>
    </div>
  );
}

// ─── API HEALTH PANEL ────────────────────────────────────────────────────────
const HEALTH_STATUS_CFG = {
  ok:             { label: "OK",           color: C.green,   bg: C.greenBg,   border: C.greenBorder,   icon: "✓" },
  slow:           { label: "Lenta",        color: C.yellow,  bg: C.yellowBg,  border: C.yellowBorder,  icon: "⚠" },
  fail:           { label: "Falhou",       color: C.red,     bg: C.redBg,     border: C.redBorder,     icon: "✕" },
  timeout:        { label: "Timeout",      color: C.red,     bg: C.redBg,     border: C.redBorder,     icon: "⏱" },
  proxy_required: { label: "Proxy",        color: C.gray,    bg: C.grayBg,    border: C.border,        icon: "⇌" },
  disabled:       { label: "Desabilitado", color: C.gray,    bg: C.grayBg,    border: C.border,        icon: "○" },
};

function ApiHealthPanel({ mobile }) {
  const [health,  setHealth]  = useState(() => getLastHealthCheck());
  const [running, setRunning] = useState(false);
  const [log,     setLog]     = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [cbState, setCbState] = useState({});
  const [cache,   setCache]   = useState(null);

  const refresh = useCallback(async () => {
    setRunning(true);
    try {
      const r = await runHealthCheck();
      setHealth(r);
    } finally {
      setRunning(false);
    }
  }, []);

  const openLog = () => {
    setLog(getApiLog(80));
    setCbState(getCircuitBreakerState());
    setCache(getCacheStats());
    setShowLog(true);
  };

  const results  = health ? Object.values(health.results) : [];
  const summary  = {
    ok:    results.filter(r => r.status === "ok").length,
    slow:  results.filter(r => r.status === "slow").length,
    fail:  results.filter(r => ["fail", "timeout"].includes(r.status)).length,
    proxy: results.filter(r => r.status === "proxy_required").length,
  };
  const hasProblems = summary.fail > 0 || summary.slow > 0;

  return (
    <div style={{ marginBottom: 22 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>Saúde das APIs</h3>
        {health && hasProblems && (
          <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}` }}>
            ✕ {summary.fail} COM FALHA
          </span>
        )}
        {health && !hasProblems && (
          <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}` }}>
            ✓ TUDO OK
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={openLog} style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface, color: C.textSub, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            📋 Log
          </button>
          <button onClick={refresh} disabled={running} style={{ padding: "5px 13px", borderRadius: 7, border: "none", background: running ? C.border : C.navyMid, color: running ? C.textMuted : "#fff", fontSize: 11, fontWeight: 700, cursor: running ? "not-allowed" : "pointer" }}>
            {running ? "Verificando…" : "🔄 Verificar agora"}
          </button>
        </div>
      </div>

      {!health && (
        <div style={{ background: C.grayBg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "18px", textAlign: "center", fontSize: 12, color: C.textMuted }}>
          Nenhuma verificação executada ainda. Clique em "Verificar agora" para rodar o health check.
        </div>
      )}

      {health && (
        <>
          {/* Summary badges */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 10 }}>
            {[
              { l: "OK",     v: summary.ok,    c: C.green,  bg: C.greenBg },
              { l: "Lenta",  v: summary.slow,  c: C.yellow, bg: C.yellowBg },
              { l: "Falhou", v: summary.fail,  c: C.red,    bg: C.redBg },
              { l: "Proxy",  v: summary.proxy, c: C.gray,   bg: C.grayBg },
            ].map(s => (
              <div key={s.l} style={{ background: s.bg, borderRadius: 8, padding: "8px", textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 10, color: s.c, fontWeight: 600 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Tabela de APIs */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 80px" : "1fr 60px 90px 100px", padding: "8px 14px", background: "#F1F5FB", borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", gap: 8 }}>
              <span>API</span>
              {!mobile && <><span>Versão</span><span>Latência</span></>}
              <span>Status</span>
            </div>
            {results.map((r, i) => {
              const sc = HEALTH_STATUS_CFG[r.status] || HEALTH_STATUS_CFG.disabled;
              return (
                <div key={r.id} style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 80px" : "1fr 60px 90px 100px", padding: "10px 14px", borderBottom: i < results.length - 1 ? `1px solid ${C.border}` : "none", background: i % 2 === 0 ? C.surface : "#F8FAFC", gap: 8, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{r.label}</div>
                    {r.error && <div style={{ fontSize: 10, color: C.red, marginTop: 2 }}>{r.error}</div>}
                  </div>
                  {!mobile && (
                    <>
                      <span style={{ fontSize: 10, fontWeight: 700, color: r.version === "V0" ? C.v0 : C.v2 }}>{r.version}</span>
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: C.textSub }}>
                        {r.latencyMs !== null ? `${r.latencyMs} ms` : "—"}
                      </span>
                    </>
                  )}
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 8, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, whiteSpace: "nowrap", textAlign: "center" }}>
                    {sc.icon} {sc.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: C.textMuted }}>
            Última verificação: {new Date(health.ts).toLocaleString("pt-BR")}
          </div>
        </>
      )}

      {/* Modal de Log */}
      {showLog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowLog(false)}>
          <div style={{ background: C.surface, borderRadius: 14, width: "100%", maxWidth: 680, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Log de APIs</div>
                {cache && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Cache: {cache.valid} válidos · {cache.expired} expirados</div>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { clearApiLog(); setLog([]); }} style={{ padding: "5px 11px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.redBg, color: C.red, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>🗑 Limpar</button>
                <button onClick={() => { clearApiCache(); setCache(getCacheStats()); }} style={{ padding: "5px 11px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.yellowBg, color: C.yellow, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>🗑 Cache</button>
                <button onClick={() => { resetCircuitBreaker(); setCbState({}); }} style={{ padding: "5px 11px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.accentBg, color: C.accent, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>↺ CB</button>
                <button onClick={() => setShowLog(false)} style={{ padding: "5px 11px", borderRadius: 7, border: `1px solid ${C.border}`, background: "#F8FAFC", color: C.textSub, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>✕</button>
              </div>
            </div>
            <div style={{ overflowY: "auto", padding: "12px 16px", fontFamily: "monospace", fontSize: 11 }}>
              {log.length === 0 && <div style={{ color: C.textMuted, textAlign: "center", padding: "20px" }}>Nenhum registro no log.</div>}
              {log.map((e, i) => {
                const isOk = e.status === "ok" || e.status === "cache";
                const isFail = e.status === "fail" || e.status === "timeout";
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "150px 160px 70px 60px 1fr", gap: 8, padding: "5px 0", borderBottom: `1px solid ${C.border}`, alignItems: "center", color: isFail ? C.red : isOk ? C.green : C.textSub }}>
                    <span style={{ color: C.textMuted, fontSize: 10 }}>{new Date(e.ts).toLocaleString("pt-BR")}</span>
                    <span style={{ fontWeight: 600, color: C.text }}>{e.api}</span>
                    <span style={{ fontWeight: 700 }}>{e.status}</span>
                    <span style={{ color: C.textMuted }}>{e.latencyMs != null ? `${e.latencyMs}ms` : ""}</span>
                    <span style={{ color: C.red, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.error || e.code || ""}</span>
                  </div>
                );
              })}
            </div>
            {/* Circuit breaker state */}
            {Object.keys(cbState).length > 0 && (
              <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.border}`, background: C.yellowBg }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.yellow, marginBottom: 6 }}>Circuit Breakers abertos:</div>
                {Object.entries(cbState).filter(([, v]) => v.state !== "closed").map(([id, v]) => (
                  <div key={id} style={{ fontSize: 11, color: C.red }}>{id}: {v.state} ({v.failures} falhas)</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
const PERFIL_IDS = ["motorista", "admin", "confianca", "autonomo", "empresa1", "empresa2"];
const VIEW_TABS = ["consulta", "dossie", "historico", "master"];

export default function App() {
  const mobile = useIsMobile();
  const [isMaster, setIsMaster] = useState(false);
  const [view, setView] = useState("consulta");
  const [perfilAtivo, setPerfilAtivo] = useState("motorista");

  // Auto health check: roda se nunca foi executado ou se passaram mais de 24h
  useEffect(() => {
    const last = getLastHealthCheck();
    const stale = !last || (Date.now() - new Date(last.ts).getTime() > 86_400_000);
    if (stale) {
      // Roda em background sem bloquear a UI
      runHealthCheck().catch(() => {});
    }
  }, []);

  const pfs = PERFIL_IDS.filter(id => !id.startsWith("empresa"));
  const pjs = PERFIL_IDS.filter(id => id.startsWith("empresa"));

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif", WebkitFontSmoothing: "antialiased" }}>
      {/* TOPBAR */}
      <div style={{ background: C.navy, padding: mobile ? "0 12px" : "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, borderBottom: "1px solid rgba(255,255,255,0.08)", position: "sticky", top: 0, zIndex: 50, gap: 10 }}>
        <AZLogo dark size="sm" />
        <div style={{ display: "flex", gap: 2, overflowX: "auto" }}>
          {(isMaster ? VIEW_TABS : VIEW_TABS.filter(v => v !== "master")).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: mobile ? "5px 9px" : "6px 13px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: mobile ? 11 : 12, fontWeight: 600, whiteSpace: "nowrap", background: view === v ? "rgba(255,255,255,0.18)" : "transparent", color: view === v ? "#fff" : "rgba(255,255,255,0.48)", transition: "all 0.15s" }}>
              {v === "consulta" ? "🔎 Consultar" : v === "dossie" ? "📋 Relatório" : v === "historico" ? "🕐 Histórico" : "📊 Master"}
            </button>
          ))}
        </div>
        <button onClick={() => { setIsMaster(!isMaster); if (isMaster && view === "master") setView("dossie"); }} style={{ padding: mobile ? "4px 9px" : "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: mobile ? 10 : 11, fontWeight: 700, background: isMaster ? "#EAB308" : "rgba(255,255,255,0.12)", color: isMaster ? C.navy : "rgba(255,255,255,0.6)", flexShrink: 0 }}>
          {isMaster ? "🔐 MASTER" : "🔒 Master"}
        </button>
      </div>

      {/* PERFIL TABS (apenas no relatório) */}
      {view === "dossie" && (
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: mobile ? "0 10px" : "0 22px", overflowX: "auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 0, minWidth: "max-content" }}>
            <span style={{ fontSize: 9, color: C.textMuted, letterSpacing: 2, textTransform: "uppercase", padding: "0 8px 12px 0", alignSelf: "flex-end", flexShrink: 0 }}>PF</span>
            {pfs.map(id => {
              const p = PERFIL_META[id];
              return (
                <button key={id} onClick={() => setPerfilAtivo(id)} style={{ padding: mobile ? "9px 11px" : "10px 13px", border: "none", cursor: "pointer", fontSize: mobile ? 11 : 12, fontWeight: 700, background: "transparent", color: perfilAtivo === id ? p.cor : C.textMuted, borderBottom: `2.5px solid ${perfilAtivo === id ? p.cor : "transparent"}`, transition: "all 0.15s", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 15 }}>{p.emoji}</span>{mobile ? "" : p.nome}
                </button>
              );
            })}
            <div style={{ width: 1, background: C.border, margin: "0 6px", height: 28, alignSelf: "flex-end", marginBottom: 10 }} />
            <span style={{ fontSize: 9, color: C.textMuted, letterSpacing: 2, textTransform: "uppercase", padding: "0 8px 12px 0", alignSelf: "flex-end", flexShrink: 0 }}>PJ</span>
            {pjs.map(id => {
              const p = PERFIL_META[id];
              return (
                <button key={id} onClick={() => setPerfilAtivo(id)} style={{ padding: mobile ? "9px 11px" : "10px 13px", border: "none", cursor: "pointer", fontSize: mobile ? 11 : 12, fontWeight: 700, background: "transparent", color: perfilAtivo === id ? p.cor : C.textMuted, borderBottom: `2.5px solid ${perfilAtivo === id ? p.cor : "transparent"}`, transition: "all 0.15s", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 15 }}>{p.emoji}</span>{mobile ? "" : p.nome}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* CONTENT */}
      <div style={{ minHeight: "calc(100vh - 52px)", overflowX: "hidden" }}>
        {view === "consulta"  && <ErrorBoundary><ConsultaView mobile={mobile} /></ErrorBoundary>}
        {view === "dossie"    && <DossieView key={perfilAtivo} mobile={mobile} perfilId={perfilAtivo} />}
        {view === "historico" && <HistoricoView mobile={mobile} isMaster={isMaster} />}
        {view === "master"    && isMaster  && <MasterView mobile={mobile} />}
        {view === "master"    && !isMaster && <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>Acesso restrito ao painel master.</div>}
      </div>
    </div>
  );
}
