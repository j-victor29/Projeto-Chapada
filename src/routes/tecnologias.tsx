import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pencil,
  Plus,
  Trash2,
  Loader2,
  Search,
  Droplets,
  Users,
  MapPin,
  Info,
  Wrench,
} from "lucide-react";
import { formatDate } from "@/lib/mockData";
import { useProjetos } from "@/lib/projetosStore";
import {
  canEdit,
  denyToast,
  getOwnership,
  makeOwnership,
  removeOwnership,
  setOwnership,
  useOwnership,
} from "@/lib/ownershipStore";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { CollaboratorsSection } from "@/components/CollaboratorsSection";
import { addNotification } from "@/lib/notificationsStore";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/tecnologias")({
  component: TecnologiasPage,
});

interface ProjetoTecnologiaRow {
  id: string;
  projeto_id: string;
  tecnologia_id: string;
  quantidade: number;
  unidade: string;
  familias?: number;
  municipios: string;
  comunidades?: string;
  data: string;
  observacoes?: string;
  tecnologias?: {
    nome: string;
    linha_acao: string;
  };
  projetos?: {
    nome: string;
  };
}

// ─── Configuração visual de cada Linha de Ação ──────────────────────────────
interface LinhaConfig {
  bg: string;
  text: string;
  border: string;
  icon: string;
  badgeBg: string;
  badgeText: string;
}

const coresLinhasAcao: Record<string, LinhaConfig> = {
  "Convivência com o Semiárido e Segurança Hídrica": {
    bg: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
    text: "#ffffff",
    border: "#0ea5e9",
    icon: "💧",
    badgeBg: "rgba(255,255,255,0.2)",
    badgeText: "#ffffff",
  },
  "Saneamento Rural": {
    bg: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
    text: "#ffffff",
    border: "#22c55e",
    icon: "🚿",
    badgeBg: "rgba(255,255,255,0.2)",
    badgeText: "#ffffff",
  },
  "Energias Renováveis": {
    bg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    text: "#ffffff",
    border: "#f59e0b",
    icon: "⚡",
    badgeBg: "rgba(255,255,255,0.2)",
    badgeText: "#ffffff",
  },
  "Agroecologia e Produção Sustentável": {
    bg: "linear-gradient(135deg, #15803d 0%, #166534 100%)",
    text: "#ffffff",
    border: "#15803d",
    icon: "🌱",
    badgeBg: "rgba(255,255,255,0.2)",
    badgeText: "#ffffff",
  },
  "Segurança Alimentar e Nutricional": {
    bg: "linear-gradient(135deg, #f97316 0%, #c2410c 100%)",
    text: "#ffffff",
    border: "#f97316",
    icon: "🌽",
    badgeBg: "rgba(255,255,255,0.2)",
    badgeText: "#ffffff",
  },
  "Inclusão Socioprodutiva e Economia Solidária": {
    bg: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
    text: "#ffffff",
    border: "#a855f7",
    icon: "🤝",
    badgeBg: "rgba(255,255,255,0.2)",
    badgeText: "#ffffff",
  },
  "Formação, ATER e Gestão Social": {
    bg: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
    text: "#ffffff",
    border: "#6366f1",
    icon: "📚",
    badgeBg: "rgba(255,255,255,0.2)",
    badgeText: "#ffffff",
  },
  "Meio Ambiente e Restauração Ecológica": {
    bg: "linear-gradient(135deg, #059669 0%, #065f46 100%)",
    text: "#ffffff",
    border: "#059669",
    icon: "🌿",
    badgeBg: "rgba(255,255,255,0.2)",
    badgeText: "#ffffff",
  },
  "Comunicação Popular e Mobilização Social": {
    bg: "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
    text: "#ffffff",
    border: "#ec4899",
    icon: "📣",
    badgeBg: "rgba(255,255,255,0.2)",
    badgeText: "#ffffff",
  },
  "Fortalecimento Organizativo": {
    bg: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
    text: "#ffffff",
    border: "#8b5cf6",
    icon: "🏛️",
    badgeBg: "rgba(255,255,255,0.2)",
    badgeText: "#ffffff",
  },
  "Direitos e Cidadania": {
    bg: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
    text: "#ffffff",
    border: "#ef4444",
    icon: "⚖️",
    badgeBg: "rgba(255,255,255,0.2)",
    badgeText: "#ffffff",
  },
};

