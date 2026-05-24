import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X, Search, Users } from "lucide-react";
import {
  type Collaborator,
  type EntityType,
  type Ownership,
  updateOwnership,
} from "@/lib/ownershipStore";
import { findUsers } from "@/lib/usersDirectory";

export function CollaboratorsSection({
  type,
  id,
  ownership,
  currentEmail,
}: {
  type: EntityType;
  id: string;
  ownership: Ownership;
  currentEmail: string;
}) {
  const [q, setQ] = useState("");
  const isOwner =
    ownership.ownerEmail.toLowerCase() === currentEmail.toLowerCase();

  const candidates = useMemo(() => {
    const results = findUsers(q);
    return results.filter(
      (u) =>
        u.email.toLowerCase() !== ownership.ownerEmail.toLowerCase() &&
        !ownership.collaborators.some(
          (c) => c.email.toLowerCase() === u.email.toLowerCase(),
        ),
    );
  }, [q, ownership]);

  if (!isOwner) {
    return (
      <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 font-medium">
          <Users className="h-3.5 w-3.5" /> Criado por {ownership.ownerName}
        </div>
        {ownership.allowAll && (
          <p className="mt-1">Todos os usuários podem editar este registro.</p>
        )}
        {!ownership.allowAll && ownership.collaborators.length > 0 && (
          <p className="mt-1">
            Colaboradores: {ownership.collaborators.map((c) => c.name).join(", ")}
          </p>
        )}
      </div>
    );
  }

  const toggleAll = (v: boolean) =>
    updateOwnership(type, id, { allowAll: v });

  const addCol = (c: Collaborator) =>
    updateOwnership(type, id, {
      collaborators: [...ownership.collaborators, c],
    });

  const removeCol = (email: string) =>
    updateOwnership(type, id, {
      collaborators: ownership.collaborators.filter(
        (c) => c.email.toLowerCase() !== email.toLowerCase(),
      ),
    });

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-sm font-semibold">Colaboradores autorizados</Label>
          <p className="text-[11px] text-muted-foreground">
            Criado por <strong>{ownership.ownerName}</strong>
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
        <Switch checked={ownership.allowAll} onCheckedChange={toggleAll} />
      </div>

      {!ownership.allowAll && (
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
              <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border divide-y">
                {candidates.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-muted-foreground">
                    Nenhum usuário encontrado.
                  </li>
                ) : (
                  candidates.map((u) => (
                    <li key={u.email}>
                      <button
                        type="button"
                        onClick={() => {
                          addCol({ email: u.email, name: u.name });
                          setQ("");
                        }}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-accent"
                      >
                        <div>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-muted-foreground">{u.email}</div>
                        </div>
                        <span className="text-primary text-[11px] font-medium">+ Adicionar</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          {ownership.collaborators.length > 0 && (
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
                    onClick={() => removeCol(c.email)}
                    aria-label={`Remover ${c.name}`}
                    className="ml-0.5 rounded p-0.5 hover:bg-background"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
