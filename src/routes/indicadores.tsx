import { createFileRoute } from "@tanstack/react-router";
import { useRef, useMemo, useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileDown,
  FileSpreadsheet,
  X,
  RefreshCw,
  Users,
  Heart,
  GraduationCap,
  Home,
  Flame,
  Feather,
  Globe,
  Wrench,
  ChevronDown,
  ChevronUp,
  Calendar,
  MapPin,
  TrendingUp,
} from "lucide-react";
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
  LineChart,
  Line,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  useAtividades,
  useAtividadesIndependentes,
  refreshAtividades,
} from "@/lib/atividadesStore";
import { useProjetos } from "@/lib/projetosStore";
import { useTecnologias, CATEGORIAS } from "@/lib/tecnologiasStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatBRL } from "@/lib/mockData";
import chapadaLogo from "@/assets/chapada-logo.png";

export const Route = createFileRoute("/indicadores")({
  component: IndicadoresPage,
});

// ── Color palette ──────────────────────────────────────────────────────────────
const MUNICIPIO_COLORS = [
  "#C8522A",
  "#2D5A27",
  "#F5A623",
  "#4A7C3F",
  "#8B4513",
  "#6B8E23",
];

const toneClass: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  savanna: "bg-savanna/15 text-savanna",
  terracotta: "bg-terracotta/15 text-terracotta",
  ocre: "bg-ocre/20 text-ocre-foreground",
};

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

// ── PDF helpers ────────────────────────────────────────────────────────────────
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

function drawPageHeader(doc: jsPDF, logoB64: string | null, periodoLabel: string) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(45, 90, 39);
  doc.rect(0, 0, pageW, 30, "F");
  if (logoB64) {
    try { doc.addImage(logoB64, "PNG", 10, 3, 24, 24); } catch (_) {}
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Centro de Habilitação e Apoio ao Pequeno Agricultor do Araripe", pageW / 2, 11, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Relatório de Indicadores e Beneficiários", pageW / 2, 18, { align: "center" });
  doc.text(`Período: ${periodoLabel}`, pageW / 2, 24, { align: "center" });
  doc.setTextColor(30, 30, 30);
}

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

// ── Progress bar color ─────────────────────────────────────────────────────────
function progressColor(pct: number): string {
  if (pct > 90) return "#E53E3E";
  if (pct > 75) return "#F5A623";
  return "#2D5A27";
}

// ── KPI Card ───────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: number;
  sub: string;
  icon: React.ElementType;
  tone: string;
}

