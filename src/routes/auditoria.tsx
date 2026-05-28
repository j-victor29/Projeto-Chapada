import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, keepPreviousData } from "@tanstack/react-query";

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
  usuario_email: string | null;
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
  "financiadores",
  "municipios",
  "comunidades",
];

const PAGE_SIZE = 30;

function AuditoriaPage() {
  const [search, setSearch] = useState("");
  const [fTabela, setFTabela] = useState("todos");
  const [fAcao, setFAcao] = useState("todos");
  const [page, setPage] = useState(0);
  const [viewing, setViewing] = useState<AuditLog | null>(null);

  // ── Server-side paginated query with filters applied in Supabase ─────────
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["auditoria_logs", fTabela, fAcao, page],
    queryFn: async () => {
      let q = supabase
        .from("auditoria")
        .select("id, usuario_id, acao, tabela, registro_id, detalhes, timestamp", { count: "exact" })
        .order("timestamp", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (fTabela !== "todos") q = q.eq("tabela", fTabela);
      if (fAcao !== "todos") q = q.eq("acao", fAcao);

      const { data: rows, error, count } = await q;

      if (error) {
        if (error.code === "PGRST116" || error.message?.includes("does not exist")) {
          toast.info("Tabela de auditoria ainda não foi criada. Execute a migration no Supabase.");
          return { logs: [] as AuditLog[], total: 0 };
        }
        throw error;
      }

      // Enrich with profile emails via separate query on profiles
      const userIds = [...new Set((rows ?? []).map((r: any) => r.usuario_id).filter(Boolean))];
      let emailMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", userIds);
        (profiles ?? []).forEach((p: any) => {
          emailMap[p.id] = p.email;
        });
      }

      const logs: AuditLog[] = (rows ?? []).map((row: any) => ({
        id: row.id,
        usuario_id: row.usuario_id,
        acao: row.acao as AuditLog["acao"],
        tabela: row.tabela,
        registro_id: row.registro_id,
        detalhes: row.detalhes,
        timestamp: row.timestamp,
        usuario_email: row.usuario_id ? (emailMap[row.usuario_id] ?? null) : null,
      }));

      return { logs, total: count ?? 0 };
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Client-side text search within fetched page
  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter((l) =>
      [l.tabela, l.acao, l.registro_id, l.usuario_email ?? "", l.usuario_id ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [logs, search]);

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return ts;
    }
  };

  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(0); // reset to first page on filter change
  };

  return (
    <AppLayout
      title="Auditoria"
      subtitle="Registro de todas as alterações realizadas no sistema"
      actions={
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
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
              placeholder="Buscar por tabela, e-mail, ID..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={fTabela} onValueChange={handleFilterChange(setFTabela)}>
            <SelectTrigger>
              <SelectValue placeholder="Tabela" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as tabelas</SelectItem>
              {TABELAS.filter((t) => t && String(t).trim() !== "").map((t) => (
                <SelectItem key={t} value={String(t)}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fAcao} onValueChange={handleFilterChange(setFAcao)}>
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                    <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin" />
                    Carregando logs...
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-destructive">
                    Erro ao carregar logs de auditoria.
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
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] border font-medium ${
                          ACAO_COLORS[log.acao] ?? ""
                        }`}
                      >
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
                      {log.usuario_email ? (
                        <span>{log.usuario_email}</span>
                      ) : log.usuario_id ? (
                        <span className="font-mono">{log.usuario_id.slice(0, 8)}…</span>
                      ) : (
                        <span className="italic">Sistema</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
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

        {/* Paginação */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm text-muted-foreground">
          <span>
            {total > 0
              ? `Mostrando ${page * PAGE_SIZE + 1}–${Math.min(
                  (page + 1) * PAGE_SIZE,
                  total
                )} de ${total} registro(s)`
              : "Nenhum registro"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              disabled={page === 0 || isFetching}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs">
              Pág. {page + 1} / {totalPages}
            </span>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              disabled={page >= totalPages - 1 || isFetching}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Modal de Detalhes */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-xs border ${
                  ACAO_COLORS[viewing?.acao ?? ""] ?? ""
                }`}
              >
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
            {viewing?.usuario_email && (
              <div>
                <span className="text-muted-foreground font-medium">Usuário:</span>{" "}
                <code className="bg-muted px-2 py-0.5 rounded text-xs">{viewing.usuario_email}</code>
              </div>
            )}
            {viewing?.usuario_id && !viewing.usuario_email && (
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
