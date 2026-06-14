import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { X, Search, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CollaboratorsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabela: string;
  registroId: string;
  createdBy: string | null | undefined;
  creatorName?: string;
}

export function CollaboratorsModal({
  open,
  onOpenChange,
  tabela,
  registroId,
  createdBy,
  creatorName = "Criador",
}: CollaboratorsModalProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Fetch current collaborators
  const { data: colaboradores = [], isLoading: loadingColabs } = useQuery({
    queryKey: ["colaboradores", tabela, registroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registro_colaboradores")
        .select(`
          id,
          tabela,
          registro_id,
          user_id,
          permitir_todos,
          profiles:user_id (
            id,
            email,
            full_name
          )
        `)
        .eq("tabela", tabela)
        .eq("registro_id", registroId);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!registroId,
  });

  // 2. Fetch all system profiles to select from
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const permitTodosRow = colaboradores.find((c: any) => c.permitir_todos && !c.user_id);
  const permitirTodos = !!permitTodosRow;

  // Filter out candidates
  const candidates = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    return profiles.filter((p) => {
      const isCreator = p.id === createdBy;
      const isAlreadyAdded = colaboradores.some((c: any) => c.user_id === p.id);
      const matchesSearch =
        p.email.toLowerCase().includes(q) ||
        (p.full_name ?? "").toLowerCase().includes(q);
      return !isCreator && !isAlreadyAdded && matchesSearch;
    });
  }, [searchQuery, profiles, colaboradores, createdBy]);

  // Handle toggling "permitir todos"
  const handleToggleAll = async (checked: boolean) => {
    try {
      if (checked) {
        const { error } = await supabase.from("registro_colaboradores").insert({
          tabela,
          registro_id: registroId,
          user_id: null,
          permitir_todos: true,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("registro_colaboradores")
          .delete()
          .eq("tabela", tabela)
          .eq("registro_id", registroId)
          .is("user_id", null);
        if (error) throw error;
      }
      toast.success("Permissões gerais atualizadas.");
      queryClient.invalidateQueries({ queryKey: ["colaboradores", tabela, registroId] });
    } catch (err: any) {
      toast.error(`Erro ao atualizar permissões: ${err.message}`);
    }
  };

  // Add collaborator
  const handleAddCollaborator = async (userId: string) => {
    try {
      const { error } = await supabase.from("registro_colaboradores").insert({
        tabela,
        registro_id: registroId,
        user_id: userId,
        permitir_todos: false,
      });
      if (error) throw error;
      setSearchQuery("");
      toast.success("Colaborador adicionado.");
      queryClient.invalidateQueries({ queryKey: ["colaboradores", tabela, registroId] });
    } catch (err: any) {
      toast.error(`Erro ao adicionar colaborador: ${err.message}`);
    }
  };

  // Remove collaborator
  const handleRemoveCollaborator = async (colabId: string) => {
    try {
      const { error } = await supabase
        .from("registro_colaboradores")
        .delete()
        .eq("id", colabId);
      if (error) throw error;
      toast.success("Colaborador removido.");
      queryClient.invalidateQueries({ queryKey: ["colaboradores", tabela, registroId] });
    } catch (err: any) {
      toast.error(`Erro ao remover colaborador: ${err.message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl border border-muted bg-card/95 backdrop-blur-md shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Colaboradores autorizados
          </DialogTitle>
          <DialogDescription>
            Criado por: <span className="font-semibold text-foreground">{creatorName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {/* Toggle for Permitir Todos */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-muted/50">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold">Permitir para todos os usuários</Label>
              <p className="text-[10px] text-muted-foreground">
                Todos poderão editar e excluir este registro.
              </p>
            </div>
            <Switch checked={permitirTodos} onCheckedChange={handleToggleAll} />
          </div>

          {!permitirTodos && (
            <>
              {/* Search user */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome ou e-mail..."
                  className="pl-9 h-9"
                />
              </div>

              {/* Suggestions */}
              {searchQuery.trim() && (
                <ul className="max-h-40 overflow-y-auto rounded-md border divide-y bg-popover text-popover-foreground">
                  {candidates.length === 0 ? (
                    <li className="px-3 py-2 text-xs text-muted-foreground">
                      Nenhum usuário encontrado.
                    </li>
                  ) : (
                    candidates.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => handleAddCollaborator(p.id)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-accent"
                        >
                          <div>
                            <div className="font-medium">{p.full_name || p.email.split("@")[0]}</div>
                            <div className="text-[10px] text-muted-foreground">{p.email}</div>
                          </div>
                          <span className="text-primary text-[10px] font-semibold">+ Adicionar</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}

              {/* Collaborators List */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Colaboradores adicionados</Label>
                {loadingColabs ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : colaboradores.filter((c: any) => c.user_id).length === 0 ? (
                  <p className="text-[11px] text-muted-foreground py-2 text-center">
                    Nenhum colaborador adicionado ainda.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {colaboradores
                      .filter((c: any) => c.user_id && c.profiles)
                      .map((c: any) => {
                        const name = c.profiles.full_name || c.profiles.email.split("@")[0];
                        const initials = name
                          .split(" ")
                          .map((n: string) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase();
                        return (
                          <div
                            key={c.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-background border border-muted"
                          >
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-7 w-7 text-[10px]">
                                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold leading-none truncate">
                                  {name}
                                </p>
                                <p className="text-[9px] text-muted-foreground truncate">
                                  {c.profiles.email}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveCollaborator(c.id)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
