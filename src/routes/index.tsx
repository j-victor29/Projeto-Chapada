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
import {
  kpis,
  projetosPorAno,
  projetosPorFinanciador,
  formatDate,
} from "@/lib/mockData";
import { Badge } from "@/components/ui/badge";
import { useProjetos } from "@/lib/projetosStore";
import { useTotalTecnologias } from "@/lib/tecnologiasStore";
import { useAtividades, useAtividadesIndicadores } from "@/lib/atividadesStore";

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
  const kpiCards = [
    { label: "Projetos Ativos", value: kpis.projetosAtivos, icon: FolderKanban, tone: "primary" },
    { label: "Famílias Atendidas", value: kpis.familias + ind.participantes, icon: Users, tone: "savanna" },
    { label: "Mulheres Beneficiadas", value: kpis.mulheres + ind.mulheres, icon: Heart, tone: "terracotta" },
    { label: "Jovens Atendidos", value: kpis.jovens + ind.jovens, icon: GraduationCap, tone: "ocre" },
    { label: "Comunidades", value: kpis.comunidades + ind.comunidadesTradicionais, icon: MapPin, tone: "savanna" },
    { label: "Tecnologias Sociais", value: totalTecnologias + ind.tecnologiasSociais, icon: Wrench, tone: "primary" },
    { label: "Público Quilombola", value: kpis.quilombolas + ind.quilombolas, icon: Flame, tone: "terracotta" },
    { label: "Povos Originários", value: kpis.povosOriginarios + ind.povosOriginarios, icon: Feather, tone: "ocre" },
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
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projetosPorAno}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.025 75)" />
                <XAxis dataKey="ano" stroke="oklch(0.5 0.03 60)" fontSize={12} />
                <YAxis stroke="oklch(0.5 0.03 60)" fontSize={12} />
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por Financiador</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projetosPorFinanciador} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.025 75)" />
                <XAxis type="number" stroke="oklch(0.5 0.03 60)" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="financiador"
                  stroke="oklch(0.5 0.03 60)"
                  fontSize={11}
                  width={80}
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
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Atividades Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {atividades.slice(0, 10).map((a) => {
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
                      <span className="text-sm font-medium">{projeto?.nome}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {a.tipo}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{a.descricao}</p>
                    <div className="text-xs text-muted-foreground mt-1.5 flex flex-wrap gap-3">
                      <span>{formatDate(a.data)}</span>
                      <span>· {a.local}</span>
                      <span>· {a.responsaveis}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
