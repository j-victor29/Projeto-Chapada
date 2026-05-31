export type ProjetoStatus = "Planejamento" | "Em execução" | "Concluído" | "Suspenso";

export interface Projeto {
  id: string;
  nome: string;
  contrato: string;
  financiador: string;
  inicio: string; // ISO
  termino: string;
  valor: number;
  municipios: string[];
  publicoQuant: number;
  publicoCaract: string;
  status: ProjetoStatus;
}

export interface Atividade {
  id: string;
  projetoId: string;
  data: string;
  descricao: string;
  responsaveis: string;
  tipo: string;
  local: string;
}

export const FINANCIADORES = [
  "BNB - Banco do Nordeste",
  "Petrobras Socioambiental",
  "Fundação Banco do Brasil",
  "MDA - Ministério do Desenvolvimento Agrário",
  "Cáritas Brasileira",
  "Misereor",
];

export const MUNICIPIOS = [
  "Araripina",
  "Ouricuri",
  "Trindade",
  "Bodocó",
  "Granito",
  "Santa Cruz",
  "Ipubi",
  "Moreilândia",
  "Exu",
  "Serrita",
];

export const projetosMock: Projeto[] = [
  {
    id: "1",
    nome: "Sementes do Sertão",
    contrato: "CV-2024-001",
    financiador: "BNB - Banco do Nordeste",
    inicio: "2024-03-01",
    termino: "2026-02-28",
    valor: 1_250_000,
    municipios: ["Araripina", "Ouricuri", "Trindade"],
    publicoQuant: 320,
    publicoCaract: "Famílias de agricultores familiares, mulheres e jovens rurais",
    status: "Em execução",
  },
  {
    id: "2",
    nome: "Cisternas para a Vida",
    contrato: "CV-2023-014",
    financiador: "Fundação Banco do Brasil",
    inicio: "2023-06-15",
    termino: "2025-06-14",
    valor: 880_000,
    municipios: ["Bodocó", "Granito", "Serrita"],
    publicoQuant: 210,
    publicoCaract: "Famílias quilombolas e comunidades tradicionais",
    status: "Em execução",
  },
  {
    id: "3",
    nome: "Mulheres da Caatinga",
    contrato: "PT-2022-007",
    financiador: "Misereor",
    inicio: "2022-01-10",
    termino: "2024-12-31",
    valor: 540_000,
    municipios: ["Exu", "Moreilândia"],
    publicoQuant: 180,
    publicoCaract: "Mulheres rurais e jovens em situação de vulnerabilidade",
    status: "Concluído",
  },
  {
    id: "4",
    nome: "Juventude do Araripe",
    contrato: "CV-2024-022",
    financiador: "Petrobras Socioambiental",
    inicio: "2024-08-01",
    termino: "2026-07-31",
    valor: 1_700_000,
    municipios: ["Araripina", "Ipubi", "Santa Cruz"],
    publicoQuant: 260,
    publicoCaract: "Jovens rurais e indígenas",
    status: "Em execução",
  },
  {
    id: "5",
    nome: "Quintais Produtivos",
    contrato: "CV-2021-003",
    financiador: "Cáritas Brasileira",
    inicio: "2021-04-01",
    termino: "2023-03-31",
    valor: 420_000,
    municipios: ["Trindade", "Ouricuri"],
    publicoQuant: 150,
    publicoCaract: "Famílias agricultoras",
    status: "Suspenso",
  },
];

const tiposAtv = ["Oficina", "Entrega", "Encontro", "Visita Técnica", "Capacitação", "Mobilização", "Plantio", "Roda de conversa"];
const locaisAtv = [
  "Comunidade Olho d'Água — Araripina",
  "Quilombo Conceição das Crioulas — Salgueiro",
  "Sede CHAPADA — Araripina",
  "Sítio São João — Trindade",
  "Assentamento Boa Vista — Ouricuri",
  "Comunidade Riacho Verde — Bodocó",
  "Povoado Lagoa Grande — Exu",
  "Sítio Cajueiro — Ipubi",
];
const respAtv = [
  "Maria Lúcia, José Pedro",
  "Equipe técnica CHAPADA",
  "Ana Beatriz, Carlos Henrique",
  "Equipe agroecologia",
  "Lúcia Ferreira",
  "José Pedro Lima",
];
const descAtv = [
  "Oficina de manejo de sementes crioulas com agricultoras",
  "Entrega de cisternas de placas em comunidade quilombola",
  "Encontro de juventudes rurais com participantes da região",
  "Visita técnica a unidades demonstrativas de agroecologia",
  "Capacitação em produção de mudas nativas da caatinga",
  "Mobilização social em torno do acesso à água",
  "Plantio coletivo em quintal produtivo agroecológico",
  "Roda de conversa sobre soberania alimentar",
  "Reunião de avaliação trimestral com lideranças locais",
  "Formação em gestão associativa para agricultoras",
];

export const atividadesMock: Atividade[] = Array.from({ length: 38 }, (_, i) => {
  const projeto = projetosMock[i % projetosMock.length];
  const day = 28 - (i % 28);
  const month = 4 - Math.floor(i / 12);
  const mm = String(Math.max(1, month)).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return {
    id: `a${i + 1}`,
    projetoId: projeto.id,
    data: `2025-${mm}-${dd}`,
    descricao: descAtv[i % descAtv.length],
    responsaveis: respAtv[i % respAtv.length],
    tipo: tiposAtv[i % tiposAtv.length],
    local: locaisAtv[i % locaisAtv.length],
  };
}).sort((a, b) => b.data.localeCompare(a.data));

export const kpis = {
  projetosAtivos: projetosMock.filter((p) => p.status === "Em execução").length,
  familias: 1120,
  mulheres: 640,
  jovens: 380,
  comunidades: 47,
  tecnologias: 215,
  quilombolas: 180,
  povosOriginarios: 95,
};

export const projetosPorAno = [
  { ano: "2021", projetos: 2 },
  { ano: "2022", projetos: 3 },
  { ano: "2023", projetos: 5 },
  { ano: "2024", projetos: 7 },
  { ano: "2025", projetos: 9 },
];

export const projetosPorFinanciador = FINANCIADORES.slice(0, 5).map((f, i) => ({
  financiador: f.split(" - ")[0].split(" ")[0],
  projetos: [4, 3, 2, 2, 1][i],
}));

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
