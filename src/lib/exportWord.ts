import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Tab,
  TabStopPosition,
  TabStopType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { coresPDF, hexWithoutHash } from "@/lib/exportColors";

export interface FiltrosIndicadores {
  dataDe?: string;
  dataAte?: string;
  periodoLabel: string;
}

export interface KpiResumo {
  indicador: string;
  total: number;
}

export interface ProjetoDesempenho {
  id: string;
  nome: string;
  contrato: string;
  financiador: string;
  inicio: string;
  termino: string;
  valor: number;
  municipios: string[];
  status: StatusProjeto;
  atividades: number;
  participantes: number;
  mulheres: number;
}

export interface MunicipioDistribuicao {
  municipio: string;
  participantes: number;
  projetos: number;
  atividades: number;
  tecnologias: number;
}

export interface GrupoBeneficiario {
  grupo: string;
  total: number;
}

export interface AtividadeMensal {
  mes: string;
  atividades: number;
  acoesIndependentes: number;
}

export interface TecnologiaSocial {
  categoria: string;
  nome: string;
  quantidade: number;
  familias: number;
  projeto: string;
  municipio: string;
  data: string;
}

export type StatusProjeto = "Planejamento" | "Em execução" | "Concluído" | "Suspenso";

export interface DadosIndicadores {
  filtros: FiltrosIndicadores;
  geradoEm: Date;
  kpis: KpiResumo[];
  projetos: ProjetoDesempenho[];
  municipios: MunicipioDistribuicao[];
  gruposBeneficiarios: GrupoBeneficiario[];
  atividadesMensais: AtividadeMensal[];
  tecnologias: TecnologiaSocial[];
}

const PAGE_WIDTH_DXA = 11906;
const PAGE_HEIGHT_DXA = 16838;
const MARGIN_DXA = 1134;
const CONTENT_WIDTH_DXA = 9638;
const FONT = "Arial";
const BLUE = hexWithoutHash(coresPDF.titulo);
const HEADING_BLUE = hexWithoutHash(coresPDF.subtitulo);
const WHITE = "FFFFFF";
const ROW_EVEN = hexWithoutHash(coresPDF.tabelaLinhaPar);
const ROW_ODD = hexWithoutHash(coresPDF.tabelaLinhaImpar);
const TOTAL = hexWithoutHash(coresPDF.totalDestaque);
const BORDER = hexWithoutHash(coresPDF.borda);
const CELL_MARGINS = { top: 80, bottom: 80, left: 120, right: 120 };

const column = (parts: number[]) =>
  parts.map((part) => Math.floor((CONTENT_WIDTH_DXA * part) / parts.reduce((sum, item) => sum + item, 0)));

const fmtNumber = (value: number) => value.toLocaleString("pt-BR");

const fmtCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
};

const paragraph = (text: string, options?: { bold?: boolean; color?: string; size?: number; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType] }) =>
  new Paragraph({
    alignment: options?.alignment,
    children: [
      new TextRun({
        text,
        font: FONT,
        size: options?.size ?? 22,
        bold: options?.bold,
        color: options?.color ?? "111827",
      }),
    ],
  });

const tituloSecao = (text: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 260, after: 120 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: 28,
        bold: true,
        color: BLUE,
      }),
    ],
  });

const subtitulo = (text: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 160, after: 80 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: 24,
        bold: true,
        color: HEADING_BLUE,
      }),
    ],
  });

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

export function celCabecalho(text: string, width: number) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: CELL_MARGINS,
    shading: { type: ShadingType.CLEAR, fill: BLUE, color: "auto" },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, font: FONT, size: 20, bold: true, color: WHITE })],
      }),
    ],
  });
}

export function celDados(text: string | number, width: number, even = false) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: CELL_MARGINS,
    shading: { type: ShadingType.CLEAR, fill: even ? ROW_EVEN : ROW_ODD, color: "auto" },
    children: [paragraph(String(text), { size: 20 })],
  });
}

export function celTotal(text: string | number, width: number) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: CELL_MARGINS,
    shading: { type: ShadingType.CLEAR, fill: TOTAL, color: "auto" },
    children: [paragraph(String(text), { size: 20, bold: true })],
  });
}

