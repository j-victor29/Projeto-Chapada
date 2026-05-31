import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, RefreshCw, Send } from "lucide-react";
import { useGlobalSearch } from "@/contexts/SearchContext";
import { addNotification } from "@/lib/notificationsStore";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile, fullName } from "@/lib/profileStore";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/usuarios")({
  component: UsuariosPage,
});


interface UsuarioRow {
  id: string;
  email: string;
  nome_completo: string | null;
  role: string | null;
  cargo: string | null;
  updated_at: string | null;
}

const formatLastUpdate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const roleLabel: Record<string, string> = {
  admin: "Admin",
  editor: "Editor",
  visualizador: "Visualizador",
};

function UsuariosPage() {
  const { query } = useGlobalSearch();
  const { user } = useAuth();
  const profile = useProfile(user?.email ?? "");
  const senderName = fullName(profile, user?.email?.split("@")[0] ?? "Usuário");

  const [recipient, setRecipient] = useState<UsuarioRow | null>(null);
  const [message, setMessage] = useState("");

  // ── Fetch real profiles from Supabase ────────────────────────────────────
  const {
    data: usuarios = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<UsuarioRow[]>({
    queryKey: ["profiles_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, nome_completo, role, cargo, updated_at")
        .order("nome_completo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any as UsuarioRow[];
    },
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) =>
      [u.nome_completo ?? "", u.email].join(" ").toLowerCase().includes(q)
    );
  }, [query, usuarios]);

  const sendMessage = () => {
    if (!recipient) return;
    const text = message.trim();
    if (!text) {
      toast.error("Digite uma mensagem.");
      return;
    }
    addNotification({
      type: "mensagem",
      title: `📩 ${senderName} enviou uma mensagem`,
      body: text.slice(0, 140),
      from: senderName,
    });
    toast.success(`Mensagem enviada para ${recipient.nome_completo ?? recipient.email}.`);
    setRecipient(null);
    setMessage("");
  };

  return (
    <AppLayout
      title="Controle de Usuários"
      subtitle="Equipe e contatos do sistema CHAPADA"
      actions={
        <Button variant="outline" className="gap-2" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      }
    >
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Última atualização</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                    <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin" />
                    Carregando usuários...
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-destructive">
                    Erro ao carregar usuários. Verifique as permissões de RLS na tabela profiles.
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => {
                  const displayName = u.nome_completo?.trim() || u.email.split("@")[0];
                  const initials = displayName
                    .split(" ")
                    .map((n: string) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{displayName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.cargo ?? <span className="italic text-muted-foreground/60">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatLastUpdate(u.updated_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {roleLabel[u.role ?? ""] ?? u.role ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => {
                            setRecipient(u);
                            setMessage("");
                          }}
                        >
                          <MessageSquare className="h-4 w-4" /> Enviar mensagem
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!recipient} onOpenChange={(o) => !o && setRecipient(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar mensagem</DialogTitle>
            <DialogDescription>
              Para: <strong>{recipient?.nome_completo ?? recipient?.email}</strong>
              <br />
              <span className="text-xs text-muted-foreground">{recipient?.email}</span>
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            rows={5}
            maxLength={500}
          />
          <p className="text-[11px] text-muted-foreground text-right">{message.length}/500</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecipient(null)}>
              Cancelar
            </Button>
            <Button onClick={sendMessage} className="gap-2">
              <Send className="h-4 w-4" /> Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
