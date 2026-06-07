// Busca URLs de download do CEIS/CNEP via API do dados.gov.br (CKAN)
import fetch from "node-fetch";

const DATASETS = [
  { nome: "CEIS", id: "cadastro-de-empresas-inidoneas-e-suspensas-ceis" },
  { nome: "CNEP", id: "cadastro-nacional-de-empresas-punidas-cnep" },
];

for (const ds of DATASETS) {
  const url = `https://dados.gov.br/api/3/action/package_show?id=${ds.id}`;
  console.log(`\n=== ${ds.nome} ===`);
  console.log(`Consultando: ${url}`);

  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  console.log("Status:", res.status);

  if (!res.ok) { console.log("Erro:", res.statusText); continue; }

  const json = await res.json();
  const resources = json?.result?.resources || [];
  console.log(`Recursos encontrados: ${resources.length}`);
  resources.forEach(r => {
    console.log(`  - ${r.name || r.description || "(sem nome)"}`);
    console.log(`    format: ${r.format}`);
    console.log(`    url: ${r.url}`);
  });
}

process.exit(0);
