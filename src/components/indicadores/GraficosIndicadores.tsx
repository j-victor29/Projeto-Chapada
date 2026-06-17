import { BarChart3 } from "lucide-react";
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { coresPDF } from "@/lib/exportColors";

export interface BeneficiarioGrupoChart {
  grupo: string;
  total: number;
}

export interface AtividadeMesChart {
  mes: string;
  atividades: number;
  acoesIndependentes: number;
}

export interface MunicipioAtividadeChart {
  municipio: string;
  atividades: number;
}

export interface ParticipantesAcumuladoChart {
  periodo: string;
  participantes: number;
}

interface GraficosIndicadoresProps {
  beneficiarios: BeneficiarioGrupoChart[];
  atividadesPorMes: AtividadeMesChart[];
  municipiosPorAtividade: MunicipioAtividadeChart[];
  participantesAcumulados: ParticipantesAcumuladoChart[];
}

const chartColors = [
  coresPDF.chart1,
  coresPDF.chart2,
  coresPDF.chart3,
  coresPDF.chart4,
  coresPDF.chart5,
  coresPDF.subtitulo,
];

function GraficoCard({
  title,
  isEmpty,
  children,
}: {
  title: string;
  isEmpty: boolean;
  children: ReactNode;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <BarChart3 className="h-9 w-9 opacity-30" />
            <span>Nenhum dado registrado para este período</span>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function GraficosIndicadores({
  beneficiarios,
  atividadesPorMes,
  municipiosPorAtividade,
  participantesAcumulados,
}: GraficosIndicadoresProps) {
  const beneficiariosComDados = beneficiarios.filter((item) => item.total > 0);
  const mesesComDados = atividadesPorMes.filter(
    (item) => item.atividades > 0 || item.acoesIndependentes > 0
  );
  const municipiosTop10 = municipiosPorAtividade
    .filter((item) => item.atividades > 0)
    .sort((a, b) => b.atividades - a.atividades)
    .slice(0, 10);
  const acumuladoComDados = participantesAcumulados.filter((item) => item.participantes > 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <GraficoCard
        title="Beneficiários por grupo"
        isEmpty={beneficiariosComDados.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={beneficiariosComDados}
              dataKey="total"
              nameKey="grupo"
              cx="50%"
              cy="48%"
              outerRadius={92}
              label={({ percent }) =>
                percent && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ""
              }
            >
              {beneficiariosComDados.map((item, index) => (
                <Cell key={item.grupo} fill={chartColors[index % chartColors.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => value.toLocaleString("pt-BR")} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </GraficoCard>

      <GraficoCard title="Atividades por mês" isEmpty={mesesComDados.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={mesesComDados} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={coresPDF.borda} />
            <XAxis dataKey="mes" fontSize={11} stroke={coresPDF.textoSecundario} />
            <YAxis allowDecimals={false} fontSize={11} stroke={coresPDF.textoSecundario} />
            <Tooltip formatter={(value: number) => value.toLocaleString("pt-BR")} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="atividades" name="Atividades" fill={coresPDF.chart1} radius={[6, 6, 0, 0]} />
            <Bar
              dataKey="acoesIndependentes"
              name="Ações Independentes"
              fill={coresPDF.chart3}
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </GraficoCard>

      <GraficoCard
        title="Top 10 municípios por atividade"
        isEmpty={municipiosTop10.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={municipiosTop10}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 24, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={coresPDF.borda} />
            <XAxis type="number" allowDecimals={false} fontSize={11} stroke={coresPDF.textoSecundario} />
            <YAxis
              type="category"
              dataKey="municipio"
              width={110}
              fontSize={11}
              stroke={coresPDF.textoSecundario}
            />
            <Tooltip formatter={(value: number) => value.toLocaleString("pt-BR")} />
            <Bar dataKey="atividades" name="Atividades" fill={coresPDF.chart2} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </GraficoCard>

      <GraficoCard
        title="Evolução acumulada de participantes"
        isEmpty={acumuladoComDados.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={acumuladoComDados} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
            <defs>
              <linearGradient id="participantesFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor={coresPDF.chart1} stopOpacity={0.35} />
                <stop offset="95%" stopColor={coresPDF.chart1} stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={coresPDF.borda} />
            <XAxis dataKey="periodo" fontSize={11} stroke={coresPDF.textoSecundario} />
            <YAxis allowDecimals={false} fontSize={11} stroke={coresPDF.textoSecundario} />
            <Tooltip formatter={(value: number) => value.toLocaleString("pt-BR")} />
            <Area
              type="monotone"
              dataKey="participantes"
              name="Participantes acumulados"
              stroke={coresPDF.chart1}
              strokeWidth={2.5}
              fill="url(#participantesFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </GraficoCard>
    </div>
  );
}
