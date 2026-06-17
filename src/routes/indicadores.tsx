import { createFileRoute } from "@tanstack/react-router";
import { useRef, useMemo, useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  FileDown,
  FileSpreadsheet,
  FileText,
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
  SearchX,
} from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  useAtividades,
  useAtividadesIndependentes,
  refreshAtividades,
  type AtividadeFull,
} from "@/lib/atividadesStore";
import { useProjetos, type ProjetoDB } from "@/lib/projetosStore";
import { useTecnologias, CATEGORIAS } from "@/lib/tecnologiasStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatBRL } from "@/lib/mockData";
import chapadaLogo from "@/assets/chapada-logo.png";
import { EmptyState } from "@/components/ui/EmptyState";
import { useExportWord } from "@/hooks/useExportWord";
import type { DadosIndicadores } from "@/lib/exportWord";
import { GraficosIndicadores } from "@/components/indicadores/GraficosIndicadores";
import { coresPDF, hexToRgb } from "@/lib/exportColors";

export const Route = createFileRoute("/indicadores")({
  component: IndicadoresPage,
});

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

async function loadExportLogo(): Promise<string | null> {
  try {
    return await imageToBase64("/logo.png");
  } catch {
    try {
      return await imageToBase64(chapadaLogo);
    } catch {
      return null;
    }
  }
}

function drawPageHeader(doc: jsPDF, logoB64: string | null, periodoLabel: string) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...hexToRgb(coresPDF.rodape));
  doc.rect(0, 0, pageW, 30, "F");
  if (logoB64) {
    try { doc.addImage(logoB64, "PNG", 10, 3, 24, 24); } catch (_) {}
  }
  doc.setTextColor(...hexToRgb(coresPDF.textoRodape));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Centro de Habilitação e Apoio ao Pequeno Agricultor do Araripe", pageW / 2, 11, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Relatório de Indicadores e Beneficiários", pageW / 2, 18, { align: "center" });
  doc.text(`Período: ${periodoLabel}`, pageW / 2, 24, { align: "center" });
  doc.setTextColor(...hexToRgb(coresPDF.texto));
}

function drawPageFooter(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...hexToRgb(coresPDF.rodape));
    doc.rect(0, pageH - 14, pageW, 14, "F");
    doc.setTextColor(...hexToRgb(coresPDF.textoRodape));
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("CHAPADA — chapada@ongchapada.org.br", 14, pageH - 5);
    doc.text(`Página ${i} de ${totalPages}`, pageW - 14, pageH - 5, { align: "right" });
    doc.setTextColor(...hexToRgb(coresPDF.texto));
  }
}

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

const lastAutoTableY = (doc: jsPDF) => (doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? 0;

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...hexToRgb(coresPDF.tabelaCabecalho));
  doc.rect(14, y, pageW - 28, 8, "F");
  doc.setTextColor(...hexToRgb(coresPDF.textoRodape));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(title, 18, y + 5.5);
  doc.setTextColor(...hexToRgb(coresPDF.texto));
  return y + 12;
}

function drawPdfCover(doc: jsPDF, logoB64: string | null, periodoLabel: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  if (logoB64) {
    try {
      doc.addImage(logoB64, "PNG", pageW / 2 - 45, 92, 90, 90);
    } catch (_) {}
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...hexToRgb(coresPDF.titulo));
  doc.text("CHAPADA", pageW / 2, 214, { align: "center" });
  doc.setFontSize(14);
  doc.text("Relatório de Indicadores e Beneficiários", pageW / 2, 244, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...hexToRgb(coresPDF.textoSecundario));
  doc.text("Centro de Habilitação e Apoio ao Pequeno Agricultor do Araripe", pageW / 2, 270, { align: "center" });
  doc.text(`Período: ${periodoLabel}`, pageW / 2, 302, { align: "center" });
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, pageW / 2, pageH - 90, { align: "center" });
}

