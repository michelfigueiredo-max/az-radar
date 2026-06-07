import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  if (req.method === "POST") {
    const { cpf_cnpj, perfil_id, perfil_nome, resultado, status_geral, nome_consultado } = req.body || {};
    if (!cpf_cnpj) return res.status(400).json({ erro: "cpf_cnpj obrigatório" });
    await sql`
      INSERT INTO consultas (cpf_cnpj, perfil_id, perfil_nome, resultado, status_geral, nome_consultado)
      VALUES (${cpf_cnpj}, ${perfil_id}, ${perfil_nome}, ${JSON.stringify(resultado)}, ${status_geral}, ${nome_consultado || ""})
    `;
    return res.status(200).json({ ok: true });
  }

  if (req.method === "GET") {
    const rows = await sql`
      SELECT id, cpf_cnpj, perfil_id, perfil_nome, status_geral, nome_consultado, criado_em
      FROM consultas
      ORDER BY criado_em DESC
      LIMIT 200
    `;
    return res.status(200).json({ consultas: rows });
  }

  return res.status(405).json({ erro: "Método não permitido" });
}
