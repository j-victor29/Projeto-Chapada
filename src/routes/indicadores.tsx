import { createFileRoute } from "@tanstack/react-router";
import { useRef, useMemo, useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet, X, RefreshCw } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useAtividades, useAtividadesIndependentes, refreshAtividades } from "@/lib/atividadesStore";
import { useProjetos } from "@/lib/projetosStore";
import { useTecnologias, CATEGORIAS } from "@/lib/tecnologiasStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatBRL } from "@/lib/mockData";
import chapadaLogo from "@/assets/chapada-logo.png";

export const Route = createFileRoute("/indicadores")({
  component: IndicadoresPage,
});


const COLORS = [
  "oklch(0.6 0.16 40)",
  "oklch(0.5 0.1 145)",
  "oklch(0.72 0.13 75)",
  "oklch(0.45 0.07 50)",
  "oklch(0.65 0.12 110)",
];

// Convert logo URL to base64 for jsPDF
async function imageToBase64(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("No canvas context")); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
}

// Draw repeating header on every page
function drawPageHeader(
  doc: jsPDF,
  logoB64: string | null,
  periodoLabel: string
) {
  const pageW = doc.internal.pageSize.getWidth();

  // Green bar at top
  doc.setFillColor(45, 90, 39); // #2d5a27
  doc.rect(0, 0, pageW, 30, "F");

  // Logo
  if (logoB64) {
    try {
      doc.addImage(logoB64, "PNG", 10, 3, 24, 24);
    } catch (_) { /* ignore logo errors */ }
  }

  // Title block
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Centro de Habilitação e Apoio ao Pequeno Agricultor do Araripe", pageW / 2, 11, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Relatório de Indicadores e Beneficiários", pageW / 2, 18, { align: "center" });
  doc.text(`Período: ${periodoLabel}`, pageW / 2, 24, { align: "center" });

  // Reset text color
  doc.setTextColor(30, 30, 30);
}

// Draw repeating footer on every page
function drawPageFooter(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const totalPages = (doc.internal as any).getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    (doc as any).setPage(i);

    doc.setFillColor(45, 90, 39);
    doc.rect(0, pageH - 14, pageW, 14, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("CHAPADA — chapada@ongchapada.org.br", 14, pageH - 5);
    doc.text(`Página ${i} de ${totalPages}`, pageW - 14, pageH - 5, { align: "right" });
    doc.setTextColor(30, 30, 30);
  }
}

