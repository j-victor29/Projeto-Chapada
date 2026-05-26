import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ShieldAlert, Search, RefreshCw, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/mockData";
import { toast } from "sonner";

export const Route = createFileRoute("/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria — CHAPADA" },
      { name: "description", content: "Logs de alterações e auditoria do sistema." },
    ],
  }),
  component: AuditoriaPage,
});

interface AuditLog {
  id: string;
  usuario_id: string | null;
  acao: "INSERT" | "UPDATE" | "DELETE";
  tabela: string;
  registro_id: string;
  detalhes: Record<string, unknown> | null;
  timestamp: string;
  usuario_email?: string;
}

const ACAO_COLORS: Record<string, string> = {
  INSERT: "bg-savanna/15 text-savanna border-savanna/30",
  UPDATE: "bg-primary/10 text-primary border-primary/30",
  DELETE: "bg-destructive/15 text-destructive border-destructive/30",
};

const TABELAS = [
  "projetos",
  "atividades",
  "tecnologias_sociais",
  "arquivos_midia",
  "beneficiarios",
  "projeto_tecnologias",
];

function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [fTabela, setFTabela] = useState("todos");
  const [fAcao, setFAcao] = useState("todos");
  const [viewing, setViewing] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("auditoria")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(300);

      if (error) throw error;

      // Enriquecer com email do usuário se possível
      const enriched = (data ?? []).map((row: any) => ({
        id: row.id,
        usuario_id: row.usuario_id,
        acao: row.acao as AuditLog["acao"],
        tabela: row.tabela,
        registro_id: row.registro_id,
        detalhes: row.detalhes,
        timestamp: row.timestamp,
      })) as AuditLog[];

      setLogs(enriched);
    } catch (e: any) {
      if (e?.code === "PGRST116" || e?.message?.includes("does not exist")) {
        toast.info("Tabela de auditoria ainda não foi criada. Execute a migration no Supabase.");
      } else {
        toast.error("Erro ao carregar logs: " + e?.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (fTabela !== "todos" && l.tabela !== fTabela) return false;
      if (fAcao !== "todos" && l.acao !== fAcao) return false;
      if (search && ![l.tabela, l.acao, l.registro_id, l.usuario_id ?? ""]
        .join(" ").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [logs, fTabela, fAcao, search]);

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
    } catch {
      return ts;
    }
  };

  return (
    <AppLayout
      title="Auditoria"
      subtitle="Registro de todas as alterações realizadas no sistema"
      actions={
        <Button variant="outline" className="gap-2" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      }
    >
      {/* Filtros */}
      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por tabela, ID, usuário..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={fTabela} onValueChange={setFTabela}>
            <SelectTrigger>
              <SelectValue placeholder="Tabela" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as tabelas</SelectItem>
              {TABELAS?.filter(t => t && String(t).trim() !== "").map((t) => (
                <SelectItem key={t} value={String(t)}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fAcao} onValueChange={setFAcao}>
            <SelectTrigger>
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as ações</SelectItem>
              <SelectItem value="INSERT">INSERT</SelectItem>
              <SelectItem value="UPDATE">UPDATE</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Tabela de Logs */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data / Hora</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Tabela</TableHead>
                <TableHead>Registro ID</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead className="text-right">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                    <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin" />
                    Carregando logs...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                    <ShieldAlert className="h-10 w-10 mx-auto mb-3 text-muted" />
                    {logs.length === 0
                      ? "Nenhum log de auditoria encontrado. Certifique-se que a migration foi aplicada."
                      : "Nenhum log encontrado com os filtros selecionados."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] border font-medium ${ACAO_COLORS[log.acao] ?? ""}`}>
                        {log.acao}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {log.tabela}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground max-w-[140px] truncate">
                      {log.registro_id}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.usuario_id
                        ? <span className="font-mono">{log.usuario_id.slice(0, 8)}…</span>
                        : <span className="italic">Sistema</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon" variant="ghost"
                        onClick={() => setViewing(log)}
                        title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs border ${ACAO_COLORS[viewing?.acao ?? ""] ?? ""}`}>
                {viewing?.acao}
              </span>
              <span className="font-mono text-sm">{viewing?.tabela}</span>
            </DialogTitle>
            <DialogDescription>
              {viewing && formatTimestamp(viewing.timestamp)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground font-medium">ID do Registro:</span>{" "}
              <code className="bg-muted px-2 py-0.5 rounded text-xs">{viewing?.registro_id}</code>
            </div>
            {viewing?.usuario_id && (
              <div>
                <span className="text-muted-foreground font-medium">Usuário ID:</span>{" "}
                <code className="bg-muted px-2 py-0.5 rounded text-xs">{viewing.usuario_id}</code>
              </div>
            )}
            {viewing?.detalhes && (
              <div>
                <p className="text-muted-foreground font-medium mb-2">Payload JSON:</p>
                <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto leading-relaxed">
                  {JSON.stringify(viewing.detalhes, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
