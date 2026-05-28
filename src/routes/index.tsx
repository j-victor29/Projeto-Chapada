import { createFileRoute } from "@tanstack/react-router";
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
import { useProjetos } from "@/lib/projetosStore";
import { useTotalTecnologias } from "@/lib/tecnologiasStore";
import { useAtividades, useAtividadesIndicadores } from "@/lib/atividadesStore";
import { formatDate } from "@/lib/mockData";
import { useMemo } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — CHAPADA" },
      { name: "description", content: "Visão geral dos projetos e indicadores da CHAPADA." },
    ],
  }),
  component: Dashboard,
});

const toneClass: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  savanna: "bg-savanna/15 text-savanna",
  terracotta: "bg-terracotta/15 text-terracotta",
  ocre: "bg-ocre/20 text-ocre-foreground",
};

function Dashboard() {
  const projetos = useProjetos();
  const totalTecnologias = useTotalTecnologias();
  const atividades = useAtividades();
  const ind = useAtividadesIndicadores();

  // ── KPI derived from real data ────────────────────────────────────────────
  const projetosAtivos = useMemo(
    () => projetos.filter((p) => p.status === "Em execução").length,
    [projetos]
  );

  // ── Projetos por Ano (group by year of inicio) ────────────────────────────
  const projetosPorAno = useMemo(() => {
    const map: Record<string, number> = {};
    projetos.forEach((p) => {
      const ano = p.inicio?.slice(0, 4);
      if (ano) map[ano] = (map[ano] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ano, count]) => ({ ano, projetos: count }));
  }, [projetos]);

  // ── Projetos por Financiador ───────────────────────────────────────────────
  const projetosPorFinanciador = useMemo(() => {
    const map: Record<string, number> = {};
    projetos.forEach((p) => {
      const name = p.financiador?.trim() || "Sem financiador";
      // Abbreviate long names
      const label = name.length > 20 ? name.slice(0, 20) + "…" : name;
      map[label] = (map[label] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([financiador, count]) => ({ financiador, projetos: count }));
  }, [projetos]);

  // ── Atividades recentes (last 5 by date) ──────────────────────────────────
  const recentAtividades = useMemo(() => atividades.slice(0, 5), [atividades]);

  const kpiCards = [
    { label: "Projetos Ativos", value: projetosAtivos, icon: FolderKanban, tone: "primary" },
    { label: "Famílias Atendidas", value: ind.participantes, icon: Users, tone: "savanna" },
    { label: "Mulheres Beneficiadas", value: ind.mulheres, icon: Heart, tone: "terracotta" },
    { label: "Jovens Atendidos", value: ind.jovens, icon: GraduationCap, tone: "ocre" },
    { label: "Comunidades", value: ind.comunidadesTradicionais, icon: MapPin, tone: "savanna" },
    { label: "Tecnologias Sociais", value: totalTecnologias + ind.tecnologiasSociais, icon: Wrench, tone: "primary" },
    { label: "Público Quilombola", value: ind.quilombolas, icon: Flame, tone: "terracotta" },
    { label: "Povos Originários", value: ind.povosOriginarios, icon: Feather, tone: "ocre" },
  ];

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Visão geral dos projetos e impacto social da CHAPADA"
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((k) => {
          const Icon = k.icon;
          return (
            <Card
              key={k.label}
              className="border-border/60 border-t-4 border-t-ocre hover:shadow-[var(--shadow-soft)] transition-shadow"
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
                    className={`h-10 w-10 rounded-xl grid place-items-center ${toneClass[k.tone]}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Projetos por Ano</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {projetosPorAno.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Nenhum projeto cadastrado ainda.
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
          <CardContent className="h-72">
            {projetosPorFinanciador.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Nenhum financiador cadastrado ainda.
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

      {/* Recent activity */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Atividades Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAtividades.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma atividade registrada ainda.
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
                        <span className="text-sm font-medium">{projeto?.nome ?? "—"}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {a.tipo}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{a.descricao}</p>
                      <div className="text-xs text-muted-foreground mt-1.5 flex flex-wrap gap-3">
                        <span>{formatDate(a.data)}</span>
                        {a.local && <span>· {a.local}</span>}
                        {a.responsaveis && <span>· {a.responsaveis}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