const tabela = (headers: string[], rows: Array<Array<string | number>>, widths: number[], totalRow?: Array<string | number>) =>
  new Table({
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: widths,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER },
      left: { style: BorderStyle.SINGLE, size: 1, color: BORDER },
      right: { style: BorderStyle.SINGLE, size: 1, color: BORDER },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: BORDER },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: BORDER },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((header, index) => celCabecalho(header, widths[index] ?? widths[0])),
      }),
      ...rows.map(
        (row, rowIndex) =>
          new TableRow({
            children: row.map((cell, index) => celDados(cell, widths[index] ?? widths[0], rowIndex % 2 === 0)),
          })
      ),
      ...(totalRow
        ? [
            new TableRow({
              children: totalRow.map((cell, index) => celTotal(cell, widths[index] ?? widths[0])),
            }),
          ]
        : []),
    ],
  });

const emptyRow = (cols: number) => [Array.from({ length: cols }, (_, index) => (index === 0 ? "Nenhum dado disponível" : "-"))];

const logoParagraph = (logoData?: ArrayBuffer) =>
  logoData
    ? new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 220 },
        children: [
          new ImageRun({
            data: logoData,
            transformation: { width: 120, height: 120 },
            type: "png",
          }),
        ],
      })
    : paragraph("CHAPADA", { size: 42, bold: true, color: BLUE, alignment: AlignmentType.CENTER });

const capa = (dados: DadosIndicadores, logoData?: ArrayBuffer) => [
  new Paragraph({ spacing: { before: 1800 } }),
  logoParagraph(logoData),
  paragraph("CHAPADA", { size: 42, bold: true, color: BLUE, alignment: AlignmentType.CENTER }),
  paragraph("Centro de Habilitação e Apoio ao Pequeno Agricultor do Araripe", {
    size: 24,
    color: BLUE,
    alignment: AlignmentType.CENTER,
  }),
  new Paragraph({ spacing: { before: 520 } }),
  paragraph("Relatório de Indicadores e Beneficiários", {
    size: 34,
    bold: true,
    color: "111827",
    alignment: AlignmentType.CENTER,
  }),
  new Paragraph({ spacing: { before: 240 } }),
  paragraph(`Período: ${dados.filtros.periodoLabel}`, { size: 24, alignment: AlignmentType.CENTER }),
  paragraph(`Gerado em: ${dados.geradoEm.toLocaleDateString("pt-BR")}`, { size: 22, alignment: AlignmentType.CENTER }),
  pageBreak(),
];

const header = (periodo: string) =>
  new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: "CHAPADA", font: FONT, size: 18, bold: true, color: BLUE }),
          new Tab(),
          new TextRun({ text: periodo, font: FONT, size: 18, color: "475569" }),
        ],
      }),
    ],
  });

const footer = () =>
  new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: "Relatório de Indicadores", font: FONT, size: 18, color: "64748B" }),
          new Tab(),
          new TextRun({ text: "Página ", font: FONT, size: 18, color: "64748B" }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: "64748B" }),
        ],
      }),
    ],
  });

const resumoExecutivo = (dados: DadosIndicadores) => {
  const widths = column([3, 1]);
  return [
    tituloSecao("1. Resumo Executivo"),
    paragraph("Síntese dos principais indicadores consolidados para o período selecionado."),
    tabela(
      ["Indicador", "Total"],
      dados.kpis.map((kpi) => [kpi.indicador, fmtNumber(kpi.total)]),
      widths
    ),
  ];
};

const desempenhoProjetos = (dados: DadosIndicadores) => {
  const widths = column([3, 2, 2, 1, 1]);
  return [
    tituloSecao("2. Desempenho por Projeto"),
    tabela(
      ["Projeto", "Financiador", "Status", "Atividades", "Participantes"],
      dados.projetos.length
        ? dados.projetos.map((projeto) => [
            projeto.nome,
            projeto.financiador || "-",
            projeto.status,
            fmtNumber(projeto.atividades),
            fmtNumber(projeto.participantes),
          ])
        : emptyRow(5),
      widths
    ),
    subtitulo("Valores e vigência"),
    tabela(
      ["Projeto", "Contrato", "Vigência", "Valor", "Municípios"],
      dados.projetos.length
        ? dados.projetos.map((projeto) => [
            projeto.nome,
            projeto.contrato || "-",
            `${fmtDate(projeto.inicio)} a ${fmtDate(projeto.termino)}`,
            fmtCurrency(projeto.valor),
            projeto.municipios.join(", ") || "-",
          ])
        : emptyRow(5),
      column([3, 2, 2, 2, 3])
    ),
  ];
};

