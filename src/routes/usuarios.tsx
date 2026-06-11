import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Loader2, MessageSquare, RefreshCw, Send, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useGlobalSearch } from "@/contexts/SearchContext";
import { addNotification } from "@/lib/notificationsStore";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile, fullName } from "@/lib/profileStore";
import { trimText, toTitleCase } from "@/utils/sanitize";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserPresence, type UserStatus } from "@/hooks/useUserPresence";

export const Route = createFileRoute("/usuarios")({
  component: UsuariosPage,
});

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface UsuarioRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  cargo: string | null;
  updated_at: string | null;
  last_seen: string | null;
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

/**
 * Formata o campo "Visto por último" com base no status e no last_seen.
 * - Online/Inativo → "Agora"
 * - Offline mesmo dia → "Hoje às HH:mm"
 * - Dia anterior → "Ontem às HH:mm"
 * - Mais antigo → "Há X dias" ou "DD/MM/AAAA"
 */
function formatLastSeen(lastSeen: string | null, status: UserStatus): string {
  if (status === "online" || status === "inactive") return "Agora";
  if (!lastSeen) return "—";

  const date = new Date(lastSeen);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);
  const diffDays = Math.floor(
    (startOfToday.getTime() - date.getTime()) / 86_400_000
  );

  const timeStr = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (date >= startOfToday) {
    return `Hoje às ${timeStr}`;
  }
  if (date >= startOfYesterday) {
    return `Ontem às ${timeStr}`;
  }
  if (diffDays <= 30) {
    return `Há ${diffDays} dia${diffDays !== 1 ? "s" : ""}`;
  }
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─── Componentes ──────────────────────────────────────────────────────────────