// ── Status badge classes (equal to /projetos) ──────────────────────────────────
const statusVariantIndicadores: Record<string, string> = {
  "Planejamento": "bg-terracotta/15 text-terracotta border-terracotta/30",
  "Em execução": "bg-savanna/15 text-savanna border-savanna/30",
  "Concluído": "bg-primary/10 text-primary border-primary/30",
  "Suspenso": "bg-destructive/15 text-destructive border-destructive/30",
};

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
    <Card className="bg-card border-2 border-[#E1F1F8] dark:border-border border-t-4 border-t-[#1A9FD4] dark:border-t-[#1A9FD4] rounded-[12px] shadow-sm hover:border-[#1A9FD4]/40 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col h-full justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              {label}
            </div>
            <div className="text-[34px] font-bold text-foreground font-[family:var(--font-display)] leading-[1] tracking-tight mb-1">
              {value.toLocaleString("pt-BR")}
            </div>
            <div className="text-[11px] text-muted-foreground opacity-80">
              {sub}
            </div>
          </div>
          <div
            className={`h-[42px] w-[42px] rounded-2xl grid place-items-center shrink-0 ${toneClass[tone] || "bg-accent"}`}
          >
            <Icon className="h-[20px] w-[20px]" strokeWidth={2} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Expandable Project Row ─────────────────────────────────────────────────────
interface ProjectRowProps {
  projeto: ProjetoDB;
  atividades: AtividadeFull[];
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