function KpiCard({ label, value, sub, icon: Icon, tone }: KpiCardProps) {
  return (
    <Card className="border-border/60 border-t-4 border-t-primary hover:shadow-[var(--shadow-soft)] transition-shadow">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
            <div className="mt-2 text-2xl md:text-3xl font-display font-semibold text-foreground">
              {value.toLocaleString("pt-BR")}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
          </div>
          <div
            className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${toneClass[tone] || "bg-accent"}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Expandable Project Row ─────────────────────────────────────────────────────
interface ProjectRowProps {
  projeto: any;
  atividades: any[];
  isExpanded: boolean;
  onToggle: () => void;
}

function ProjectRow({ projeto, atividades, isExpanded, onToggle }: ProjectRowProps) {
  const now = new Date();
  const start = new Date(projeto.inicio);
  const end = new Date(projeto.termino);
  const totalDays = Math.max(1, (end.getTime() - start.getTime()) / 86400000);
  const elapsed = Math.min(totalDays, Math.max(0, (now.getTime() - start.getTime()) / 86400000));
  const pct = Math.round((elapsed / totalDays) * 100);
  const color = progressColor(pct);

  const projPart = atividades.reduce((acc, a) => acc + (a.indicadores?.participantes ?? 0), 0);
  const projMulh = atividades.reduce((acc, a) => acc + (a.indicadores?.mulheres ?? 0), 0);
  const projJov = atividades.reduce((acc, a) => acc + (a.indicadores?.jovens ?? 0), 0);
  const projQui = atividades.reduce((acc, a) => acc + (a.indicadores?.quilombolas ?? 0), 0);

  const statusBg: Record<string, string> = {
    "Em execução": "bg-green-100 text-green-800",
    "Concluído": "bg-blue-100 text-blue-800",
    "Planejamento": "bg-yellow-100 text-yellow-800",
    "Suspenso": "bg-red-100 text-red-800",
  };

  return (
    <>
      <tr
        className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="py-3 px-4">
          <div className="font-medium text-sm text-foreground">{projeto.nome}</div>
          <div className="text-[11px] text-muted-foreground">{projeto.contrato}</div>
        </td>
        <td className="py-3 px-4 text-sm text-muted-foreground">{projeto.financiador || "—"}</td>
        <td className="py-3 px-4 min-w-[160px]">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-xs font-semibold" style={{ color }}>{pct}%</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {formatDate(projeto.inicio)} → {formatDate(projeto.termino)}
          </div>
        </td>
        <td className="py-3 px-4 text-center text-sm font-semibold">{projPart.toLocaleString("pt-BR")}</td>
        <td className="py-3 px-4 text-center text-sm">{atividades.length}</td>
        <td className="py-3 px-4">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBg[projeto.status] ?? "bg-muted text-muted-foreground"}`}>
            {projeto.status}
          </span>
        </td>
        <td className="py-3 px-4 text-center">
          {isExpanded ? <ChevronUp className="h-4 w-4 mx-auto text-muted-foreground" /> : <ChevronDown className="h-4 w-4 mx-auto text-muted-foreground" />}
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-muted/20">
          <td colSpan={7} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Beneficiários detail */}
              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-wide mb-2">Beneficiários por Categoria</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Participantes", val: projPart },
                    { label: "Mulheres", val: projMulh },
                    { label: "Jovens", val: projJov },
                    { label: "Quilombolas", val: projQui },
                  ].map((item) => (
                    <div key={item.label} className="bg-white rounded-lg p-2 border border-border/50 text-center">
                      <div className="text-lg font-bold text-primary">{item.val}</div>
                      <div className="text-[10px] text-muted-foreground">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Activities list */}
              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-wide mb-2">
                  Atividades ({atividades.length})
                </div>
                {atividades.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhuma atividade no período filtrado.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {atividades.slice(0, 8).map((a) => (
                      <div key={a.id} className="flex gap-2 text-xs items-start">
                        <div className="flex items-center gap-1 text-muted-foreground whitespace-nowrap">
                          <Calendar className="h-3 w-3" />
                          {formatDate(a.data)}
                        </div>
                        <span className="font-medium truncate">{a.titulo || a.tipo}</span>
                        {a.municipio && (
                          <span className="flex items-center gap-0.5 text-muted-foreground whitespace-nowrap">
                            <MapPin className="h-3 w-3" />
                            {a.municipio}
                          </span>
                        )}
                      </div>
                    ))}
                    {atividades.length > 8 && (
                      <div className="text-[10px] text-muted-foreground italic">
                        +{atividades.length - 8} atividades adicionais
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
function IndicadoresPage() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

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

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const isPeriodInvalid = !!(dataDe && dataAte && dataDe > dataAte);
  const hasActiveFilters = !!(dataDe || dataAte);
  const clearFilters = () => { setDataDe(""); setDataAte(""); };

  // ── Data ─────────────────────────────────────────────────────────────────────
  const atividadesVinculadas = useAtividades();
  const atividadesIndependentes = useAtividadesIndependentes();
  const projetos = useProjetos();
  const tecnologias = useTecnologias();

  const filteredVinculadas = useMemo(() =>
    atividadesVinculadas.filter((a) => {
      if (dataDe && a.data < dataDe) return false;
      if (dataAte && a.data > dataAte) return false;
      return true;
    }), [atividadesVinculadas, dataDe, dataAte]);

  const filteredIndependentes = useMemo(() =>
    atividadesIndependentes.filter((a) => {
      if (dataDe && a.data < dataDe) return false;
      if (dataAte && a.data > dataAte) return false;
      return true;
    }), [atividadesIndependentes, dataDe, dataAte]);

  const filteredTecnologias = useMemo(() =>
    tecnologias.filter((t) => {
      if (dataDe && t.data < dataDe) return false;
      if (dataAte && t.data > dataAte) return false;
      return true;
    }), [tecnologias, dataDe, dataAte]);

  // ── KPIs ──────────────────────────────────────────────────────────────────────
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
      { participantes: 0, mulheres: 0, jovens: 0, quilombolas: 0, povosOriginarios: 0, comunidadesTradicionais: 0, tecnologiasSociais: 0 }
    );
  }, [filteredVinculadas, filteredIndependentes]);

  const totalTecnologiasCount = useMemo(
    () => filteredTecnologias.reduce((acc, t) => acc + (Number(t.quantidade) || 0), 0),
    [filteredTecnologias]
  );

  // Famílias: from tecnologias familias field
  const totalFamilias = useMemo(
    () => filteredTecnologias.reduce((acc, t) => acc + (Number(t.familias) || 0), 0),
    [filteredTecnologias]
  );

  const kpiLine1 = [
    { label: "PARTICIPANTES", value: ind.participantes, sub: "total geral", icon: Users, tone: "primary" },
    { label: "MULHERES", value: ind.mulheres, sub: "beneficiadas", icon: Heart, tone: "terracotta" },
    { label: "JOVENS", value: ind.jovens, sub: "atendidos", icon: GraduationCap, tone: "ocre" },
    { label: "FAMÍLIAS", value: totalFamilias, sub: "atendidas", icon: Home, tone: "savanna" },
  ];

  const kpiLine2 = [
    { label: "QUILOMBOLAS", value: ind.quilombolas, sub: "público", icon: Flame, tone: "terracotta" },
    { label: "POVOS ORIG.", value: ind.povosOriginarios, sub: "atendidos", icon: Feather, tone: "ocre" },
    { label: "COM. TRADICION.", value: ind.comunidadesTradicionais, sub: "atendidas", icon: Globe, tone: "savanna" },
    { label: "TEC. SOCIAIS", value: totalTecnologiasCount + ind.tecnologiasSociais, sub: "implementadas", icon: Wrench, tone: "primary" },
  ];

  // ── Timeline Chart ────────────────────────────────────────────────────────────
  const timelineData = useMemo(() => {
    const map: Record<string, { label: string; atividades: number; acoes: number }> = {};

    const addToMap = (data: string, isAcao: boolean) => {
      const d = new Date(data);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${MONTH_NAMES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
      if (!map[key]) map[key] = { label, atividades: 0, acoes: 0 };
      if (isAcao) map[key].acoes++;
      else map[key].atividades++;
    };

    filteredVinculadas.forEach((a) => addToMap(a.data, false));
    filteredIndependentes.forEach((a) => addToMap(a.data, true));

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [filteredVinculadas, filteredIndependentes]);

  // ── Geographic Distribution ───────────────────────────────────────────────────
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

    if (entries.length <= 5) return entries.map(([name, value]) => ({ name, value }));
    const top4 = entries.slice(0, 4);
    const outros = entries.slice(4).reduce((acc, [, v]) => acc + v, 0);
    return [...top4.map(([name, value]) => ({ name, value })), { name: "Outros", value: outros }];
  }, [filteredVinculadas, filteredIndependentes]);

  const totalMunicipioParticipants = porMunicipio.reduce((acc, m) => acc + m.value, 0);

  // ── Beneficiarios Bar Chart ───────────────────────────────────────────────────
  const beneficiarios = [
    { grupo: "Participantes", total: ind.participantes },
    { grupo: "Mulheres", total: ind.mulheres },
    { grupo: "Jovens", total: ind.jovens },
    { grupo: "Quilombolas", total: ind.quilombolas },
    { grupo: "Povos Originários", total: ind.povosOriginarios },
    { grupo: "Com. Tradicionais", total: ind.comunidadesTradicionais },
  ];

  // ── Projetos table ────────────────────────────────────────────────────────────
  const projetosFiltrados = useMemo(() =>
    projetos.filter((p) => {
      if (dataDe && p.termino < dataDe) return false;
      if (dataAte && p.inicio > dataAte) return false;
      return true;
    }), [projetos, dataDe, dataAte]);

  const toggleProject = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Tecnologias por Linha de Ação ─────────────────────────────────────────────
  const tecPorLinha = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTecnologias.forEach((t) => {
      const label = CATEGORIAS[t.categoria]?.label || t.categoria;
      map[label] = (map[label] ?? 0) + (Number(t.quantidade) || 0);
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name: name.length > 35 ? name.slice(0, 33) + "…" : name, fullName: name, value }));
  }, [filteredTecnologias]);

  // ── Period label ──────────────────────────────────────────────────────────────
  const periodoLabel = useMemo(() => {
    if (dataDe && dataAte) return `${formatDate(dataDe)} até ${formatDate(dataAte)}`;
    if (dataDe) return `A partir de ${formatDate(dataDe)}`;
    if (dataAte) return `Até ${formatDate(dataAte)}`;
    return "Todos os períodos";
  }, [dataDe, dataAte]);

  // ── Export PDF ────────────────────────────────────────────────────────────────
  const exportPDF = async () => {
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const MARGIN = 14;
      const CONTENT_TOP = 38;
      const FOOTER_H = 20;
      const dateStr = new Date().toLocaleDateString("pt-BR");
      const dateIso = new Date().toISOString().slice(0, 10);

      let logoB64: string | null = null;
      try { logoB64 = await imageToBase64(chapadaLogo); } catch (_) {}

      drawPageHeader(doc, logoB64, periodoLabel);
      let y = CONTENT_TOP + 6;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Gerado em: ${dateStr}`, pageW - MARGIN, y, { align: "right" });
      doc.setTextColor(30, 30, 30);
      y += 12;

      y = sectionTitle(doc, "SEÇÃO 1 — Resumo Executivo", y);
      const projetosAtivos = projetos.filter((p) => p.status === "Em execução").length;
      autoTable(doc, {
        startY: y,
        head: [["Indicador", "Total"]],
        body: [
          ["Total de Participantes", ind.participantes.toLocaleString("pt-BR")],
          ["Mulheres Beneficiadas", ind.mulheres.toLocaleString("pt-BR")],
          ["Jovens Atendidos", ind.jovens.toLocaleString("pt-BR")],
          ["Famílias Atendidas", totalFamilias.toLocaleString("pt-BR")],
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
        columnStyles: { 0: { cellWidth: 300 }, 1: { cellWidth: 100, halign: "center", fontStyle: "bold" } },
        margin: { left: MARGIN, right: MARGIN },
        didDrawPage: () => { drawPageHeader(doc, logoB64, periodoLabel); },
      });
      y = (doc as any).lastAutoTable.finalY + 18;

      if (y > pageH - FOOTER_H - 80) { doc.addPage(); y = CONTENT_TOP + 4; }
      y = sectionTitle(doc, "SEÇÃO 2 — Distribuição por Município", y);
      const munMap: Record<string, { participantes: number; projetos: Set<string>; atividades: number }> = {};
      [...filteredVinculadas, ...filteredIndependentes].forEach((a) => {
        const mun = a.municipio?.trim() || "Não informado";
        if (!munMap[mun]) munMap[mun] = { participantes: 0, projetos: new Set(), atividades: 0 };
        munMap[mun].participantes += a.indicadores?.participantes ?? 0;
        munMap[mun].atividades += 1;
        if (a.projetoId) munMap[mun].projetos.add(a.projetoId);
      });
      const munRows = Object.entries(munMap)
        .sort(([, a], [, b]) => b.participantes - a.participantes)
        .map(([nome, d]) => [nome, d.participantes.toString(), d.projetos.size.toString(), d.atividades.toString()]);
      autoTable(doc, {
        startY: y,
        head: [["Município", "Participantes", "Projetos", "Atividades"]],
        body: munRows.length > 0 ? munRows : [["Nenhum dado disponível", "-", "-", "-"]],
        theme: "striped",
        headStyles: { fillColor: [45, 90, 39], textColor: 255, fontStyle: "bold" },
        columnStyles: { 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" } },
        margin: { left: MARGIN, right: MARGIN },
        didDrawPage: () => { drawPageHeader(doc, logoB64, periodoLabel); },
      });
      y = (doc as any).lastAutoTable.finalY + 18;

      if (y > pageH - FOOTER_H - 60) { doc.addPage(); y = CONTENT_TOP + 4; }
      y = sectionTitle(doc, "SEÇÃO 3 — Detalhamento por Projeto", y);
      for (const p of projetosFiltrados) {
        if (y > pageH - FOOTER_H - 100) { doc.addPage(); y = CONTENT_TOP + 4; }
        doc.setFillColor(230, 240, 229);
        doc.rect(MARGIN, y, pageW - MARGIN * 2, 10, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(45, 90, 39);
        doc.text(`${p.nome}  (${p.contrato})`, MARGIN + 4, y + 7);
        doc.setTextColor(30, 30, 30);
        y += 14;
        const projAtividades = filteredVinculadas.filter((a) => a.projetoId === p.id);
        const projPart = projAtividades.reduce((acc, a) => acc + (a.indicadores?.participantes ?? 0), 0);
        const projMulh = projAtividades.reduce((acc, a) => acc + (a.indicadores?.mulheres ?? 0), 0);
        autoTable(doc, {
          startY: y,
          body: [
            ["Financiador", p.financiador || "—", "Período", `${formatDate(p.inicio)} — ${formatDate(p.termino)}`],
            ["Valor Total", formatBRL(p.valor), "Municípios", p.municipios.join(", ") || "—"],
            ["Participantes", projPart.toString(), "Mulheres", projMulh.toString()],
          ],
          theme: "plain",
          styles: { fontSize: 8, cellPadding: 3 },
          columnStyles: { 0: { fontStyle: "bold", textColor: [80, 80, 80], cellWidth: 100 }, 1: { cellWidth: 160 }, 2: { fontStyle: "bold", textColor: [80, 80, 80], cellWidth: 80 }, 3: { cellWidth: 180 } },
          margin: { left: MARGIN + 4, right: MARGIN },
          didDrawPage: () => { drawPageHeader(doc, logoB64, periodoLabel); },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }

      if (y > pageH - FOOTER_H - 60) { doc.addPage(); y = CONTENT_TOP + 4; }
      y = sectionTitle(doc, "SEÇÃO 4 — Tecnologias Sociais Implementadas", y);
      const tecRows = filteredTecnologias.map((t) => {
        const proj = projetos.find((p) => p.id === t.projetoId);
        return [CATEGORIAS[t.categoria]?.label || t.categoria, t.nome, t.quantidade.toString(), proj?.nome || "—", t.municipios || "—"];
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

      drawPageFooter(doc);
      doc.save(`CHAPADA_Indicadores_${dateIso}.pdf`);
      toast.success("PDF institucional exportado com sucesso.");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar PDF.");
    }
  };

  // ── Export Excel ──────────────────────────────────────────────────────────────
  const exportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const dateStr = new Date().toLocaleDateString("pt-BR");
      const dateIso = new Date().toISOString().slice(0, 10);
      const projetosAtivos = projetos.filter((p) => p.status === "Em execução").length;

      const applyHeaderStyle = (ws: XLSX.WorkSheet, headerRow: number, numCols: number) => {
        const headerStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2D5A27" } }, alignment: { horizontal: "center" } };
        for (let c = 0; c < numCols; c++) {
          const cellAddr = XLSX.utils.encode_cell({ r: headerRow, c });
          if (ws[cellAddr]) ws[cellAddr].s = headerStyle;
        }
      };

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
        ["Famílias Atendidas", totalFamilias],
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
      if (ws1["A1"]) ws1["A1"].s = { font: { bold: true, sz: 14, color: { rgb: "2D5A27" } } };
      applyHeaderStyle(ws1, 5, 2);
      XLSX.utils.book_append_sheet(wb, ws1, "Resumo");

      const projHeader = ["Projeto", "Contrato", "Financiador", "Início", "Término", "Valor (R$)", "Municípios", "Total Beneficiários", "Status"];
      const projRows = projetos.map((p) => {
        const projAtv = filteredVinculadas.filter((a) => a.projetoId === p.id);
        const totalBen = projAtv.reduce((acc, a) => acc + (a.indicadores?.participantes ?? 0), 0);
        return [p.nome, p.contrato, p.financiador, formatDate(p.inicio), formatDate(p.termino), p.valor, p.municipios.join("; "), totalBen, p.status];
      });
      const ws2 = XLSX.utils.aoa_to_sheet([projHeader, ...projRows]);
      ws2["!cols"] = [{ wch: 36 }, { wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 34 }, { wch: 20 }, { wch: 14 }];
      applyHeaderStyle(ws2, 0, projHeader.length);
      XLSX.utils.book_append_sheet(wb, ws2, "Projetos");

      const atvHeader = ["Data", "Projeto", "Tipo de Ação", "Descrição", "Município", "Comunidade", "Responsável", "Participantes"];
      const atvRows = filteredVinculadas.map((a) => {
        const proj = projetos.find((p) => p.id === a.projetoId);
        return [formatDate(a.data), proj?.nome || "—", a.tipo, a.titulo || a.descricao, a.municipio || "—", a.local || "—", a.responsaveis || "—", a.indicadores?.participantes ?? 0];
      });
      const ws3 = XLSX.utils.aoa_to_sheet([atvHeader, ...atvRows]);
      ws3["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 50 }, { wch: 20 }, { wch: 30 }, { wch: 28 }, { wch: 14 }];
      applyHeaderStyle(ws3, 0, atvHeader.length);
      XLSX.utils.book_append_sheet(wb, ws3, "Atividades Detalhadas");

      const indHeader = ["Data", "Tipo de Ação", "Descrição", "Município", "Comunidade", "Responsável", "Participantes"];
      const indRows = filteredIndependentes.map((a) => [formatDate(a.data), a.tipo, a.titulo || a.descricao, a.municipio || "—", a.local || "—", a.responsaveis || "—", a.indicadores?.participantes ?? 0]);
      const ws4 = XLSX.utils.aoa_to_sheet([indHeader, ...indRows]);
      ws4["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 50 }, { wch: 20 }, { wch: 30 }, { wch: 28 }, { wch: 14 }];
      applyHeaderStyle(ws4, 0, indHeader.length);
      XLSX.utils.book_append_sheet(wb, ws4, "Ações Independentes");

      const tecHeader = ["Categoria", "Tecnologia", "Quantidade", "Famílias", "Projeto", "Município", "Data"];
      const tecRows2 = filteredTecnologias.map((t) => {
        const proj = projetos.find((p) => p.id === t.projetoId);
        return [CATEGORIAS[t.categoria]?.label || t.categoria, t.nome, t.quantidade, t.familias ?? 0, proj?.nome || "—", t.municipios || "—", t.data ? formatDate(t.data) : "—"];
      });
      const ws5 = XLSX.utils.aoa_to_sheet([tecHeader, ...tecRows2]);
      ws5["!cols"] = [{ wch: 42 }, { wch: 36 }, { wch: 12 }, { wch: 10 }, { wch: 34 }, { wch: 22 }, { wch: 14 }];
      applyHeaderStyle(ws5, 0, tecHeader.length);
      XLSX.utils.book_append_sheet(wb, ws5, "Tecnologias Sociais");

      XLSX.writeFile(wb, `CHAPADA_Indicadores_${dateIso}.xlsx`);
      toast.success("Planilha Excel exportada com sucesso (5 abas).");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar Excel.");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
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
      <div className="space-y-6">

        {/* ── Filtro de período ─────────────────────────────────────────────── */}
        <Card className="chapada-filter-card">
          <CardContent className="p-4 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Período:</span>
                <DatePicker value={dataDe} onChange={setDataDe} hasError={isPeriodInvalid} />
                <span className="text-xs text-muted-foreground">até</span>
                <DatePicker value={dataAte} onChange={setDataAte} hasError={isPeriodInvalid} />
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1">
                  <X className="h-3 w-3" /> Limpar filtros
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

        {/* ══════════════════════════════════════════════════════════════════════
            BLOCO 1 — 8 KPI Cards
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpiLine1.map((k) => <KpiCard key={k.label} {...k} />)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpiLine2.map((k) => <KpiCard key={k.label} {...k} />)}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            BLOCO 2 — Evolução temporal (gráfico de linha)
        ══════════════════════════════════════════════════════════════════════ */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Atividades e Ações ao Longo do Tempo
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {timelineData.length < 2 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <TrendingUp className="h-10 w-10 opacity-20" />
                <p className="text-sm font-medium">Dados insuficientes para análise temporal</p>
                <p className="text-xs opacity-70">Registre atividades em diferentes meses para visualizar a evolução.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 75)" />
                  <XAxis dataKey="label" stroke="oklch(0.55 0.03 60)" fontSize={11} />
                  <YAxis stroke="oklch(0.55 0.03 60)" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "12px" }}
                    labelStyle={{ fontWeight: "bold", color: "#2D5A27" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Line
                    type="monotone"
                    dataKey="atividades"
                    name="Atividades"
                    stroke="#2D5A27"
                    strokeWidth={2.5}
                    dot={{ fill: "#2D5A27", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="acoes"
                    name="Ações Independentes"
                    stroke="#C8522A"
                    strokeWidth={2.5}
                    dot={{ fill: "#C8522A", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════════
            BLOCO 3 — Beneficiários Bar + Municípios Pie
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Bar chart */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold" style={{ color: "#2D5A27" }}>Beneficiários por Grupo</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {beneficiarios.every((b) => b.total === 0) ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center">
                  Nenhum indicador registrado ainda. Preencha os indicadores nas atividades.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={beneficiarios}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 75)" />
                    <XAxis dataKey="grupo" stroke="oklch(0.5 0.03 60)" fontSize={10} />
                    <YAxis stroke="oklch(0.5 0.03 60)" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
                    <Bar dataKey="total" name="Total" fill="#C8522A" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Pie chart + table */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold" style={{ color: "#2D5A27" }}>Distribuição por Município</CardTitle>
            </CardHeader>
            <CardContent>
              {porMunicipio.length === 0 ? (
                <div className="h-72 flex items-center justify-center text-sm text-muted-foreground text-center">
                  Nenhuma atividade com município e participantes registrados.
                </div>
              ) : (
                <>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={porMunicipio} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {porMunicipio.map((_, i) => <Cell key={i} fill={MUNICIPIO_COLORS[i % MUNICIPIO_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Mini table */}
                  <div className="mt-3 border border-border/50 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Município</th>
                          <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Participantes</th>
                          <th className="text-center px-3 py-2 font-semibold text-muted-foreground">% do Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {porMunicipio.map((m, i) => (
                          <tr key={m.name} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                            <td className="px-3 py-1.5 flex items-center gap-1.5">
                              <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: MUNICIPIO_COLORS[i % MUNICIPIO_COLORS.length] }} />
                              {m.name}
                            </td>
                            <td className="px-3 py-1.5 text-center font-semibold">{m.value.toLocaleString("pt-BR")}</td>
                            <td className="px-3 py-1.5 text-center text-muted-foreground">
                              {totalMunicipioParticipants > 0 ? ((m.value / totalMunicipioParticipants) * 100).toFixed(1) + "%" : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            BLOCO 4 — Desempenho por Projeto (tabela expandível)
        ══════════════════════════════════════════════════════════════════════ */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold" style={{ color: "#2D5A27" }}>Desempenho por Projeto</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {projetosFiltrados.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Nenhum projeto encontrado no período selecionado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Projeto</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Financiador</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground min-w-[180px]">Vigência</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Participantes</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Atividades</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Status</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {projetosFiltrados.map((p) => (
                      <ProjectRow
                        key={p.id}
                        projeto={p}
                        atividades={filteredVinculadas.filter((a) => a.projetoId === p.id)}
                        isExpanded={expandedProjects.has(p.id)}
                        onToggle={() => toggleProject(p.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════════
            BLOCO 5 — Tecnologias Sociais por Linha de Ação
        ══════════════════════════════════════════════════════════════════════ */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold" style={{ color: "#2D5A27" }}>Tecnologias Sociais Implementadas</CardTitle>
          </CardHeader>
          <CardContent>
            {tecPorLinha.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Nenhuma tecnologia social registrada no período.
              </div>
            ) : (
              <>
                <div style={{ height: `${Math.max(200, tecPorLinha.length * 48 + 40)}px` }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tecPorLinha} layout="vertical" margin={{ top: 4, right: 30, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 75)" horizontal={false} />
                      <XAxis type="number" stroke="oklch(0.55 0.03 60)" fontSize={11} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" stroke="oklch(0.55 0.03 60)" fontSize={10} width={200} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(val, _name, props) => [val, props.payload?.fullName || props.payload?.name]}
                      />
                      <Bar dataKey="value" name="Unidades implementadas" fill="#4A7C3F" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex flex-wrap gap-6 justify-center border-t border-border/50 pt-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold" style={{ color: "#2D5A27" }}>{filteredTecnologias.length}</div>
                    <div className="text-xs text-muted-foreground">Tecnologias registradas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold" style={{ color: "#4A7C3F" }}>{totalTecnologiasCount.toLocaleString("pt-BR")}</div>
                    <div className="text-xs text-muted-foreground">Total de unidades implementadas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold" style={{ color: "#C8522A" }}>{tecPorLinha.length}</div>
                    <div className="text-xs text-muted-foreground">Linhas de ação ativas</div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════════
            BLOCO 6 — Resumo Consolidado (rodapé analítico)
        ══════════════════════════════════════════════════════════════════════ */}
        <Card className="shadow-sm border-t-4" style={{ borderTopColor: "#2D5A27" }}>
          <CardHeader>
            <CardTitle className="text-base font-bold" style={{ color: "#2D5A27" }}>Resumo Consolidado</CardTitle>
          </CardHeader>
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