/** Bolinha de status colorida */
function StatusDot({ status }: { status: UserStatus }) {
  const colorMap: Record<UserStatus, string> = {
    online: "bg-green-500",
    inactive: "bg-amber-500",
    offline: "bg-slate-400",
  };
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ring-2 ring-background flex-shrink-0 ${colorMap[status]}`}
      aria-hidden="true"
    />
  );
}

/** Badge de status textual com bolinha */
function StatusBadge({ status }: { status: UserStatus }) {
  const labelMap: Record<UserStatus, string> = {
    online: "Online",
    inactive: "Inativo",
    offline: "Offline",
  };
  return (
    <div className="flex items-center gap-2">
      <StatusDot status={status} />
      <span className="text-sm text-muted-foreground">{labelMap[status]}</span>
    </div>
  );
}

/** Avatar com bolinha de presença sobreposta no canto inferior direito */
function PresenceAvatar({
  initials,
  status,
}: {
  initials: string;
  status: UserStatus;
}) {
  return (
    <div className="relative flex-shrink-0">
      <Avatar className="h-9 w-9">
        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
          {initials}
        </AvatarFallback>
      </Avatar>
      {/* Bolinha de status sobreposta */}
      <span
        className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-background"
        style={{
          backgroundColor:
            status === "online"
              ? "rgb(34 197 94)"       // green-500
              : status === "inactive"
                ? "rgb(245 158 11)"      // amber-500
                : "rgb(148 163 184)",    // slate-400
        }}
        aria-hidden="true"
      />
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function UsuariosPage() {
  const { query } = useGlobalSearch();
  const { user } = useAuth();
  const profile = useProfile(user?.email ?? "");
  const senderName = fullName(profile, user?.email?.split("@")[0] ?? "Usuário");

  const [recipient, setRecipient] = useState<UsuarioRow | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // States for user profile editing
  const [editingUsuario, setEditingUsuario] = useState<UsuarioRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editCargo, setEditCargo] = useState("");
  const [savingUsuario, setSavingUsuario] = useState(false);
  const queryClient = useQueryClient();

  // ── Presença em tempo real ────────────────────────────────────────────────
  const { getStatusOf } = useUserPresence();

  // ── Fetch de perfis do Supabase ───────────────────────────────────────────
  const {
    data: usuarios = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<UsuarioRow[]>({
    queryKey: ["profiles_list"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, cargo, updated_at, last_seen")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as UsuarioRow[];
    },
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) =>
      [u.full_name ?? "", u.email].join(" ").toLowerCase().includes(q)
    );
  }, [query, usuarios]);

  const sendMessage = async () => {
    if (!recipient || !user?.id) return;
    const text = message.trim();
    if (!text) {
      toast.error("Digite uma mensagem.");
      return;
    }
    setSending(true);
    try {
      const titulo = `Nova mensagem de ${senderName}`;
      const { error } = await supabase.from("notificacoes").insert({
        usuario_id: recipient.id,
        remetente_id: user.id,
        titulo,
        mensagem: text,
        tipo: "mensagem",
        remetente: senderName,
        lida: false,
      });
      if (error) throw error;

      // Notifica o remetente localmente tb (echo local)
      addNotification({
        type: "mensagem",
        title: `📩 Mensagem enviada para ${recipient.full_name ?? recipient.email}`,
        body: text.slice(0, 140),
        from: senderName,
      });

      toast.success(
        `Mensagem enviada para ${recipient.full_name ?? recipient.email}.`
      );
      setRecipient(null);
      setMessage("");
    } catch (err: unknown) {
      toast.error(`Erro ao enviar mensagem: ${(err as Error).message}`);
    } finally {
      setSending(false);
    }
  };

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleSaveUsuario = async () => {
    if (!editingUsuario) return;
    const errors: Record<string, string> = {};
    if (!editName.trim()) {
      errors.name = "O nome do usuário não pode ficar em branco.";
    }
    if (!editCargo.trim()) {
      errors.cargo = "O cargo não pode ficar em branco.";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error("Corrija os erros antes de salvar.");
      return;
    }

    setFormErrors({});
    setSavingUsuario(true);
    try {
      const trimmedName = toTitleCase(editName.trim());
      const trimmedCargo = trimText(editCargo.trim());

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: trimmedName,
          cargo: trimmedCargo || null,
        })
        .eq("id", editingUsuario.id);

      if (error) throw error;

      // Atualiza o estado local imediatamente sem recarregar a página
      queryClient.setQueryData<UsuarioRow[]>(["profiles_list"], (old) =>
        (old ?? []).map((u) =>
          u.id === editingUsuario.id
            ? { ...u, full_name: trimmedName, cargo: trimmedCargo || null }
            : u
        )
      );

      toast.success("Usuário atualizado com sucesso.");
      setEditingUsuario(null);
    } catch (err: unknown) {
      toast.error("Erro ao atualizar. Tente novamente.");
    } finally {
      setSavingUsuario(false);
    }
  };

  return (
    <AppLayout
      title="Controle de Usuários"
      subtitle="Equipe e contatos do sistema Chapada"
      actions={
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      }
    >
      <Card className="shadow-sm">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Visto por último</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-16 text-muted-foreground"
                  >
                    <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin" />
                    Carregando usuários...
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-16 text-destructive"
                  >
                    Erro ao carregar usuários. Verifique as permissões de RLS na
                    tabela profiles.
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => {
                  const displayName = u.full_name?.trim() || u.email.split("@")[0];
                  const initials = displayName
                    .split(" ")
                    .map((n: string) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  const status = getStatusOf(u.id);

                  return (
                    <TableRow key={u.id}>
                      {/* Coluna: Usuário com avatar + bolinha de presença */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <PresenceAvatar initials={initials} status={status} />
                          <span className="font-medium">{displayName}</span>
                        </div>
                      </TableCell>

                      {/* Coluna: E-mail */}
                      <TableCell className="text-sm text-muted-foreground">
                        {u.email}
                      </TableCell>

                      {/* Coluna: Cargo — exibe "Administrador" por padrão */}
                      <TableCell className="text-sm text-muted-foreground">
                        {u.cargo ?? "Administrador"}
                      </TableCell>

                      {/* Coluna: Visto por último */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatLastSeen(u.last_seen, status)}
                      </TableCell>

                      {/* Coluna: Status em tempo real */}
                      <TableCell>
                        <StatusBadge status={status} />
                      </TableCell>

                      {/* Coluna: Ações */}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 chapada-btn"
                            onClick={() => {
                              setEditingUsuario(u);
                              setEditName(u.full_name ?? "");
                              setEditCargo(u.cargo ?? "");
                            }}
                          >
                            <Pencil className="h-4 w-4" /> Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 chapada-btn"
                            onClick={() => {
                              setRecipient(u);
                              setMessage("");
                            }}
                          >
                            <MessageSquare className="h-4 w-4" /> Enviar mensagem
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de envio de mensagem */}
      <Dialog
        open={!!recipient}
        onOpenChange={(o) => !o && setRecipient(null)}
      >
        <DialogContent className="max-w-md rounded-xl border border-muted bg-card/95 backdrop-blur-md shadow-2xl">
          <DialogHeader>
            <DialogTitle>Enviar mensagem</DialogTitle>
            <DialogDescription>
              Para: <strong>{recipient?.full_name ?? recipient?.email}</strong>
              <br />
              <span className="text-xs text-muted-foreground">
                {recipient?.email}
              </span>
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            rows={5}
            maxLength={500}
          />
          <p className="text-[11px] text-muted-foreground text-right">
            {message.length}/500
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecipient(null)}>
              Cancelar
            </Button>
            <Button onClick={sendMessage} className="gap-2" disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Enviar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de edição de usuário */}
      <Dialog
        open={!!editingUsuario}
        onOpenChange={(o) => { if (!o) { setEditingUsuario(null); setFormErrors({}); } }}
      >
        <DialogContent className="max-w-md rounded-xl border border-muted bg-card/95 backdrop-blur-md shadow-2xl">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações de cadastro e perfil de <strong>{editingUsuario?.email}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nome Completo *</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome completo do usuário"
                className={formErrors.name ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {formErrors.name && <p className="text-xs text-red-500">{formErrors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-cargo">Cargo *</Label>
              <Input
                id="edit-cargo"
                value={editCargo}
                onChange={(e) => setEditCargo(e.target.value)}
                placeholder="Administrador"
                className={formErrors.cargo ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {formErrors.cargo && <p className="text-xs text-red-500">{formErrors.cargo}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">E-mail</Label>
              <Input
                id="edit-email"
                type="email"
                value={editingUsuario?.email ?? ""}
                readOnly
                disabled
                className="bg-muted text-muted-foreground cursor-not-allowed"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingUsuario(null); setFormErrors({}); }}>
              Cancelar
            </Button>
            <Button onClick={handleSaveUsuario} className="gap-2" disabled={savingUsuario}>
              {savingUsuario ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
