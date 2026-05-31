import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FolderKanban,
  Users,
  Heart,
  GraduationCap,
  MapPin,
  Wrench,
  Flame,
  Feather,
  Calendar,
  Filter,
  X,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjetos } from "@/lib/projetosStore";
import { useTecnologias, CATEGORIAS } from "@/lib/tecnologiasStore";
import { useAtividades, useAtividadesIndependentes } from "@/lib/atividadesStore";
import { Municipios, Financiadores } from "@/lib/cadastrosStore";
import { formatDate } from "@/lib/mockData";

const toneClass: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  savanna: "bg-savanna/15 text-savanna",
  terracotta: "bg-terracotta/15 text-terracotta",
  ocre: "bg-ocre/20 text-ocre-foreground",
};

export default function Dashboard() {
  const projetos = useProjetos();
  const tecnologias = useTecnologias();
  const atividadesVinculadas = useAtividades();
  const atividadesIndependentes = useAtividadesIndependentes();
  const { data: dbMunicipios = [] } = Municipios.useList();
  const { data: dbFinanciadores = [] } = Financiadores.useList();

  // ─── Filter States ──────────────────────────────────────────────────────────
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [selProjeto, setSelProjeto] = useState("todos");
  const [selFinanciador, setSelFinanciador] = useState("todos");
  const [selMunicipio, setSelMunicipio] = useState("todos");
  const [selStatus, setSelStatus] = useState("todos");
  const [selCategoria, setSelCategoria] = useState("todos");

  const hasActiveFilters = useMemo(() => {
    return (
      dataDe !== "" ||
      dataAte !== "" ||
      selProjeto !== "todos" ||
      selFinanciador !== "todos" ||
      selMunicipio !== "todos" ||
      selStatus !== "todos" ||
      selCategoria !== "todos"
    );
  }, [dataDe, dataAte, selProjeto, selFinanciador, selMunicipio, selStatus, selCategoria]);

  const clearFilters = () => {
    setDataDe("");
    setDataAte("");
    setSelProjeto("todos");
    setSelFinanciador("todos");
    setSelMunicipio("todos");
    setSelStatus("todos");
    setSelCategoria("todos");
  };

  // ─── Filtered Projects ──────────────────────────────────────────────────────
  const filteredProjetos = useMemo(() => {
    return projetos.filter((p) => {
      if (dataDe && p.termino < dataDe) return false;
      if (dataAte && p.inicio > dataAte) return false;
      if (selProjeto !== "todos" && p.id !== selProjeto) return false;
      if (selFinanciador !== "todos" && p.financiador !== selFinanciador) return false;
      if (selMunicipio !== "todos" && !p.municipios.includes(selMunicipio)) return false;
      if (selStatus !== "todos" && p.status !== selStatus) return false;
      if (selCategoria !== "todos") {
        const hasTechCat = tecnologias.some(
          (t) => t.projetoId === p.id && t.categoria === selCategoria
        );
        if (!hasTechCat) return false;
      }
      return true;
    });
  }, [projetos, tecnologias, dataDe, dataAte, selProjeto, selFinanciador, selMunicipio, selStatus, selCategoria]);

  // ─── Filtered Activities ────────────────────────────────────────────────────
  const allAtividadesRaw = useMemo(() => {
    return [...atividadesVinculadas, ...atividadesIndependentes];
  }, [atividadesVinculadas, atividadesIndependentes]);

  const filteredAtividades = useMemo(() => {
    return allAtividadesRaw.filter((a) => {
      if (dataDe && a.data < dataDe) return false;
      if (dataAte && a.data > dataAte) return false;

      if (a.projetoId) {
        const proj = projetos.find((p) => p.id === a.projetoId);
        if (!proj) return false;

        if (selProjeto !== "todos" && a.projetoId !== selProjeto) return false;
        if (selFinanciador !== "todos" && proj.financiador !== selFinanciador) return false;
        if (selStatus !== "todos" && proj.status !== selStatus) return false;
        if (
          selMunicipio !== "todos" &&
          a.municipio !== selMunicipio &&
          !proj.municipios.includes(selMunicipio)
        )
          return false;
        if (selCategoria !== "todos") {
          const hasTech = tecnologias.some(
            (t) => t.projetoId === a.projetoId && t.categoria === selCategoria
          );
          if (!hasTech) return false;
        }
      } else {
        // Independent action
        if (selProjeto !== "todos") return false;
        if (selFinanciador !== "todos") return false;
        if (selStatus !== "todos") return false;
        if (selCategoria !== "todos") return false;
        if (selMunicipio !== "todos" && a.municipio !== selMunicipio) return false;
      }
      return true;
    });
  }, [allAtividadesRaw, projetos, tecnologias, dataDe, dataAte, selProjeto, selFinanciador, selStatus, selMunicipio, selCategoria]);

  // ─── Filtered Technologies ──────────────────────────────────────────────────
  const filteredTecnologias = useMemo(() => {
    return tecnologias.filter((t) => {
      if (dataDe && t.data < dataDe) return false;
      if (dataAte && t.data > dataAte) return false;
      if (selProjeto !== "todos" && t.projetoId !== selProjeto) return false;
      if (selCategoria !== "todos" && t.categoria !== selCategoria) return false;
      if (selMunicipio !== "todos" && t.municipios !== selMunicipio) return false;

      if (t.projetoId) {
        const proj = projetos.find((p) => p.id === t.projetoId);
        if (!proj) return false;
        if (selFinanciador !== "todos" && proj.financiador !== selFinanciador) return false;
        if (selStatus !== "todos" && proj.status !== selStatus) return false;
      }
      return true;
    });
  }, [tecnologias, projetos, dataDe, dataAte, selProjeto, selFinanciador, selStatus, selMunicipio, selCategoria]);

  const totalTecnologiasCount = useMemo(() => {
    return filteredTecnologias.reduce((acc, t) => acc + (Number(t.quantidade) || 0), 0);
  }, [filteredTecnologias]);

  // ─── Re-calculate KPIs ──────────────────────────────────────────────────────
  const ind = useMemo(() => {
    return filteredAtividades.reduce(
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
  }, [filteredAtividades]);

  // ─── Alerts computation ────────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const list: { type: "warning" | "error"; message: string; sub?: string }[] = [];
    const nowTime = new Date().getTime();

    // 1. Expired / Expiring soon
    projetos.forEach((p) => {
      if (p.status === "Em execução" || p.status === "Planejamento") {
        const term = new Date(p.termino).getTime();
        const diffDays = Math.ceil((term - nowTime) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          list.push({
            type: "error",
            message: `Contrato expirado: ${p.nome}`,
            sub: `Venceu em ${formatDate(p.termino)} (${p.contrato})`,
          });
        } else if (diffDays <= 60) {
          list.push({
            type: "warning",
            message: `Vencimento próximo: ${p.nome}`,
            sub: `Vence em ${diffDays} dias (${formatDate(p.termino)})`,
          });
        }
      }
    });

    // 2. Parados (no activities linked in the last 45 days)
    const fortyFiveDaysAgo = new Date();
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
    const fortyFiveAgoIso = fortyFiveDaysAgo.toISOString().slice(0, 10);

    projetos.forEach((p) => {
      if (p.status === "Em execução") {
        const projectActivities = atividadesVinculadas.filter((a) => a.projetoId === p.id);
        const hasRecent = projectActivities.some((a) => a.data >= fortyFiveAgoIso);
        if (!hasRecent) {
          list.push({
            type: "warning",
            message: `Projeto parado: ${p.nome}`,
            sub: "Sem atividades vinculadas nos últimos 45 dias.",
          });
        }
      }
    });

    return list;
  }, [projetos, atividadesVinculadas]);

  // ─── Top Municipios aggregation ──────────────────────────────────────────
  const topMunicipios = useMemo(() => {
    const map: Record<string, { nome: string; projetos: number; atividades: number; total: number }> = {};

    dbMunicipios.forEach((m) => {
      map[m.nome] = { nome: m.nome, projetos: 0, atividades: 0, total: 0 };
    });

    filteredProjetos.forEach((p) => {
      p.municipios.forEach((munName) => {
        if (map[munName]) {
          map[munName].projetos += 1;
          map[munName].total += 1;
        } else {
          map[munName] = { nome: munName, projetos: 1, atividades: 0, total: 1 };
        }
      });
    });

    filteredAtividades.forEach((a) => {
      if (a.municipio) {
        const munName = a.municipio;
        if (map[munName]) {
          map[munName].atividades += 1;
          map[munName].total += 1;
        } else {
          map[munName] = { nome: munName, projetos: 0, atividades: 1, total: 1 };
        }
      }
    });

    return Object.values(map)
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [filteredProjetos, filteredAtividades, dbMunicipios]);

  // ─── Charts preparation ─────────────────────────────────────────────────────
  const projetosPorAno = useMemo(() => {
    const map: Record<string, number> = {};
    filteredProjetos.forEach((p) => {
      const ano = p.inicio?.slice(0, 4);
      if (ano) map[ano] = (map[ano] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ano, count]) => ({ ano, projetos: count }));
  }, [filteredProjetos]);

  const projetosPorFinanciador = useMemo(() => {
    const map: Record<string, number> = {};
    filteredProjetos.forEach((p) => {
      const name = p.financiador?.trim() || "Sem financiador";
      const label = name.length > 20 ? name.slice(0, 20) + "…" : name;
      map[label] = (map[label] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([financiador, count]) => ({ financiador, projetos: count }));
  }, [filteredProjetos]);

  // ─── Recent activity timeline ───────────────────────────────────────────────
  const recentAtividades = useMemo(() => {
    return [...filteredAtividades]
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 5);
  }, [filteredAtividades]);

  const kpiCards = [
    { label: "Projetos Ativos", value: filteredProjetos.filter(p => p.status === "Em execução").length, icon: FolderKanban, tone: "primary" },
    { label: "Famílias Atendidas", value: ind.participantes, icon: Users, tone: "savanna" },
    { label: "Mulheres Beneficiadas", value: ind.mulheres, icon: Heart, tone: "terracotta" },
    { label: "Jovens Atendidos", value: ind.jovens, icon: GraduationCap, tone: "ocre" },
    { label: "Comunidades", value: ind.comunidadesTradicionais, icon: MapPin, tone: "savanna" },
    { label: "Tecnologias Sociais", value: totalTecnologiasCount + ind.tecnologiasSociais, icon: Wrench, tone: "primary" },
    { label: "Público Quilombola", value: ind.quilombolas, icon: Flame, tone: "terracotta" },
    { label: "Povos Originários", value: ind.povosOriginarios, icon: Feather, tone: "ocre" },
  ];

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Visão geral dos projetos e impacto social da CHAPADA"
    >
      {/* ─── FILTROS DO DASHBOARD ────────────────────────────────────────────── */}
      <Card className="mb-6 border-border/50 bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Período:</span>
              <Input
                type="date"
                value={dataDe}
                onChange={(e) => setDataDe(e.target.value)}
                className="h-9 w-36 text-xs"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="date"
                value={dataAte}
                onChange={(e) => setDataAte(e.target.value)}
                className="h-9 w-36 text-xs"
              />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros Avançados
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-1 rounded-sm px-1.5 py-0 text-[10px]">
                      Ativo
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4 space-y-4" align="start">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Projeto</Label>
                  <Select value={selProjeto} onValueChange={setSelProjeto}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Todos os projetos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os projetos</SelectItem>
                      {projetos.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Financiador</Label>
                  <Select value={selFinanciador} onValueChange={setSelFinanciador}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Todos os financiadores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os financiadores</SelectItem>
                      {dbFinanciadores.map((f) => (
                        <SelectItem key={f.id} value={f.nome} className="text-xs">
                          {f.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Município</Label>
                  <Select value={selMunicipio} onValueChange={setSelMunicipio}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Todos os municípios" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os municípios</SelectItem>
                      {dbMunicipios.map((m) => (
                        <SelectItem key={m.id} value={m.nome} className="text-xs">
                          {m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Status do Projeto</Label>
                  <Select value={selStatus} onValueChange={setSelStatus}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os status</SelectItem>
                      <SelectItem value="Planejamento" className="text-xs">Planejamento</SelectItem>
                      <SelectItem value="Em execução" className="text-xs">Em execução</SelectItem>
                      <SelectItem value="Concluído" className="text-xs">Concluído</SelectItem>
                      <SelectItem value="Suspenso" className="text-xs">Suspenso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Categoria de Tecnologia</Label>
                  <Select value={selCategoria} onValueChange={setSelCategoria}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Todas as categorias" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas as categorias</SelectItem>
                      {Object.entries(CATEGORIAS).map(([key, cat]) => (
                        <SelectItem key={key} value={key} className="text-xs">
                          {cat.emoji} {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-xs">
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </Button>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((k) => {
          const Icon = k.icon;
          return (
            <Card
              key={k.label}
              className="border-border/60 border-t-4 border-t-primary hover:shadow-[var(--shadow-soft)] transition-shadow"
            >
              <CardContent className="p-4 md:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                      {k.label}
                    </div>
                    <div className="mt-2 text-2xl md:text-3xl font-display font-semibold">
                      {k.value.toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <div
                    className={`h-10 w-10 rounded-xl grid place-items-center ${toneClass[k.tone] || "bg-accent"}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Charts & Side Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Left/Middle Column (Charts and activities) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Projetos por Ano</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {projetosPorAno.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    Sem registros para os filtros atuais.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={projetosPorAno}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.025 75)" />
                      <XAxis dataKey="ano" stroke="oklch(0.5 0.03 60)" fontSize={12} />
                      <YAxis stroke="oklch(0.5 0.03 60)" fontSize={12} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "oklch(1 0 0)",
                          border: "1px solid oklch(0.88 0.025 75)",
                          borderRadius: "8px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="projetos"
                        stroke="oklch(0.6 0.16 40)"
                        strokeWidth={3}
                        dot={{ fill: "oklch(0.6 0.16 40)", r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por Financiador</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {projetosPorFinanciador.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    Sem registros para os filtros atuais.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={projetosPorFinanciador} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.025 75)" />
                      <XAxis type="number" stroke="oklch(0.5 0.03 60)" fontSize={12} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="financiador"
                        stroke="oklch(0.5 0.03 60)"
                        fontSize={11}
                        width={90}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "oklch(1 0 0)",
                          border: "1px solid oklch(0.88 0.025 75)",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="projetos" fill="oklch(0.5 0.1 145)" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Unified Recent activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Atividades Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {recentAtividades.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhuma atividade recente encontrada com os filtros aplicados.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {recentAtividades.map((a) => {
                    const projeto = projetos.find((p) => p.id === a.projetoId);
                    return (
                      <li key={a.id} className="py-4 flex items-start gap-4">
                        <div className="h-10 w-10 rounded-lg bg-accent grid place-items-center shrink-0">
                          <span className="text-xs font-semibold text-accent-foreground">
                            {a.tipo.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {projeto ? (
                              <Badge className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 font-medium text-[10px]">
                                {projeto.nome}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] font-medium">
                                Ação Independente
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px]">
                              {a.tipo}
                            </Badge>
                          </div>
                          <div className="mt-1.5">
                            {a.titulo && (
                              <h5 className="font-semibold text-sm leading-snug">{a.titulo}</h5>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">{a.descricao}</p>
                          </div>
                          <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-3">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(a.data)}
                            </span>
                            {a.municipio && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {a.municipio} {a.local ? `— ${a.local}` : ""}
                              </span>
                            )}
                            {a.responsaveis && <span>· Resp: {a.responsaveis}</span>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (Alertas & Top Municipios) */}
        <div className="space-y-6">
          {/* Alerts Panel */}
          <Card className="border-t-4 border-t-terracotta">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-terracotta" />
                Alertas do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Tudo em dia! Sem alertas ativos no momento.
                </p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {alerts.map((al, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border text-xs flex gap-2.5 items-start ${
                        al.type === "error"
                          ? "bg-destructive/5 border-destructive/20 text-destructive"
                          : "bg-terracotta/5 border-terracotta/20 text-terracotta-foreground"
                      }`}
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold">{al.message}</div>
                        {al.sub && <div className="text-[10px] opacity-80 mt-0.5">{al.sub}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Municipios Panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-savanna" />
                Top Municípios
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topMunicipios.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">
                  Sem municípios / Sem registros para os filtros atuais.
                </p>
              ) : (
                <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                  {topMunicipios.map((m) => (
                    <div key={m.nome} className="flex justify-between items-center text-xs">
                      <div className="space-y-0.5">
                        <div className="font-semibold">{m.nome}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {m.projetos} projeto(s) · {m.atividades} atividade(s)
                        </div>
                      </div>
                      <Badge variant="secondary" className="font-bold text-[10px] px-2 py-0.5 rounded-full">
                        {m.total} pts
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
