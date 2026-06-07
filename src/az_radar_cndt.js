// Integração CNDT — via proxy Vercel (evita CORS)

export async function consultarCNDT(cpfCnpj) {
  const doc = cpfCnpj.replace(/\D/g, "");
  try {
    const res = await fetch(`/api/cndt?cpfCnpj=${doc}`);
    return await res.json();
  } catch (e) {
    return { fonte: "CNDT — Débitos Trabalhistas (TST)", status: "erro", erro: e.message, total: 0, ocorrencias: [] };
  }
}