// Section heading helper
function sectionTitle(doc: jsPDF, title: string, y: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(45, 90, 39);
  doc.rect(14, y, pageW - 28, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(title, 18, y + 5.5);
  doc.setTextColor(30, 30, 30);
  return y + 12;
}

function IndicadoresPage() {
  const barRef = useRef<HTMLDivElement>(null);
  const pieRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return;
    refreshAtividades();
  }, [user?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAtividades();
      toast.success("Indicadores atualizados com sucesso.");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao atualizar indicadores.");
    } finally {
      setRefreshing(false);
    }
  };

  // Filtros
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const isPeriodInvalid = !!(dataDe && dataAte && dataDe > dataAte);

  const hasActiveFilters = !!(dataDe || dataAte);
  const clearFilters = () => {
    setDataDe("");
    setDataAte("");
  };

  // Data stores
  const atividadesVinculadas = useAtividades();
  const atividadesIndependentes = useAtividadesIndependentes();
  const projetos = useProjetos();
  const tecnologias = useTecnologias();

  const filteredVinculadas = useMemo(() => {
    return atividadesVinculadas.filter((a) => {
      if (dataDe && a.data < dataDe) return false;
      if (dataAte && a.data > dataAte) return false;
      return true;
    });
  }, [atividadesVinculadas, dataDe, dataAte]);

  const filteredIndependentes = useMemo(() => {
    return atividadesIndependentes.filter((a) => {
      if (dataDe && a.data < dataDe) return false;
      if (dataAte && a.data > dataAte) return false;
      return true;
    });
  }, [atividadesIndependentes, dataDe, dataAte]);

  const filteredTecnologias = useMemo(() => {
    return tecnologias.filter((t) => {
      if (dataDe && t.data < dataDe) return false;
      if (dataAte && t.data > dataAte) return false;
      return true;
    });
  }, [tecnologias, dataDe, dataAte]);

  const ind = useMemo(() => {
    const all = [...filteredVinculadas, ...filteredIndependentes];
    return all.reduce(
      (acc, a) => {
        const i = a.indicadores;
        if (!i) return acc;
        acc.participantes += i.participantes ?? 0;
        acc.mulheres += i.mulheres ?? 0;
        acc.jovens += i.jovens ?? 0;
        acc.quilombolas += i.quilombolas ?? 0;
        acc.povosOriginarios += i.povosOriginarios ?? 0;
        acc.comunidadesTradicionais += i.comunidadesTradicionais ?? 0;
        acc.tecnologiasSociais += i.tecnologiasSociais ?? 0;
        return acc;
      },
      {
        participantes: 0,
        mulheres: 0,
        jovens: 0,
        quilombolas: 0,
        povosOriginarios: 0,
        comunidadesTradicionais: 0,
        tecnologiasSociais: 0,
      }
    );
  }, [filteredVinculadas, filteredIndependentes]);

  const totalTecnologiasCount = useMemo(
    () => filteredTecnologias.reduce((acc, t) => acc + (Number(t.quantidade) || 0), 0),
    [filteredTecnologias]
  );

  // Geographic distribution: group activities by municipio
  const porMunicipio = useMemo(() => {
    const allAtividades = [...filteredVinculadas, ...filteredIndependentes];
    const map: Record<string, number> = {};
    allAtividades.forEach((a) => {
      const mun = a.municipio?.trim() || "Não informado";
      const participantes = a.indicadores?.participantes ?? 0;
      map[mun] = (map[mun] ?? 0) + participantes;
    });

    const entries = Object.entries(map)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a);

    if (entries.length <= 5) {
      return entries.map(([name, value]) => ({ name, value }));
    }
    const top4 = entries.slice(0, 4);
    const outros = entries.slice(4).reduce((acc, [, v]) => acc + v, 0);
    return [...top4.map(([name, value]) => ({ name, value })), { name: "Outros", value: outros }];
  }, [filteredVinculadas, filteredIndependentes]);

  // Beneficiarios bar chart
  const beneficiarios = [
    { grupo: "Participantes", total: ind.participantes },
    { grupo: "Mulheres", total: ind.mulheres },
    { grupo: "Jovens", total: ind.jovens },
    { grupo: "Quilombolas", total: ind.quilombolas },
    { grupo: "Povos Originários", total: ind.povosOriginarios },
    { grupo: "Com. Tradicionais", total: ind.comunidadesTradicionais },
  ];

  const totalBeneficiarios = ind.participantes;

  // ── Period label helper ────────────────────────────────────────────────────
  const periodoLabel = useMemo(() => {
    if (dataDe && dataAte) return `${formatDate(dataDe)} até ${formatDate(dataAte)}`;
    if (dataDe) return `A partir de ${formatDate(dataDe)}`;
    if (dataAte) return `Até ${formatDate(dataAte)}`;
    return "Todos os períodos";
  }, [dataDe, dataAte]);

  // ── Export PDF ──────────────────────────────────────────────────────────────
  const exportPDF = async () => {
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const MARGIN = 14;
      const CONTENT_TOP = 38; // below header bar
      const FOOTER_H = 20;    // reserved space above footer
      const dateStr = new Date().toLocaleDateString("pt-BR");
      const dateIso = new Date().toISOString().slice(0, 10);

      // Load logo
      let logoB64: string | null = null;
      try {
        logoB64 = await imageToBase64(chapadaLogo);
      } catch (_) { /* logo optional */ }

      // Draw header on page 1
      drawPageHeader(doc, logoB64, periodoLabel);

      // Sub-header: generation date
      let y = CONTENT_TOP + 6;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Gerado em: ${dateStr}`, pageW - MARGIN, y, { align: "right" });
      doc.setTextColor(30, 30, 30);

      y += 12;

      // ── SEÇÃO 1 — Resumo Executivo ─────────────────────────────────────────
      y = sectionTitle(doc, "SEÇÃO 1 — Resumo Executivo", y);

      const projetosAtivos = projetos.filter((p) => p.status === "Em execução").length;

      autoTable(doc, {
        startY: y,
        head: [["Indicador", "Total"]],
        body: [
          ["Total de Participantes", ind.participantes.toLocaleString("pt-BR")],
          ["Mulheres Beneficiadas", ind.mulheres.toLocaleString("pt-BR")],
          ["Jovens Atendidos", ind.jovens.toLocaleString("pt-BR")],
          ["Público Quilombola", ind.quilombolas.toLocaleString("pt-BR")],
          ["Povos Originários", ind.povosOriginarios.toLocaleString("pt-BR")],
          ["Comunidades Tradicionais", ind.comunidadesTradicionais.toLocaleString("pt-BR")],
          ["Projetos Ativos", projetosAtivos.toLocaleString("pt-BR")],
          ["Atividades Realizadas", filteredVinculadas.length.toLocaleString("pt-BR")],
          ["Ações Independentes", filteredIndependentes.length.toLocaleString("pt-BR")],
          ["Tecnologias Sociais", (totalTecnologiasCount + ind.tecnologiasSociais).toLocaleString("pt-BR")],
        ],
        theme: "striped",
        headStyles: { fillColor: [45, 90, 39], textColor: 255, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 300 },
          1: { cellWidth: 100, halign: "center", fontStyle: "bold" },
        },
        margin: { left: MARGIN, right: MARGIN },
        didDrawPage: (data) => {
          drawPageHeader(doc, logoB64, periodoLabel);
        },
      });

      y = (doc as any).lastAutoTable.finalY + 18;

      // ── SEÇÃO 2 — Distribuição por Município ──────────────────────────────
      if (y > pageH - FOOTER_H - 80) { doc.addPage(); y = CONTENT_TOP + 4; }
      y = sectionTitle(doc, "SEÇÃO 2 — Distribuição por Município", y);

      // Build municipality aggregation
      const munMap: Record<string, { participantes: number; projetos: Set<string>; atividades: number; uf?: string }> = {};

      [...filteredVinculadas, ...filteredIndependentes].forEach((a) => {
        const mun = a.municipio?.trim() || "Não informado";
        if (!munMap[mun]) munMap[mun] = { participantes: 0, projetos: new Set(), atividades: 0 };
        munMap[mun].participantes += a.indicadores?.participantes ?? 0;
        munMap[mun].atividades += 1;
        if (a.projetoId) munMap[mun].projetos.add(a.projetoId);
      });

      projetos.forEach((p) => {
        p.municipios.forEach((mun) => {
          if (!munMap[mun]) munMap[mun] = { participantes: 0, projetos: new Set(), atividades: 0 };
          munMap[mun].projetos.add(p.id);
        });
      });

      const munRows = Object.entries(munMap)
        .sort(([, a], [, b]) => b.participantes - a.participantes)
        .map(([nome, d]) => [nome, d.participantes.toString(), d.projetos.size.toString(), d.atividades.toString()]);

      autoTable(doc, {
        startY: y,
        head: [["Município / UF", "Participantes", "Projetos", "Atividades"]],
        body: munRows.length > 0 ? munRows : [["Nenhum dado disponível", "-", "-", "-"]],
        theme: "striped",
        headStyles: { fillColor: [45, 90, 39], textColor: 255, fontStyle: "bold" },
        columnStyles: {
          1: { halign: "center" },
          2: { halign: "center" },
          3: { halign: "center" },
        },
        margin: { left: MARGIN, right: MARGIN },
        didDrawPage: () => { drawPageHeader(doc, logoB64, periodoLabel); },
      });

      y = (doc as any).lastAutoTable.finalY + 18;

      // ── SEÇÃO 3 — Detalhamento por Projeto ────────────────────────────────
      if (y > pageH - FOOTER_H - 60) { doc.addPage(); y = CONTENT_TOP + 4; }
      y = sectionTitle(doc, "SEÇÃO 3 — Detalhamento por Projeto", y);

      const projetosFiltrados = projetos.filter((p) => {
        if (dataDe && p.termino < dataDe) return false;
        if (dataAte && p.inicio > dataAte) return false;
        return true;
      });

      if (projetosFiltrados.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text("Nenhum projeto encontrado no período selecionado.", MARGIN + 4, y + 6);
        doc.setTextColor(30, 30, 30);
        y += 18;
      } else {
        for (const p of projetosFiltrados) {
          if (y > pageH - FOOTER_H - 100) { doc.addPage(); y = CONTENT_TOP + 4; }

          // Project sub-header
          doc.setFillColor(230, 240, 229);
          doc.rect(MARGIN, y, pageW - MARGIN * 2, 10, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(45, 90, 39);
          doc.text(`${p.nome}  (${p.contrato})`, MARGIN + 4, y + 7);
          doc.setTextColor(30, 30, 30);
          y += 14;

          // Project details
          const projAtividades = filteredVinculadas.filter((a) => a.projetoId === p.id);
          const projPart = projAtividades.reduce((acc, a) => acc + (a.indicadores?.participantes ?? 0), 0);
          const projMulh = projAtividades.reduce((acc, a) => acc + (a.indicadores?.mulheres ?? 0), 0);
          const projJov = projAtividades.reduce((acc, a) => acc + (a.indicadores?.jovens ?? 0), 0);
          const projQui = projAtividades.reduce((acc, a) => acc + (a.indicadores?.quilombolas ?? 0), 0);

          autoTable(doc, {
            startY: y,
            body: [
              ["Financiador", p.financiador || "—", "Período", `${formatDate(p.inicio)} — ${formatDate(p.termino)}`],
              ["Valor Total", formatBRL(p.valor), "Municípios", p.municipios.join(", ") || "—"],
              ["Participantes", projPart.toString(), "Mulheres", projMulh.toString()],
              ["Jovens", projJov.toString(), "Quilombolas", projQui.toString()],
            ],
            theme: "plain",
            styles: { fontSize: 8, cellPadding: 3 },
            columnStyles: {
              0: { fontStyle: "bold", textColor: [80, 80, 80], cellWidth: 100 },
              1: { cellWidth: 160 },
              2: { fontStyle: "bold", textColor: [80, 80, 80], cellWidth: 80 },
              3: { cellWidth: 180 },
            },
            margin: { left: MARGIN + 4, right: MARGIN },
            didDrawPage: () => { drawPageHeader(doc, logoB64, periodoLabel); },
          });

          y = (doc as any).lastAutoTable.finalY + 4;

          // Activities list (condensed)
          if (projAtividades.length > 0) {
            const atvsRows = projAtividades.slice(0, 8).map((a) => [
              formatDate(a.data),
              a.tipo,
              a.titulo || a.descricao.slice(0, 50),
            ]);
            if (projAtividades.length > 8) atvsRows.push(["...", "", `+${projAtividades.length - 8} mais`]);

            autoTable(doc, {
              startY: y,
              head: [["Data", "Tipo", "Descrição"]],
              body: atvsRows,
              theme: "grid",
              styles: { fontSize: 7.5, cellPadding: 2 },
              headStyles: { fillColor: [120, 160, 80], textColor: 255, fontStyle: "bold", fontSize: 7.5 },
              margin: { left: MARGIN + 8, right: MARGIN },
              didDrawPage: () => { drawPageHeader(doc, logoB64, periodoLabel); },
            });

            y = (doc as any).lastAutoTable.finalY + 6;
          }

          y += 6;
        }
      }

      // ── SEÇÃO 4 — Tecnologias Sociais ─────────────────────────────────────
      if (y > pageH - FOOTER_H - 60) { doc.addPage(); y = CONTENT_TOP + 4; }
      y = sectionTitle(doc, "SEÇÃO 4 — Tecnologias Sociais Implementadas", y);

      const tecRows = filteredTecnologias.map((t) => {
        const proj = projetos.find((p) => p.id === t.projetoId);
        const catLabel = CATEGORIAS[t.categoria]?.label || t.categoria;
        return [
          catLabel,
          t.nome,
          t.quantidade.toString(),
          proj?.nome || "—",
          t.municipios || "—",
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [["Categoria (Linha de Ação)", "Tecnologia", "Qtd.", "Projeto", "Município"]],
        body: tecRows.length > 0 ? tecRows : [["Nenhuma tecnologia registrada", "", "", "", ""]],
        theme: "striped",
        headStyles: { fillColor: [45, 90, 39], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 7.5 },
        margin: { left: MARGIN, right: MARGIN },
        didDrawPage: () => { drawPageHeader(doc, logoB64, periodoLabel); },
      });

      // Draw footers on all pages (after all content is added)
      drawPageFooter(doc);

      doc.save(`CHAPADA_Indicadores_${dateIso}.pdf`);
      toast.success("PDF institucional exportado com sucesso.");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar PDF.");
    }
  };

  // ── Export Excel ──────────────────────────────────────────────────────────
  const exportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const dateStr = new Date().toLocaleDateString("pt-BR");
      const dateIso = new Date().toISOString().slice(0, 10);
      const projetosAtivos = projetos.filter((p) => p.status === "Em execução").length;

      // Helper: apply dark green header style
      const applyHeaderStyle = (ws: XLSX.WorkSheet, headerRow: number, numCols: number) => {
        const headerStyle = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "2D5A27" } },
          alignment: { horizontal: "center" },
        };
        for (let c = 0; c < numCols; c++) {
          const cellAddr = XLSX.utils.encode_cell({ r: headerRow, c });
          if (ws[cellAddr]) {
            ws[cellAddr].s = headerStyle;
          }
        }
      };

      // Helper: alternating row style
      const applyAlternatingRows = (ws: XLSX.WorkSheet, startRow: number, endRow: number, numCols: number) => {
        for (let r = startRow; r <= endRow; r++) {
          if (r % 2 === 0) continue; // odd rows get light gray
          for (let c = 0; c < numCols; c++) {
            const cellAddr = XLSX.utils.encode_cell({ r, c });
            if (ws[cellAddr]) {
              ws[cellAddr].s = { fill: { fgColor: { rgb: "F2F2F2" } } };
            }
          }
        }
      };

      // ── ABA 1: Resumo ───────────────────────────────────────────────────────
      const resumoData: any[][] = [
        ["CHAPADA — Centro de Habilitação e Apoio ao Pequeno Agricultor do Araripe"],
        ["Relatório de Indicadores e Beneficiários"],
        [`Período: ${periodoLabel}`],
        [`Data de Geração: ${dateStr}`],
        [],
        ["Indicador", "Total"],
        ["Total de Participantes", ind.participantes],
        ["Mulheres Beneficiadas", ind.mulheres],
        ["Jovens Atendidos", ind.jovens],
        ["Público Quilombola", ind.quilombolas],
        ["Povos Originários", ind.povosOriginarios],
        ["Comunidades Tradicionais", ind.comunidadesTradicionais],
        ["Projetos Ativos", projetosAtivos],
        ["Atividades Realizadas", filteredVinculadas.length],
        ["Ações Independentes", filteredIndependentes.length],
        ["Tecnologias Sociais", totalTecnologiasCount + ind.tecnologiasSociais],
      ];

      const ws1 = XLSX.utils.aoa_to_sheet(resumoData);
      ws1["!cols"] = [{ wch: 40 }, { wch: 15 }];
      // Bold title
      if (ws1["A1"]) ws1["A1"].s = { font: { bold: true, sz: 14, color: { rgb: "2D5A27" } } };
      applyHeaderStyle(ws1, 5, 2); // row index 5 = "Indicador, Total"
      applyAlternatingRows(ws1, 6, resumoData.length - 1, 2);
      XLSX.utils.book_append_sheet(wb, ws1, "Resumo");

      // ── ABA 2: Por Município ────────────────────────────────────────────────
      const munMap2: Record<string, {
        participantes: number; mulheres: number; jovens: number;
        quilombolas: number; povosOriginarios: number; comunidadesTradicionais: number;
        projetos: Set<string>; atividades: number;
      }> = {};

      [...filteredVinculadas, ...filteredIndependentes].forEach((a) => {
        const mun = a.municipio?.trim() || "Não informado";
        if (!munMap2[mun]) munMap2[mun] = { participantes: 0, mulheres: 0, jovens: 0, quilombolas: 0, povosOriginarios: 0, comunidadesTradicionais: 0, projetos: new Set(), atividades: 0 };
        const i = a.indicadores;
        if (i) {
          munMap2[mun].participantes += i.participantes ?? 0;
          munMap2[mun].mulheres += i.mulheres ?? 0;
          munMap2[mun].jovens += i.jovens ?? 0;
          munMap2[mun].quilombolas += i.quilombolas ?? 0;
          munMap2[mun].povosOriginarios += i.povosOriginarios ?? 0;
          munMap2[mun].comunidadesTradicionais += i.comunidadesTradicionais ?? 0;
        }
        munMap2[mun].atividades += 1;
        if (a.projetoId) munMap2[mun].projetos.add(a.projetoId);
      });

      projetos.forEach((p) => {
        p.municipios.forEach((mun) => {
          if (!munMap2[mun]) munMap2[mun] = { participantes: 0, mulheres: 0, jovens: 0, quilombolas: 0, povosOriginarios: 0, comunidadesTradicionais: 0, projetos: new Set(), atividades: 0 };
          munMap2[mun].projetos.add(p.id);
        });
      });

      const munHeader2 = ["Município", "UF", "Participantes", "Mulheres", "Jovens", "Quilombolas", "Povos Originários", "Com. Tradicionais", "Projetos", "Atividades"];
      const munRows2 = Object.entries(munMap2).map(([nome, d]) => [
        nome, "", d.participantes, d.mulheres, d.jovens, d.quilombolas, d.povosOriginarios, d.comunidadesTradicionais, d.projetos.size, d.atividades
      ]);

      const ws2Data = [munHeader2, ...munRows2];
      const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
      ws2["!cols"] = [{ wch: 28 }, { wch: 5 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 10 }, { wch: 12 }];
      applyHeaderStyle(ws2, 0, munHeader2.length);
      applyAlternatingRows(ws2, 1, ws2Data.length - 1, munHeader2.length);
      XLSX.utils.book_append_sheet(wb, ws2, "Por Município");

      // ── ABA 3: Projetos e Atividades ────────────────────────────────────────
      const projHeader = ["Projeto", "Contrato", "Financiador", "Início", "Término", "Valor (R$)", "Municípios", "Total Beneficiários", "Status"];
      const projRows = projetos.map((p) => {
        const projAtv = filteredVinculadas.filter((a) => a.projetoId === p.id);
        const totalBen = projAtv.reduce((acc, a) => acc + (a.indicadores?.participantes ?? 0), 0);
        return [
          p.nome, p.contrato, p.financiador,
          formatDate(p.inicio), formatDate(p.termino),
          p.valor, p.municipios.join("; "), totalBen, p.status
        ];
      });

      const ws3Data = [projHeader, ...projRows];
      const ws3 = XLSX.utils.aoa_to_sheet(ws3Data);
      ws3["!cols"] = [{ wch: 36 }, { wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 34 }, { wch: 20 }, { wch: 14 }];
      applyHeaderStyle(ws3, 0, projHeader.length);
      applyAlternatingRows(ws3, 1, ws3Data.length - 1, projHeader.length);
      XLSX.utils.book_append_sheet(wb, ws3, "Projetos e Atividades");

      // ── ABA 4: Atividades Detalhadas (vinculadas) ───────────────────────────
      const atvHeader = ["Data", "Projeto", "Tipo de Ação", "Descrição", "Município", "Comunidade", "Responsável", "Participantes"];
      const atvRows = filteredVinculadas.map((a) => {
        const proj = projetos.find((p) => p.id === a.projetoId);
        return [
          formatDate(a.data),
          proj?.nome || "—",
          a.tipo,
          a.titulo || a.descricao,
          a.municipio || "—",
          a.local || "—",
          a.responsaveis || "—",
          a.indicadores?.participantes ?? 0,
        ];
      });

      const ws4Data = [atvHeader, ...atvRows];
      const ws4 = XLSX.utils.aoa_to_sheet(ws4Data);
      ws4["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 50 }, { wch: 20 }, { wch: 30 }, { wch: 28 }, { wch: 14 }];
      applyHeaderStyle(ws4, 0, atvHeader.length);
      applyAlternatingRows(ws4, 1, ws4Data.length - 1, atvHeader.length);
      XLSX.utils.book_append_sheet(wb, ws4, "Atividades Detalhadas");

      // ── ABA 5: Ações Independentes ──────────────────────────────────────────
      const indHeader = ["Data", "Tipo de Ação", "Descrição", "Município", "Comunidade", "Responsável", "Participantes"];
      const indRows = filteredIndependentes.map((a) => [
        formatDate(a.data),
        a.tipo,
        a.titulo || a.descricao,
        a.municipio || "—",
        a.local || "—",
        a.responsaveis || "—",
        a.indicadores?.participantes ?? 0,
      ]);

      const ws5Data = [indHeader, ...indRows];
      const ws5 = XLSX.utils.aoa_to_sheet(ws5Data);
      ws5["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 50 }, { wch: 20 }, { wch: 30 }, { wch: 28 }, { wch: 14 }];
      applyHeaderStyle(ws5, 0, indHeader.length);
      applyAlternatingRows(ws5, 1, ws5Data.length - 1, indHeader.length);
      XLSX.utils.book_append_sheet(wb, ws5, "Ações Independentes");

      // ── ABA 6: Tecnologias Sociais ──────────────────────────────────────────
      const tecHeader = ["Categoria", "Tecnologia", "Quantidade", "Famílias", "Projeto", "Município", "Data"];
      const tecRows2 = filteredTecnologias.map((t) => {
        const proj = projetos.find((p) => p.id === t.projetoId);
        return [
          CATEGORIAS[t.categoria]?.label || t.categoria,
          t.nome,
          t.quantidade,
          t.familias ?? 0,
          proj?.nome || "—",
          t.municipios || "—",
          t.data ? formatDate(t.data) : "—",
        ];
      });

      const ws6Data = [tecHeader, ...tecRows2];
      const ws6 = XLSX.utils.aoa_to_sheet(ws6Data);
      ws6["!cols"] = [{ wch: 42 }, { wch: 36 }, { wch: 12 }, { wch: 10 }, { wch: 34 }, { wch: 22 }, { wch: 14 }];
      applyHeaderStyle(ws6, 0, tecHeader.length);
      applyAlternatingRows(ws6, 1, ws6Data.length - 1, tecHeader.length);
      XLSX.utils.book_append_sheet(wb, ws6, "Tecnologias Sociais");

      XLSX.writeFile(wb, `CHAPADA_Indicadores_${dateIso}.xlsx`);
      toast.success("Planilha Excel exportada com sucesso (6 abas).");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar Excel.");
    }
  };

  return (
    <AppLayout
      title="Indicadores & Relatórios"
      subtitle="Análise consolidada por público, território e período"
      actions={
        <>
          <Button variant="outline" size="sm" className="gap-2 chapada-btn" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Atualizando..." : "Atualizar"}
          </Button>
          <Button variant="outline" className="gap-2 chapada-btn" onClick={exportPDF}>
            <FileDown className="h-4 w-4" /> Exportar PDF
          </Button>
          <Button className="gap-2 chapada-btn" onClick={exportExcel}>
            <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Card de Filtros: Período */}
        <Card className="chapada-filter-card">
          <CardContent className="p-4 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Período:</span>
                <DatePicker
                  value={dataDe}
                  onChange={setDataDe}
                  hasError={isPeriodInvalid}
                />
                <span className="text-xs text-muted-foreground">até</span>
                <DatePicker
                  value={dataAte}
                  onChange={setDataAte}
                  hasError={isPeriodInvalid}
                />
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  <X className="h-3 w-3" />
                  Limpar filtros
                </Button>
              )}
            </div>

            {hasActiveFilters && (
              <span className="text-xs text-muted-foreground italic">
                Exportando: <strong>{periodoLabel}</strong>
              </span>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Beneficiários por Grupo</CardTitle></CardHeader>
          <CardContent className="h-80" ref={barRef}>
            {beneficiarios.every((b) => b.total === 0) ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Nenhum indicador registrado ainda. Preencha os indicadores nas atividades.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={beneficiarios}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.025 75)" />
                  <XAxis dataKey="grupo" stroke="oklch(0.5 0.03 60)" fontSize={11} />
                  <YAxis stroke="oklch(0.5 0.03 60)" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "oklch(1 0 0)", border: "1px solid oklch(0.88 0.025 75)", borderRadius: "8px" }} />
                  <Bar dataKey="total" fill="oklch(0.6 0.16 40)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Distribuição por Município</CardTitle></CardHeader>
          <CardContent className="h-80" ref={pieRef}>
            {porMunicipio.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Nenhuma atividade com município e participantes registrados.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={porMunicipio} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {porMunicipio.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-0">
        <CardHeader><CardTitle className="text-base">Resumo Consolidado</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {beneficiarios.map((b) => (
              <div key={b.grupo} className="text-center p-4 bg-muted/50 rounded-xl border border-border/50 hover:bg-muted/70 transition-colors">
                <div className="text-2xl font-display font-semibold text-primary">
                  {b.total.toLocaleString("pt-BR")}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{b.grupo}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </div>
    </AppLayout>
  );
}