const distribuicaoMunicipio = (dados: DadosIndicadores) => [
  tituloSecao("3. Distribuição por Município"),
  tabela(
    ["Município", "Participantes", "Projetos", "Atividades", "Tecnologias"],
    dados.municipios.length
      ? dados.municipios.map((municipio) => [
          municipio.municipio,
          fmtNumber(municipio.participantes),
          fmtNumber(municipio.projetos),
          fmtNumber(municipio.atividades),
          fmtNumber(municipio.tecnologias),
        ])
      : emptyRow(5),
    column([3, 1, 1, 1, 1])
  ),
];

const beneficiariosGrupo = (dados: DadosIndicadores) => [
  tituloSecao("4. Beneficiários por Grupo"),
  tabela(
    ["Grupo", "Total"],
    dados.gruposBeneficiarios.map((grupo) => [grupo.grupo, fmtNumber(grupo.total)]),
    column([3, 1])
  ),
];

const atividadesTempo = (dados: DadosIndicadores) => [
  tituloSecao("5. Atividades ao Longo do Tempo"),
  tabela(
    ["Mês", "Atividades vinculadas", "Ações independentes", "Total"],
    dados.atividadesMensais.length
      ? dados.atividadesMensais.map((item) => [
          item.mes,
          fmtNumber(item.atividades),
          fmtNumber(item.acoesIndependentes),
          fmtNumber(item.atividades + item.acoesIndependentes),
        ])
      : emptyRow(4),
    column([2, 2, 2, 1])
  ),
];

const tecnologiasSociais = (dados: DadosIndicadores) => [
  tituloSecao("6. Tecnologias Sociais"),
  tabela(
    ["Categoria", "Tecnologia", "Quantidade", "Famílias", "Projeto", "Município"],
    dados.tecnologias.length
      ? dados.tecnologias.map((tecnologia) => [
          tecnologia.categoria,
          tecnologia.nome,
          fmtNumber(tecnologia.quantidade),
          fmtNumber(tecnologia.familias),
          tecnologia.projeto,
          tecnologia.municipio || "-",
        ])
      : emptyRow(6),
    column([3, 3, 1, 1, 2, 2])
  ),
];

const resumoConsolidado = (dados: DadosIndicadores) => {
  const totalParticipantes = dados.kpis.find((kpi) => kpi.indicador === "Total de Participantes")?.total ?? 0;
  const totalAtividades = dados.kpis.find((kpi) => kpi.indicador === "Atividades Realizadas")?.total ?? 0;
  const totalAcoes = dados.kpis.find((kpi) => kpi.indicador === "Ações Independentes")?.total ?? 0;
  const totalTecnologias = dados.kpis.find((kpi) => kpi.indicador === "Tecnologias Sociais")?.total ?? 0;
  const municipios = dados.municipios.length;

  return [
    tituloSecao("7. Resumo Consolidado"),
    paragraph(
      `No período ${dados.filtros.periodoLabel}, a CHAPADA registrou ${fmtNumber(totalAtividades)} atividades vinculadas a projetos e ${fmtNumber(totalAcoes)} ações independentes.`
    ),
    paragraph(
      `As ações alcançaram ${fmtNumber(totalParticipantes)} participantes em ${fmtNumber(municipios)} municípios, considerando os registros disponíveis no sistema.`
    ),
    paragraph(
      `Também foram registradas ${fmtNumber(totalTecnologias)} tecnologias sociais, reforçando a atuação territorial e produtiva junto às comunidades acompanhadas.`
    ),
  ];
};

export function gerarDocumentoWord(dados: DadosIndicadores, logoData?: ArrayBuffer): Document {
  return new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 22 },
          paragraph: { spacing: { after: 120 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH_DXA, height: PAGE_HEIGHT_DXA },
            margin: {
              top: MARGIN_DXA,
              right: MARGIN_DXA,
              bottom: MARGIN_DXA,
              left: MARGIN_DXA,
            },
          },
        },
        children: capa(dados, logoData),
      },
      {
        headers: { default: header(dados.filtros.periodoLabel) },
        footers: { default: footer() },
        properties: {
          page: {
            size: { width: PAGE_WIDTH_DXA, height: PAGE_HEIGHT_DXA },
            margin: {
              top: MARGIN_DXA,
              right: MARGIN_DXA,
              bottom: MARGIN_DXA,
              left: MARGIN_DXA,
            },
          },
        },
        children: [
          ...resumoExecutivo(dados),
          ...desempenhoProjetos(dados),
          ...distribuicaoMunicipio(dados),
          ...beneficiariosGrupo(dados),
          ...atividadesTempo(dados),
          ...tecnologiasSociais(dados),
          ...resumoConsolidado(dados),
        ],
      },
    ],
  });
}