  const projPart = atividades.reduce((acc, a) => acc + (a.indicadores?.participantes ?? 0), 0);
  const projMulh = atividades.reduce((acc, a) => acc + (a.indicadores?.mulheres ?? 0), 0);
  const projJov = atividades.reduce((acc, a) => acc + (a.indicadores?.jovens ?? 0), 0);
  const projQui = atividades.reduce((acc, a) => acc + (a.indicadores?.quilombolas ?? 0), 0);

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
        <td className="py-3 px-4 min-w-[180px]">
          <div className="flex items-center gap-2">
            <Progress value={pct} className="flex-1 h-2" />
            <span className="text-xs font-semibold text-muted-foreground w-8 text-right">{pct}%</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {formatDate(projeto.inicio)} → {formatDate(projeto.termino)}
          </div>
        </td>
        <td className="py-3 px-4 text-center text-sm font-semibold">{projPart.toLocaleString("pt-BR")}</td>
        <td className="py-3 px-4 text-center text-sm">{atividades.length}</td>
        <td className="py-3 px-4">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusVariantIndicadores[projeto.status] ?? "bg-muted text-muted-foreground border-border"}`}>
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
                    <div key={item.label} className="bg-card rounded-lg p-2 border border-border/50 text-center">
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
  const hasFilterWithoutResults =
    hasActiveFilters &&
    (atividadesVinculadas.length > 0 ||
      atividadesIndependentes.length > 0 ||
      tecnologias.length > 0) &&
    filteredVinculadas.length === 0 &&
    filteredIndependentes.length === 0 &&
    filteredTecnologias.length === 0;

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
    { label: "MULHERES BENEF.", value: ind.mulheres, sub: "beneficiadas", icon: Heart, tone: "ocre" },
    { label: "JOVENS ATEND.", value: ind.jovens, sub: "atendidos", icon: GraduationCap, tone: "terracotta" },
    { label: "FAMÍLIAS ATEND.", value: totalFamilias, sub: "de tecnologias sociais", icon: Home, tone: "savanna" },
  ];

  const kpiLine2 = [
    { label: "QUILOMBOLAS", value: ind.quilombolas, sub: "público", icon: Flame, tone: "ocre" },
    { label: "POVOS ORIG.", value: ind.povosOriginarios, sub: "atendidos", icon: Feather, tone: "terracotta" },
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

  const atividadesPorMesGrafico = useMemo(
    () =>
      timelineData.map((item) => ({
        mes: item.label,
        atividades: item.atividades,
        acoesIndependentes: item.acoes,
      })),
    [timelineData]
  );

  const municipiosPorAtividadeGrafico = useMemo(() => {
    const map: Record<string, number> = {};
    [...filteredVinculadas, ...filteredIndependentes].forEach((atividade) => {
      const municipio = atividade.municipio?.trim() || "Não informado";
      map[municipio] = (map[municipio] ?? 0) + 1;
    });
    return Object.entries(map).map(([municipio, atividades]) => ({
      municipio,
      atividades,
    }));
  }, [filteredVinculadas, filteredIndependentes]);

  const participantesAcumuladosGrafico = useMemo(() => {
    let acumulado = 0;
    return [...filteredVinculadas, ...filteredIndependentes]
      .filter((atividade) => atividade.data)
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((atividade) => {
        acumulado += atividade.indicadores?.participantes ?? 0;
        return {
          periodo: formatDate(atividade.data),
          participantes: acumulado,
        };
      });
  }, [filteredVinculadas, filteredIndependentes]);

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

  const dadosWord = useMemo<DadosIndicadores>(() => {
    const municipioMap = new Map<
      string,
      {
        participantes: number;
        projetos: Set<string>;
        atividades: number;
        tecnologias: number;
      }
    >();

    [...filteredVinculadas, ...filteredIndependentes].forEach((atividade) => {
      const municipio = atividade.municipio?.trim() || "Não informado";
      const atual =
        municipioMap.get(municipio) ??
        { participantes: 0, projetos: new Set<string>(), atividades: 0, tecnologias: 0 };

      atual.participantes += atividade.indicadores?.participantes ?? 0;
      atual.atividades += 1;
      if (atividade.projetoId) atual.projetos.add(atividade.projetoId);
      municipioMap.set(municipio, atual);
    });

    filteredTecnologias.forEach((tecnologia) => {
      const municipio = tecnologia.municipios?.trim() || "Não informado";
      const atual =
        municipioMap.get(municipio) ??
        { participantes: 0, projetos: new Set<string>(), atividades: 0, tecnologias: 0 };

      atual.tecnologias += Number(tecnologia.quantidade) || 0;
      if (tecnologia.projetoId) atual.projetos.add(tecnologia.projetoId);
      municipioMap.set(municipio, atual);
    });

    const projetosWord = projetosFiltrados.map((projeto) => {
      const atividadesProjeto = filteredVinculadas.filter((atividade) => atividade.projetoId === projeto.id);
      return {
        id: projeto.id,
        nome: projeto.nome,
        contrato: projeto.contrato,
        financiador: projeto.financiador,
        inicio: projeto.inicio,
        termino: projeto.termino,
        valor: projeto.valor,
        municipios: projeto.municipios,
        status: projeto.status,
        atividades: atividadesProjeto.length,
        participantes: atividadesProjeto.reduce(
          (acc, atividade) => acc + (atividade.indicadores?.participantes ?? 0),
          0
        ),
        mulheres: atividadesProjeto.reduce(
          (acc, atividade) => acc + (atividade.indicadores?.mulheres ?? 0),
          0
        ),
      };
    });

    return {
      filtros: { dataDe, dataAte, periodoLabel },
      geradoEm: new Date(),
      kpis: [
        { indicador: "Total de Participantes", total: ind.participantes },
        { indicador: "Mulheres Beneficiadas", total: ind.mulheres },
        { indicador: "Jovens Atendidos", total: ind.jovens },
        { indicador: "Famílias Atendidas", total: totalFamilias },
        { indicador: "Público Quilombola", total: ind.quilombolas },
        { indicador: "Povos Originários", total: ind.povosOriginarios },
        { indicador: "Comunidades Tradicionais", total: ind.comunidadesTradicionais },
        { indicador: "Projetos Ativos", total: projetos.filter((p) => p.status === "Em execução").length },
        { indicador: "Atividades Realizadas", total: filteredVinculadas.length },
        { indicador: "Ações Independentes", total: filteredIndependentes.length },
        { indicador: "Tecnologias Sociais", total: totalTecnologiasCount + ind.tecnologiasSociais },
      ],
      projetos: projetosWord,
      municipios: [...municipioMap.entries()]
        .map(([municipio, valores]) => ({
          municipio,
          participantes: valores.participantes,
          projetos: valores.projetos.size,
          atividades: valores.atividades,
          tecnologias: valores.tecnologias,
        }))
        .sort((a, b) => b.participantes - a.participantes),
      gruposBeneficiarios: beneficiarios,
      atividadesMensais: timelineData.map((item) => ({
        mes: item.label,
        atividades: item.atividades,
        acoesIndependentes: item.acoes,
      })),
      tecnologias: filteredTecnologias.map((tecnologia) => {
        const projeto = projetos.find((p) => p.id === tecnologia.projetoId);
        return {
          categoria: CATEGORIAS[tecnologia.categoria]?.label || tecnologia.categoria,
          nome: tecnologia.nome,
          quantidade: Number(tecnologia.quantidade) || 0,
          familias: Number(tecnologia.familias) || 0,
          projeto: projeto?.nome || "-",
          municipio: tecnologia.municipios || "-",
          data: tecnologia.data,
        };
      }),
    };
  }, [
    beneficiarios,
    dataAte,
    dataDe,
    filteredIndependentes,
    filteredTecnologias,
    filteredVinculadas,
    ind,
    periodoLabel,
    projetos,
    projetosFiltrados,
    timelineData,
    totalFamilias,
    totalTecnologiasCount,
  ]);

  const { handleExportWord, isExportingWord } = useExportWord(dadosWord);

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

      const logoB64 = await loadExportLogo();

      drawPdfCover(doc, logoB64, periodoLabel);
      doc.addPage();
      drawPageHeader(doc, logoB64, periodoLabel);
      let y = CONTENT_TOP + 6;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...hexToRgb(coresPDF.textoSecundario));
      doc.text(`Gerado em: ${dateStr}`, pageW - MARGIN, y, { align: "right" });
      doc.setTextColor(...hexToRgb(coresPDF.texto));
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
        headStyles: { fillColor: hexToRgb(coresPDF.tabelaCabecalho), textColor: hexToRgb(coresPDF.textoRodape), fontStyle: "bold" },
        alternateRowStyles: { fillColor: hexToRgb(coresPDF.tabelaLinhaPar) },
        bodyStyles: { textColor: hexToRgb(coresPDF.texto) },
        columnStyles: { 0: { cellWidth: 300 }, 1: { cellWidth: 100, halign: "center", fontStyle: "bold" } },
        margin: { left: MARGIN, right: MARGIN },
        didDrawPage: () => { drawPageHeader(doc, logoB64, periodoLabel); },
      });
      y = lastAutoTableY(doc) + 18;

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
        headStyles: { fillColor: hexToRgb(coresPDF.tabelaCabecalho), textColor: hexToRgb(coresPDF.textoRodape), fontStyle: "bold" },
        alternateRowStyles: { fillColor: hexToRgb(coresPDF.tabelaLinhaPar) },
        bodyStyles: { textColor: hexToRgb(coresPDF.texto) },
        columnStyles: { 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" } },
        margin: { left: MARGIN, right: MARGIN },
        didDrawPage: () => { drawPageHeader(doc, logoB64, periodoLabel); },
      });
      y = lastAutoTableY(doc) + 18;

      if (y > pageH - FOOTER_H - 60) { doc.addPage(); y = CONTENT_TOP + 4; }
      y = sectionTitle(doc, "SEÇÃO 3 — Detalhamento por Projeto", y);
      for (const p of projetosFiltrados) {
        if (y > pageH - FOOTER_H - 100) { doc.addPage(); y = CONTENT_TOP + 4; }
        doc.setFillColor(...hexToRgb(coresPDF.tabelaLinhaPar));
        doc.rect(MARGIN, y, pageW - MARGIN * 2, 10, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...hexToRgb(coresPDF.titulo));
        doc.text(`${p.nome}  (${p.contrato})`, MARGIN + 4, y + 7);
        doc.setTextColor(...hexToRgb(coresPDF.texto));
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
        y = lastAutoTableY(doc) + 6;
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
        headStyles: { fillColor: hexToRgb(coresPDF.tabelaCabecalho), textColor: hexToRgb(coresPDF.textoRodape), fontStyle: "bold" },
        alternateRowStyles: { fillColor: hexToRgb(coresPDF.tabelaLinhaPar) },
        bodyStyles: { textColor: hexToRgb(coresPDF.texto) },
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
        const headerStyle = {
          font: { bold: true, color: { rgb: coresPDF.textoRodape.replace("#", "") } },
          fill: { fgColor: { rgb: coresPDF.tabelaCabecalho.replace("#", "") } },
          alignment: { horizontal: "center" },
        };
        for (let c = 0; c < numCols; c++) {
          const cellAddr = XLSX.utils.encode_cell({ r: headerRow, c });
          if (ws[cellAddr]) ws[cellAddr].s = headerStyle;
        }
      };

      const resumoData: Array<Array<string | number>> = [
        ["CHAPADA"],
        ["Centro de Habilitação e Apoio ao Pequeno Agricultor do Araripe"],
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
      if (ws1["A1"]) ws1["A1"].s = { font: { bold: true, sz: 18, color: { rgb: coresPDF.titulo.replace("#", "") } } };
      if (ws1["A2"]) ws1["A2"].s = { font: { bold: true, sz: 12, color: { rgb: coresPDF.subtitulo.replace("#", "") } } };
      applyHeaderStyle(ws1, 6, 2);
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
          <Button variant="outline" onClick={handleExportWord} disabled={isExportingWord} className="gap-2">
            <FileText className="h-4 w-4" />
            {isExportingWord ? "Gerando..." : "Exportar Word"}
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

        {hasFilterWithoutResults && (
          <EmptyState
            icon={<SearchX />}
            title="Nenhum resultado encontrado"
            description="Tente ajustar os filtros ou limpar a busca."
            action={{ label: "Limpar filtros", onClick: clearFilters }}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            BLOCO 1 — 8 KPI Cards
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpiLine1.map((k) => <KpiCard key={k.label} {...k} />)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpiLine2.map((k) => <KpiCard key={k.label} {...k} />)}
          </div>
        </div>

        <GraficosIndicadores
          beneficiarios={beneficiarios}
          atividadesPorMes={atividadesPorMesGrafico}
          municipiosPorAtividade={municipiosPorAtividadeGrafico}
          participantesAcumulados={participantesAcumuladosGrafico}
        />

        {/* ══════════════════════════════════════════════════════════════════════
            BLOCO 4 — Desempenho por Projeto (tabela expandível)
        ══════════════════════════════════════════════════════════════════════ */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-foreground">Desempenho por Projeto</CardTitle>
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
            <CardTitle className="text-base font-bold text-foreground">Tecnologias Sociais Implementadas</CardTitle>
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
                      <CartesianGrid strokeDasharray="3 3" stroke={coresPDF.borda} horizontal={false} />
                      <XAxis type="number" stroke={coresPDF.textoSecundario} fontSize={11} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" stroke={coresPDF.textoSecundario} fontSize={10} width={200} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(val, _name, props) => [val, props.payload?.fullName || props.payload?.name]}
                      />
                      <Bar dataKey="value" name="Unidades implementadas" fill={coresPDF.chart2} radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex flex-wrap gap-6 justify-center border-t border-border/50 pt-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold" style={{ color: coresPDF.titulo }}>{filteredTecnologias.length}</div>
                    <div className="text-xs text-muted-foreground">Tecnologias registradas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold" style={{ color: coresPDF.chart2 }}>{totalTecnologiasCount.toLocaleString("pt-BR")}</div>
                    <div className="text-xs text-muted-foreground">Total de unidades implementadas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold" style={{ color: coresPDF.chart3 }}>{tecPorLinha.length}</div>
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
        <Card className="shadow-sm border-2 border-[#E1F1F8] dark:border-border border-t-4 border-t-[#1A9FD4] dark:border-t-[#1A9FD4] rounded-[12px]">
          <CardHeader>
            <CardTitle className="text-base font-bold text-foreground">Resumo Consolidado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {beneficiarios.map((b) => (
                <div key={b.grupo} className="text-center p-4 bg-muted/50 rounded-xl border border-border/50 hover:bg-muted/70 transition-colors">
                  <div className="text-2xl font-display font-semibold text-foreground">
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
