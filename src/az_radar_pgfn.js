// Integração PGFN — via proxy Vercel (evita CORS)

export async function consultarPGFN(cpfCnpj) {
  const doc = cpfCnpj.replace(/\D/g, "");
  try {
    const res = await fetch(`/api/pgfn?cpfCnpj=${doc}`);
    return await res.json();
  } catch (e) {
    return { fonte: "PGFN — Dívida Ativa da União", status: "erro", erro: e.message, total: 0, ocorrencias: [] };
  }
}
