import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X, Search, Users, Loader2 } from "lucide-react";
import {
  type Collaborator,
  type EntityType,
  type Ownership,
  updateOwnership,
} from "@/lib/ownershipStore";
import { findUsers } from "@/lib/usersDirectory";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CollaboratorsSectionProps {
  // Legacy ownershipStore props
  type?: EntityType;
  id?: string;
  ownership?: Ownership;
  currentEmail?: string;

  // Database-backed props
  tabela?: string;
  registro_id?: string | null;
  created_by?: string | null;
}

export function CollaboratorsSection({
  type,
  id,
  ownership,
  currentEmail,
  tabela,
  registro_id,
  created_by,
}: CollaboratorsSectionProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [q, setQ] = useState("");

  const isDbBacked = !!tabela;

  // --- Database-Backed Queries ---
  const { data: colaboradores = [], isLoading: loadingColabs } = useQuery({
    queryKey: ["colaboradores", tabela, registro_id],
    queryFn: async () => {
      if (!tabela || !registro_id) return [];
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
        .eq("registro_id", registro_id);
      if (error) throw error;
      return data || [];
    },
    enabled: isDbBacked && !!registro_id,
  });

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
    enabled: isDbBacked,
  });

  // --- Common Variables ---
  const isOwner = isDbBacked
    ? !created_by || (!!user?.id && created_by === user?.id)
    : ownership
    ? ownership.ownerEmail.toLowerCase() === (currentEmail || "").toLowerCase()
    : false;

  const creatorId = isDbBacked ? (created_by || user?.id) : null;
  const creatorProfile = isDbBacked ? profiles.find((p) => p.id === creatorId) : null;
  const creatorName = isDbBacked
    ? creatorProfile?.full_name || creatorProfile?.email?.split("@")[0] || "Criador"
    : ownership
    ? ownership.ownerName
    : "Criador";

  const permitTodosRow = isDbBacked
    ? colaboradores.find((c: any) => c.permitir_todos && !c.user_id)
    : null;
  const permitirTodos = isDbBacked ? !!permitTodosRow : ownership?.allowAll ?? false;

  // --- Search / Selection Candidates ---
  const candidates = useMemo(() => {
    const searchVal = q.toLowerCase().trim();
    if (!searchVal) return [];

    if (isDbBacked) {
      return profiles.filter((p) => {
        const isCreator = p.id === creatorId;
        const isAlreadyAdded = colaboradores.some((c: any) => c.user_id === p.id);
        const matchesSearch =
          p.email.toLowerCase().includes(searchVal) ||
          (p.full_name ?? "").toLowerCase().includes(searchVal);
        return !isCreator && !isAlreadyAdded && matchesSearch;
      });
    } else {
      if (!ownership) return [];
      const results = findUsers(searchVal);
      return results.filter(
        (u) =>
          u.email.toLowerCase() !== ownership.ownerEmail.toLowerCase() &&
          !ownership.collaborators.some(
            (c) => c.email.toLowerCase() === u.email.toLowerCase()
          )
      );
    }
  }, [q, isDbBacked, profiles, colaboradores, creatorId, ownership]);

  // --- Handlers ---
  const handleToggleAll = async (checked: boolean) => {
    if (isDbBacked) {
      if (!registro_id) return;
      try {
        if (checked) {
          const { error } = await supabase.from("registro_colaboradores").insert({
            tabela,
            registro_id,
            user_id: null,
            permitir_todos: true,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("registro_colaboradores")
            .delete()
            .eq("tabela", tabela)
            .eq("registro_id", registro_id)
            .is("user_id", null);
          if (error) throw error;
        }
        toast.success("Permissões gerais atualizadas.");
        queryClient.invalidateQueries({ queryKey: ["colaboradores", tabela, registro_id] });
      } catch (err: any) {
        toast.error(`Erro ao atualizar permissões: ${err.message}`);
      }
    } else {
      if (type && id) {
        updateOwnership(type, id, { allowAll: checked });
      }
    }
  };

  const handleAddCollaborator = async (candidate: any) => {
    if (isDbBacked) {
      if (!registro_id) return;
      try {
        const { error } = await supabase.from("registro_colaboradores").insert({
          tabela,
          registro_id,
          user_id: candidate.id,
          permitir_todos: false,
        });
        if (error) throw error;
        setQ("");
        toast.success("Colaborador adicionado.");
        queryClient.invalidateQueries({ queryKey: ["colaboradores", tabela, registro_id] });
      } catch (err: any) {
        toast.error(`Erro ao adicionar colaborador: ${err.message}`);
      }
    } else {
      if (type && id && ownership) {
        updateOwnership(type, id, {
          collaborators: [...ownership.collaborators, candidate],
        });
        setQ("");
      }
    }
  };

  const handleRemoveCollaborator = async (colab: any) => {
    if (isDbBacked) {
      try {
        const { error } = await supabase
          .from("registro_colaboradores")
          .delete()
          .eq("id", colab.id);
        if (error) throw error;
        toast.success("Colaborador removido.");
        queryClient.invalidateQueries({ queryKey: ["colaboradores", tabela, registro_id] });
      } catch (err: any) {
        toast.error(`Erro ao remover colaborador: ${err.message}`);
      }
    } else {
      if (type && id && ownership) {
        updateOwnership(type, id, {
          collaborators: ownership.collaborators.filter(
            (c) => c.email.toLowerCase() !== colab.email.toLowerCase()
          ),
        });
      }
    }
  };

  // --- View Only Mode for Non-Owners ---
  if (!isOwner) {
    let listNames = "";
    if (isDbBacked) {
      listNames = colaboradores
        .filter((c: any) => c.user_id && c.profiles)
        .map((c: any) => c.profiles.full_name || c.profiles.email.split("@")[0])
        .join(", ");
    } else if (ownership) {
      listNames = ownership.collaborators.map((c) => c.name).join(", ");
    }

    return (
      <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 font-medium">
          <Users className="h-3.5 w-3.5" /> Criado por {creatorName}
        </div>
        {permitirTodos && (
          <p className="mt-1">Todos os usuários podem editar este registro.</p>
        )}
        {!permitirTodos && listNames.length > 0 && (
          <p className="mt-1">Colaboradores: {listNames}</p>
        )}
      </div>
    );
  }

  // --- Edit Mode for Owners ---
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-sm font-semibold">Colaboradores autorizados</Label>
          <p className="text-[11px] text-muted-foreground">
            Criado por <strong>{creatorName}</strong>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
        <div>
          <p className="text-xs font-medium">Permitir para todos os usuários</p>
          <p className="text-[10px] text-muted-foreground">
            Todos poderão editar e excluir este registro.
          </p>
        </div>
        <Switch checked={permitirTodos} onCheckedChange={handleToggleAll} disabled={isDbBacked && !registro_id} />
      </div>

      {isDbBacked && !registro_id && (
        <p className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded-md italic">
          O gerenciamento de colaboradores autorizados adicionais estará disponível após a criação deste registro.
        </p>
      )}

      {(!isDbBacked || !!registro_id) && !permitirTodos && (
        <>
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome ou e-mail..."
                className="pl-9 h-9"
              />
            </div>
            {q.trim() && (
              <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border divide-y bg-popover text-popover-foreground">
                {candidates.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-muted-foreground">
                    Nenhum usuário encontrado.
                  </li>
                ) : (
                  candidates.map((u: any) => (
                    <li key={isDbBacked ? u.id : u.email}>
                      <button
                        type="button"
                        onClick={() => {
                          if (isDbBacked) {
                            handleAddCollaborator(u);
                          } else {
                            handleAddCollaborator({ email: u.email, name: u.name });
                          }
                        }}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-accent"
                      >
                        <div>
                          <div className="font-medium">{isDbBacked ? (u.full_name || u.email.split("@")[0]) : u.name}</div>
                          <div className="text-muted-foreground text-[10px]">{u.email}</div>
                        </div>
                        <span className="text-primary text-[11px] font-medium">+ Adicionar</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          {isDbBacked ? (
            colaboradores.filter((c: any) => c.user_id).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {colaboradores
                  .filter((c: any) => c.user_id && c.profiles)
                  .map((c: any) => {
                    const name = c.profiles.full_name || c.profiles.email.split("@")[0];
                    return (
                      <Badge
                        key={c.id}
                        variant="secondary"
                        className="gap-1 pl-2 pr-1"
                      >
                        {name}
                        <button
                          type="button"
                          onClick={() => handleRemoveCollaborator(c)}
                          aria-label={`Remover ${name}`}
                          className="ml-0.5 rounded p-0.5 hover:bg-background"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
              </div>
            )
          ) : (
            ownership && ownership.collaborators.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {ownership.collaborators.map((c) => (
                  <Badge
                    key={c.email}
                    variant="secondary"
                    className="gap-1 pl-2 pr-1"
                  >
                    {c.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveCollaborator(c)}
                      aria-label={`Remover ${c.name}`}
                      className="ml-0.5 rounded p-0.5 hover:bg-background"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
