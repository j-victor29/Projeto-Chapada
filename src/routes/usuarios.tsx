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
import { MessageSquare, Send } from "lucide-react";
import { useGlobalSearch } from "@/contexts/SearchContext";
import { addNotification } from "@/lib/notificationsStore";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile, fullName } from "@/lib/profileStore";
import { toast } from "sonner";

export const Route = createFileRoute("/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — CHAPADA" }] }),
  component: UsuariosPage,
});

const usuarios = [
  { nome: "Maria Conceição", email: "maria@chapada.org.br", ativo: true, lastSignIn: "2025-04-26T14:32:00" },
  { nome: "José Pedro Lima", email: "jose.pedro@chapada.org.br", ativo: true, lastSignIn: "2025-04-25T09:15:00" },
  { nome: "Ana Beatriz Souza", email: "ana@chapada.org.br", ativo: true, lastSignIn: "2025-04-24T17:48:00" },
  { nome: "Carlos Henrique", email: "carlos@chapada.org.br", ativo: true, lastSignIn: "2025-04-20T11:02:00" },
  { nome: "Lúcia Ferreira", email: "lucia@chapada.org.br", ativo: false, lastSignIn: null as string | null },
];

const formatLastSignIn = (iso: string | null) => {
  if (!iso) return "Nunca acessou";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

type Usuario = (typeof usuarios)[number];

function UsuariosPage() {
  const { query } = useGlobalSearch();
  const { user } = useAuth();
  const profile = useProfile(user?.email ?? "");
  const senderName = fullName(profile, user?.email?.split("@")[0] ?? "Usuário");

  const [recipient, setRecipient] = useState<Usuario | null>(null);
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) => [u.nome, u.email].join(" ").toLowerCase().includes(q));
  }, [query]);

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
    toast.success(`Mensagem enviada para ${recipient.nome}.`);
    setRecipient(null);
    setMessage("");
  };

  return (
    <AppLayout
      title="Controle de Usuários"
      subtitle="Equipe e contatos do sistema CHAPADA"
    >
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Último Acesso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => (
                  <TableRow key={u.email}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            {u.nome
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{u.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatLastSignIn(u.lastSignIn)}
                    </TableCell>
                    <TableCell>
                      {u.ativo ? (
                        <Badge variant="secondary" className="bg-savanna/15 text-savanna">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground">
                          Inativo
                        </Badge>
                      )}
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
                ))
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
              Para: <strong>{recipient?.nome}</strong>
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
