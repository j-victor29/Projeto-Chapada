import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet } from "lucide-react";
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

export const Route = createFileRoute("/indicadores")({
  head: () => ({ meta: [{ title: "Indicadores — CHAPADA" }] }),
  component: IndicadoresPage,
});

const baselines = {
  Mulheres: 640,
  Jovens: 380,
  Quilombolas: 180,
  "Povos Originários": 95,
  "Comunidades Tradicionais": 220,
};

const porMunicipio = [
  { name: "Araripina", value: 320 },
  { name: "Ouricuri", value: 240 },
  { name: "Trindade", value: 180 },
  { name: "Bodocó", value: 150 },
  { name: "Outros", value: 230 },
];

const COLORS = [
  "oklch(0.6 0.16 40)",
  "oklch(0.5 0.1 145)",
  "oklch(0.72 0.13 75)",
  "oklch(0.45 0.07 50)",
  "oklch(0.65 0.12 110)",
];

async function chartToPng(node: HTMLElement | null): Promise<string | null> {
  if (!node) return null;
  const svg = node.querySelector("svg");
  if (!svg) return null;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const w = svg.clientWidth || 500;
  const h = svg.clientHeight || 320;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const xml = new XMLSerializer().serializeToString(clone);
  const svg64 = btoa(unescape(encodeURIComponent(xml)));
  const img = new Image();
  img.src = `data:image/svg+xml;base64,${svg64}`;
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
  const canvas = document.createElement("canvas");
  canvas.width = w * 2; canvas.height = h * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

import { useAtividadesIndicadores } from "@/lib/atividadesStore";

function IndicadoresPage() {
  const barRef = useRef<HTMLDivElement>(null);
  const pieRef = useRef<HTMLDivElement>(null);
  
  const ind = useAtividadesIndicadores();

  const beneficiarios = [
    { grupo: "Mulheres", total: baselines.Mulheres + ind.mulheres },
    { grupo: "Jovens", total: baselines.Jovens + ind.jovens },
    { grupo: "Quilombolas", total: baselines.Quilombolas + ind.quilombolas },
    { grupo: "Povos Originários", total: baselines["Povos Originários"] + ind.povosOriginarios },
    { grupo: "Comunidades Tradicionais", total: baselines["Comunidades Tradicionais"] + ind.comunidadesTradicionais },
  ];

  const totalBeneficiarios = beneficiarios.reduce((a, b) => a + b.total, 0);

  const exportPDF = async () => {
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const dateStr = new Date().toLocaleDateString("pt-BR");

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de Indicadores - CHAPADA", pageW / 2, 50, { align: "center" });
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${dateStr}`, pageW / 2, 70, { align: "center" });

      let y = 100;
      const barPng = await chartToPng(barRef.current);
      if (barPng) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Beneficiários por Grupo", 40, y);
        y += 10;
        doc.addImage(barPng, "PNG", 40, y, pageW - 80, 220);
        y += 240;
      }

      const piePng = await chartToPng(pieRef.current);
      if (piePng) {
        if (y > 600) { doc.addPage(); y = 50; }
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Distribuição por Município", 40, y);
        y += 10;
        doc.addImage(piePng, "PNG", 40, y, pageW - 80, 220);
        y += 240;
      }

      if (y > 650) { doc.addPage(); y = 50; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo Consolidado", 40, y);
      autoTable(doc, {
        startY: y + 10,
        head: [["Grupo", "Total"]],
        body: [
          ...beneficiarios.map((b) => [b.grupo, b.total.toLocaleString("pt-BR")]),
          ["TOTAL", totalBeneficiarios.toLocaleString("pt-BR")],
        ],
        theme: "striped",
        headStyles: { fillColor: [26, 159, 212] },
      });

      doc.save(`Relatorio-Indicadores-CHAPADA-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF exportado.");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar PDF.");
    }
  };

  const exportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const s1 = XLSX.utils.json_to_sheet(beneficiarios.map((b) => ({ Grupo: b.grupo, Total: b.total })));
      XLSX.utils.book_append_sheet(wb, s1, "Beneficiários por Grupo");
      const s2 = XLSX.utils.json_to_sheet(porMunicipio.map((m) => ({ Município: m.name, Total: m.value })));
      XLSX.utils.book_append_sheet(wb, s2, "Distribuição por Município");
      const s3 = XLSX.utils.json_to_sheet([
        ...beneficiarios.map((b) => ({ Indicador: b.grupo, Valor: b.total })),
        { Indicador: "TOTAL", Valor: totalBeneficiarios },
        { Indicador: "Data de Geração", Valor: new Date().toLocaleDateString("pt-BR") },
      ]);
      XLSX.utils.book_append_sheet(wb, s3, "Resumo Consolidado");
      XLSX.writeFile(wb, `Relatorio-Indicadores-CHAPADA-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Planilha exportada.");
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
          <Button variant="outline" className="gap-2" onClick={exportPDF}>
            <FileDown className="h-4 w-4" /> Exportar PDF
          </Button>
          <Button className="gap-2" onClick={exportExcel}>
            <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Beneficiários por Grupo</CardTitle></CardHeader>
          <CardContent className="h-80" ref={barRef}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={beneficiarios}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.025 75)" />
                <XAxis dataKey="grupo" stroke="oklch(0.5 0.03 60)" fontSize={11} />
                <YAxis stroke="oklch(0.5 0.03 60)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "oklch(1 0 0)", border: "1px solid oklch(0.88 0.025 75)", borderRadius: "8px" }} />
                <Bar dataKey="total" fill="oklch(0.6 0.16 40)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por Município</CardTitle></CardHeader>
          <CardContent className="h-80" ref={pieRef}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={porMunicipio} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {porMunicipio.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Resumo Consolidado</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {beneficiarios.map((b) => (
              <div key={b.grupo} className="text-center p-4 bg-muted/40 rounded-lg">
                <div className="text-2xl font-display font-semibold text-primary">{b.total}</div>
                <div className="text-xs text-muted-foreground mt-1">{b.grupo}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
