// Vercel Serverless Function — consulta sanções por CPF/CNPJ no banco Neon
// GET /api/sanctions?cpfCnpj=12345678000199

import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ erro: "Método não permitido" });

  const cpfCnpj = (req.query.cpfCnpj || "").replace(/\D/g, "");
  if (!cpfCnpj) return res.status(400).json({ erro: "cpfCnpj obrigatório" });

  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT fonte, nome, sancao, orgao, esfera, data_inicio, data_fim, multa
      FROM sancoes
      WHERE cpf_cnpj = ${cpfCnpj}
      ORDER BY fonte, data_inicio DESC
      LIMIT 50
    `;
    return res.status(200).json({ total: rows.length, ocorrencias: rows });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao consultar banco", detalhe: e.message });
  }
}