const defaultConfig: LinhaConfig = {
  bg: "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)",
  text: "#ffffff",
  border: "#6b7280",
  icon: "📦",
  badgeBg: "rgba(255,255,255,0.2)",
  badgeText: "#ffffff",
};

function getLinhaConfig(linha: string): LinhaConfig {
  return coresLinhasAcao[linha] ?? defaultConfig;
}

// ─── Página principal ────────────────────────────────────────────────────────
function TecnologiasPage() {
  const projetos = useProjetos();
  const { email: currentEmail, name: currentName } = useCurrentUser();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjetoTecnologiaRow | null>(null);
  const [toDelete, setToDelete] = useState<ProjetoTecnologiaRow | null>(null);
  // linha de ação pré-selecionada ao clicar "+ Adicionar" em um grupo
  const [preSelectedLinha, setPreSelectedLinha] = useState<string>("");

  const [tecnologias, setTecnologias] = useState<ProjetoTecnologiaRow[]>([]);
  const [catalogo, setCatalogo] = useState<
    { id: string; nome: string; linha_acao: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [linhaFiltro, setLinhaFiltro] = useState("all");

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchTecnologias = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("projeto_tecnologias")
      .select(
        `
        id,
        projeto_id,
        tecnologia_id,
        quantidade,
        unidade,
        familias,
        municipios,
        comunidades,
        data,
        observacoes,
        tecnologias (
          id,
          nome,
          linha_acao
        ),
        projetos (
          nome
        )
      `
      )
      .order("data", { ascending: false, nullsFirst: false });

    if (error) {
      console.error(
        "ERRO SUPABASE:",
        error.code,
        error.message,
        error.details,
        error.hint
      );
      toast.error(`Erro ao carregar tecnologias: ${error.message}`);
    } else {
      setTecnologias((data as unknown as ProjetoTecnologiaRow[]) || []);
    }
    setLoading(false);
  };

  const fetchCatalogo = async () => {
    const { data, error } = await supabase
      .from("tecnologias")
      .select("id, nome, linha_acao")
      .eq("ativo", true)
      .order("linha_acao")
      .order("nome");
    if (error) {
      console.error("Erro ao buscar catálogo:", error);
    } else {
      setCatalogo(data || []);
    }
  };

  useEffect(() => {
    fetchTecnologias();
    fetchCatalogo();
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openCreate = (linha?: string) => {
    setEditing(null);
    setPreSelectedLinha(linha ?? "");
    setOpen(true);
  };

  const openEdit = (t: ProjetoTecnologiaRow) => {
    if (!canEdit("tecnologia", t.id, currentEmail)) {
      denyToast();
      return;
    }
    setEditing(t);
    setPreSelectedLinha("");
    setOpen(true);
  };

  const requestDelete = (t: ProjetoTecnologiaRow) => {
    if (!canEdit("tecnologia", t.id, currentEmail)) {
      denyToast();
      return;
    }
    setToDelete(t);
  };

  // ── Métricas ──────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const totalQty = tecnologias.reduce(
      (acc, t) => acc + (Number(t.quantidade) || 0),
      0
    );
    const totalFamilies = tecnologias.reduce(
      (acc, t) => acc + (Number(t.familias) || 0),
      0
    );
    const uniqueProj = new Set(
      tecnologias.map((t) => t.projeto_id).filter(Boolean)
    ).size;
    const allCities = tecnologias.flatMap((t) =>
      t.municipios ? t.municipios.split(",").map((s) => s.trim()) : []
    );
    const uniqueCities = new Set(allCities.filter(Boolean)).size;
    return { totalQty, totalFamilies, uniqueProj, uniqueCities };
  }, [tecnologias]);

  // ── Linhas de ação disponíveis para o filtro ──────────────────────────────
  const linhasDeAcao = useMemo(() => {
    return [...new Set(catalogo.map((t) => t.linha_acao))];
  }, [catalogo]);

  // ── Filtragem + Agrupamento ───────────────────────────────────────────────
  const filteredTecnologias = useMemo(() => {
    return tecnologias.filter((t) => {
      const nomeTech = t.tecnologias?.nome?.toLowerCase() || "";
      const projName = t.projetos?.nome?.toLowerCase() || "";
      const muni = t.municipios?.toLowerCase() || "";
      const obs = t.observacoes?.toLowerCase() || "";
      const search = searchQuery.toLowerCase();

      const matchesSearch =
        nomeTech.includes(search) ||
        projName.includes(search) ||
        muni.includes(search) ||
        obs.includes(search);

      const matchesLinha =
        linhaFiltro === "all" || t.tecnologias?.linha_acao === linhaFiltro;

      return matchesSearch && matchesLinha;
    });
  }, [tecnologias, searchQuery, linhaFiltro]);

  const grupos = useMemo(() => {
    return filteredTecnologias.reduce((acc, tec) => {
      const linha = tec.tecnologias?.linha_acao ?? "Sem categoria";
      if (!acc[linha]) acc[linha] = [];
      acc[linha].push(tec);
      return acc;
    }, {} as Record<string, ProjetoTecnologiaRow[]>);
  }, [filteredTecnologias]);

  // Ordem preferencial das linhas
  const ordemLinhas = [
    "Convivência com o Semiárido e Segurança Hídrica",
    "Saneamento Rural",
    "Energias Renováveis",
    "Agroecologia e Produção Sustentável",
    "Segurança Alimentar e Nutricional",
    "Inclusão Socioprodutiva e Economia Solidária",
    "Formação, ATER e Gestão Social",
    "Meio Ambiente e Restauração Ecológica",
    "Comunicação Popular e Mobilização Social",
    "Fortalecimento Organizativo",
    "Direitos e Cidadania",
  ];

  const gruposOrdenados = Object.entries(grupos).sort(([a], [b]) => {
    const ia = ordemLinhas.indexOf(a);
    const ib = ordemLinhas.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout
      title="Tecnologias Sociais"
      subtitle="Registro e monitoramento das tecnologias implementadas pela CHAPADA"
      actions={
        <Button onClick={() => openCreate()} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Tecnologia
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Banner institucional */}
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-xl text-primary shrink-0">
              <Droplets className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                Convivência e Transformação no Semiárido
              </h3>
              <p className="text-sm text-muted-foreground max-w-4xl">
                A ONG Chapada acumula mais de 31 anos de atuação nas comunidades
                do Semiárido pernambucano e piauiense, tendo implantado quase{" "}
                <strong>11 mil tecnologias sociais hídricas</strong> e
                beneficiado aproximadamente{" "}
                <strong> 22 mil famílias agricultoras</strong>. Os registros
                abaixo são integrados aos projetos financiados pelos nossos
                parceiros e apoiadores.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Cards de métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Implementações
                </span>
                <h4 className="text-2xl font-bold">{tecnologias.length}</h4>
                <p className="text-[11px] text-muted-foreground">
                  Tecnologias registradas
                </p>
              </div>
              <Wrench className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Quantidade Total
                </span>
                <h4 className="text-2xl font-bold">
                  {metrics.totalQty.toLocaleString("pt-BR")}
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Unidades implantadas
                </p>
              </div>
              <Droplets className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Famílias Atendidas
                </span>
                <h4 className="text-2xl font-bold">
                  {metrics.totalFamilies.toLocaleString("pt-BR")}
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Famílias beneficiadas
                </p>
              </div>
              <Users className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Alcance Geográfico
                </span>
                <h4 className="text-2xl font-bold">
                  {metrics.uniqueCities}{" "}
                  {metrics.uniqueCities === 1 ? "Município" : "Municípios"}
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Em {metrics.uniqueProj}{" "}
                  {metrics.uniqueProj === 1 ? "projeto" : "projetos"}
                </p>
              </div>
              <MapPin className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        {/* Barra de busca */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar tecnologia, projeto, município..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Filtro de Categorias — botões/abas com scroll horizontal */}
        <div
          className="flex gap-2 overflow-x-auto pb-1 scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {/* Botão "Todas" */}
          <button
            type="button"
            onClick={() => setLinhaFiltro("all")}
            className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold border transition-all shrink-0 ${
              linhaFiltro === "all"
                ? "bg-foreground text-background border-foreground shadow-sm"
                : "bg-card text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
            }`}
          >
            ✦ Todas
          </button>

          {/* Botões das categorias que existem nos dados */}
          {linhasDeAcao.map((linha) => {
            const cfg = getLinhaConfig(linha);
            const isActive = linhaFiltro === linha;
            return (
              <button
                key={linha}
                type="button"
                onClick={() => setLinhaFiltro(isActive ? "all" : linha)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold border transition-all shrink-0 ${
                  isActive
                    ? "shadow-md"
                    : "bg-card text-muted-foreground border-border hover:opacity-80"
                }`}
                style={
                  isActive
                    ? {
                        background: cfg.bg,
                        color: cfg.text,
                        borderColor: cfg.border,
                      }
                    : undefined
                }
              >
                <span>{cfg.icon}</span>
                {linha}
              </button>
            );
          })}
        </div>

        {/* Conteúdo principal */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : gruposOrdenados.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">
            <Info className="h-12 w-12 mx-auto mb-4 text-muted" />
            <p className="text-base font-medium">
              Nenhum registro de tecnologia encontrado.
            </p>
            <p className="text-sm mt-1">
              Tente ajustar os filtros ou cadastre uma nova tecnologia.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {gruposOrdenados.map(([linha, itens]) => {
              const cfg = getLinhaConfig(linha);
              const totalUnidades = itens.reduce(
                (sum, t) => sum + (Number(t.quantidade) || 0),
                0
              );

              return (
                <div
                  key={linha}
                  className="rounded-xl overflow-hidden shadow-md border"
                  style={{ borderColor: cfg.border + "40" }}
                >
                  {/* Header colorido do grupo */}
                  <div
                    style={{
                      background: cfg.bg,
                      color: cfg.text,
                    }}
                    className="px-5 py-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-2xl leading-none shrink-0 mt-0.5">
                        {cfg.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-base leading-snug">
                          {linha}
                        </p>
                        <p
                          className="text-sm mt-0.5"
                          style={{ opacity: 0.85 }}
                        >
                          {itens.length}{" "}
                          {itens.length === 1
                            ? "tecnologia cadastrada"
                            : "tecnologias cadastradas"}{" "}
                          · Total:{" "}
                          <strong>
                            {totalUnidades.toLocaleString("pt-BR")} unidades
                          </strong>
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => openCreate(linha)}
                      style={{
                        background: cfg.badgeBg,
                        color: cfg.text,
                        border: "1px solid rgba(255,255,255,0.35)",
                        backdropFilter: "blur(4px)",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                      className="gap-1.5 font-medium hover:opacity-90 transition-opacity"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar
                    </Button>
                  </div>

                  {/* Tabela interna do grupo */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr
                          className="border-b text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          style={{
                            background: cfg.border + "10",
                          }}
                        >
                          <th className="px-4 py-2.5 text-left">Nome</th>
                          <th className="px-4 py-2.5 text-left">Quantidade</th>
                          <th className="px-4 py-2.5 text-left">Famílias</th>
                          <th className="px-4 py-2.5 text-left">Municípios</th>
                          <th className="px-4 py-2.5 text-left">Projeto</th>
                          <th className="px-4 py-2.5 text-left">Data</th>
                          <th className="px-4 py-2.5 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itens.map((tec, idx) => {
                          const ownership = getOwnership(
                            "tecnologia",
                            tec.id
                          );
                          return (
                            <tr
                              key={tec.id}
                              className="border-b last:border-0 transition-colors hover:bg-muted/40"
                              style={
                                idx % 2 === 0
                                  ? { background: "transparent" }
                                  : { background: cfg.border + "06" }
                              }
                            >
                              <td className="px-4 py-3 font-medium text-foreground">
                                {tec.tecnologias?.nome || "Sem Nome"}
                              </td>
                              <td className="px-4 py-3 text-foreground">
                                <span className="font-semibold">
                                  {Number(tec.quantidade).toLocaleString(
                                    "pt-BR"
                                  )}
                                </span>{" "}
                                <span className="text-muted-foreground text-xs">
                                  {tec.unidade}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-foreground">
                                {tec.familias
                                  ? Number(tec.familias).toLocaleString("pt-BR")
                                  : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td
                                className="px-4 py-3 text-foreground max-w-[160px] truncate"
                                title={tec.municipios}
                              >
                                {tec.municipios || (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-foreground leading-snug">
                                  {tec.projetos?.nome || "—"}
                                </div>
                                {ownership && (
                                  <div className="text-[10px] text-muted-foreground mt-0.5">
                                    Criado por {ownership.ownerName}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                                {tec.data ? formatDate(tec.data) : "—"}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => openEdit(tec)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => requestDelete(tec)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TecnologiaModal
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        projetos={projetos}
        catalogo={catalogo}
        currentEmail={currentEmail}
        currentName={currentName}
        onSuccess={fetchTecnologias}
        preSelectedLinha={preSelectedLinha}
      />

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover tecnologia?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.{" "}
              {toDelete
                ? `A tecnologia "${toDelete.tecnologias?.nome}" associada ao projeto "${toDelete.projetos?.nome}" será removida permanentemente.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (toDelete) {
                  if (!canEdit("tecnologia", toDelete.id, currentEmail)) {
                    denyToast();
                    setToDelete(null);
                    return;
                  }
                  try {
                    const { error } = await supabase
                      .from("projeto_tecnologias")
                      .delete()
                      .eq("id", toDelete.id);
                    if (error) throw error;

                    removeOwnership("tecnologia", toDelete.id);
                    toast.success("Tecnologia excluída com sucesso.");
                    await fetchTecnologias();
                  } catch (err: any) {
                    console.error(
                      "ERRO COMPLETO:",
                      JSON.stringify(err, null, 2)
                    );
                    toast.error(
                      `Erro ao excluir tecnologia: ${err.message || JSON.stringify(err)}`
                    );
                  }
                }
                setToDelete(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

// ─── Modal de criação/edição ─────────────────────────────────────────────────
function TecnologiaModal({
  open,
  onOpenChange,
  editing,
  projetos,
  catalogo,
  currentEmail,
  currentName,
  onSuccess,
  preSelectedLinha,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: ProjetoTecnologiaRow | null;
  projetos: { id: string; nome: string }[];
  catalogo: { id: string; nome: string; linha_acao: string }[];
  currentEmail: string;
  currentName: string;
  onSuccess: () => Promise<void>;
  preSelectedLinha: string;
}) {
  const [tecnologiaId, setTecnologiaId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [unidade, setUnidade] = useState("unidades");
  const [familias, setFamilias] = useState("");
  const [municipios, setMunicipios] = useState("");
  const [comunidades, setComunidades] = useState("");
  const [projetoId, setProjetoId] = useState<string>("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [observacoes, setObservacoes] = useState("");
  const editingOwnership = useOwnership("tecnologia", editing?.id ?? "");

  // Agrupar catálogo por linha de ação para exibir no select
  const linhasDeAcao = useMemo(() => {
    return [...new Set(catalogo.map((t) => t.linha_acao))];
  }, [catalogo]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTecnologiaId(editing.tecnologia_id || "");
      setQuantidade(String(editing.quantidade));
      setUnidade(editing.unidade || "unidades");
      setFamilias(editing.familias ? String(editing.familias) : "");
      setMunicipios(editing.municipios || "");
      setComunidades(editing.comunidades ?? "");
      setProjetoId(editing.projeto_id ?? "");
      setData(
        editing.data
          ? editing.data.slice(0, 10)
          : new Date().toISOString().slice(0, 10)
      );
      setObservacoes(editing.observacoes ?? "");
    } else {
      // Se há uma linha pré-selecionada, pré-selecionar a primeira tecnologia dessa linha
      if (preSelectedLinha) {
        const firstOfLinha = catalogo.find(
          (t) => t.linha_acao === preSelectedLinha
        );
        setTecnologiaId(firstOfLinha?.id ?? "");
      } else {
        setTecnologiaId("");
      }
      setUnidade("unidades");
      setQuantidade("");
      setFamilias("");
      setMunicipios("");
      setComunidades("");
      setProjetoId("");
      setData(new Date().toISOString().slice(0, 10));
      setObservacoes("");
    }
  }, [open, editing, preSelectedLinha, catalogo]);

  const submit = async () => {
    if (!tecnologiaId) {
      toast.error("Por favor, selecione uma tecnologia do catálogo oficial.");
      return;
    }
    if (!quantidade || Number(quantidade) <= 0) {
      toast.error("Por favor, insira uma quantidade válida superior a 0.");
      return;
    }
    if (!projetoId) {
      toast.error("O campo 'Projeto vinculado' é obrigatório.");
      return;
    }
    if (!municipios.trim()) {
      toast.error("Por favor, informe os municípios atendidos.");
      return;
    }

    try {
      const selectedTech = catalogo.find((t) => t.id === tecnologiaId);
      const techNome = selectedTech?.nome || "Tecnologia Social";

      if (editing) {
        if (!canEdit("tecnologia", editing.id, currentEmail)) {
          denyToast();
          return;
        }
        const { error } = await supabase
          .from("projeto_tecnologias")
          .update({
            projeto_id: projetoId,
            tecnologia_id: tecnologiaId,
            quantidade: Number(quantidade),
            unidade,
            familias: familias ? Number(familias) : null,
            municipios,
            comunidades: comunidades || null,
            data,
            observacoes: observacoes || null,
          })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Tecnologia atualizada com sucesso.");
      } else {
        const id = crypto.randomUUID();
        const { error } = await supabase.from("projeto_tecnologias").insert({
          id,
          projeto_id: projetoId,
          tecnologia_id: tecnologiaId,
          quantidade: Number(quantidade),
          unidade,
          familias: familias ? Number(familias) : null,
          municipios,
          comunidades: comunidades || null,
          data,
          observacoes: observacoes || null,
        });
        if (error) throw error;
        setOwnership("tecnologia", id, makeOwnership(currentEmail, currentName));
        addNotification({
          type: "tecnologia",
          title: "Nova tecnologia cadastrada",
          body: techNome,
        });
        toast.success("Tecnologia cadastrada com sucesso.");
      }

      await onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("ERRO COMPLETO AO SALVAR:", JSON.stringify(err, null, 2));
      toast.error(
        `Erro ao salvar tecnologia: ${err.message || JSON.stringify(err)}`
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? "Editar Registro de Tecnologia"
              : "Novo Registro de Tecnologia"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="md:col-span-2">
            <Label>
              Tecnologia Social (Catálogo Chapada){" "}
              <span className="text-destructive">*</span>
            </Label>
            <select
              value={tecnologiaId}
              onChange={(e) => setTecnologiaId(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Selecione a tecnologia...</option>
              {linhasDeAcao.map((linha) => (
                <optgroup key={linha} label={linha}>
                  {catalogo
                    .filter((t) => t.linha_acao === linha)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <Label>
              Quantidade Implementada{" "}
              <span className="text-destructive">*</span>
            </Label>
            <CurrencyInput
              step={1}
              value={quantidade !== "" ? Number(quantidade) : undefined}
              onChange={(v) =>
                setQuantidade(v !== undefined ? String(v) : "")
              }
            />
          </div>

          <div>
            <Label>
              Unidade de Medida <span className="text-destructive">*</span>
            </Label>
            <Select value={unidade} onValueChange={setUnidade}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["unidades", "hectares", "famílias"].map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label>Famílias Beneficiadas (Opcional)</Label>
            <CurrencyInput
              step={1}
              value={familias !== "" ? Number(familias) : undefined}
              onChange={(v) =>
                setFamilias(v !== undefined ? String(v) : "")
              }
              placeholder="Informe o número total de famílias atendidas"
            />
          </div>

          <div className="md:col-span-2">
            <Label>
              Municípios Atendidos{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              value={municipios}
              onChange={(e) => setMunicipios(e.target.value)}
              placeholder="Ex: Araripina, Ouricuri, Bodocó"
            />
          </div>

          <div className="md:col-span-2">
            <Label>Comunidades Atendidas</Label>
            <Input
              value={comunidades}
              onChange={(e) => setComunidades(e.target.value)}
              placeholder="Ex: Comunidade da Lagoa, Assentamento Mandacaru"
            />
          </div>

          <div>
            <Label>
              Projeto Vinculado <span className="text-destructive">*</span>
            </Label>
            <Select value={projetoId || undefined} onValueChange={setProjetoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o projeto" />
              </SelectTrigger>
              <SelectContent>
                {projetos.length > 0 ? (
                  projetos
                    .filter((p) => p.id && String(p.id).trim() !== "")
                    .map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.nome}
                      </SelectItem>
                    ))
                ) : (
                  <SelectItem value="none" disabled>
                    Nenhum projeto cadastrado
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>
              Data de Implementação{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <Label>Observações adicionais</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Descreva detalhes específicos do projeto ou implantação"
            />
          </div>

          {editing && editingOwnership && (
            <div className="md:col-span-2">
              <CollaboratorsSection
                type="tecnologia"
                id={editing.id}
                ownership={editingOwnership}
                currentEmail={currentEmail}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
