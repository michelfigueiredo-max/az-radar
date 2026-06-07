// Vercel Serverless Function — consulta sanções por CPF/CNPJ no banco Neon
// GET /api/sanctions?cpfCnpj=12345678000199

import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ erro: "Método não permitido" });

  const cpfCnpj    = (req.query.cpfCnpj    || "").replace(/\D/g, "");
  const nomeQuery  = (req.query.nome       || "").trim();
  const cpfParcial = (req.query.cpfParcial || "").replace(/\D/g, "");

  // Busca por nome + CPF parcial (consulta de sócio sem CPF completo)
  if (nomeQuery) {
    try {
      const sql = neon(process.env.DATABASE_URL);
      const palavras = nomeQuery.split(/\s+/).filter(p => p.length > 2);
      // Monta filtro: todas as palavras devem estar no nome (case-insensitive)
      let rows;
      if (cpfParcial) {
        rows = await sql`
          SELECT fonte, cpf_cnpj, nome, sancao, orgao, esfera, data_inicio, data_fim, multa
          FROM sancoes
          WHERE nome ILIKE ${"%" + palavras.join("%") + "%"}
            AND cpf_cnpj LIKE ${"%" + cpfParcial + "%"}
          ORDER BY fonte, data_inicio DESC
          LIMIT 20
        `;
      } else {
        rows = await sql`
          SELECT fonte, cpf_cnpj, nome, sancao, orgao, esfera, data_inicio, data_fim, multa
          FROM sancoes
          WHERE nome ILIKE ${"%" + palavras.join("%") + "%"}
          ORDER BY fonte, data_inicio DESC
          LIMIT 20
        `;
      }
      return res.status(200).json({ total: rows.length, ocorrencias: rows, modo: "nome" });
    } catch (e) {
      return res.status(500).json({ erro: "Erro ao consultar banco", detalhe: e.message });
    }
  }

  if (!cpfCnpj) return res.status(400).json({ erro: "cpfCnpj ou nome obrigatório" });

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
