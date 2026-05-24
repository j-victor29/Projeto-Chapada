import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { DIRECTORY, userNameByEmail } from "./usersDirectory";

export type EntityType = "projeto" | "atividade" | "imagem" | "tecnologia";

export interface Collaborator {
  email: string;
  name: string;
}

export interface Ownership {
  ownerEmail: string;
  ownerName: string;
  allowAll: boolean;
  collaborators: Collaborator[];
}

const STORAGE_KEY = "chapada.ownership.v2";
const SEED_FLAG = "chapada.ownership.seeded.v2";

type Map = Record<string, Ownership>;

const keyOf = (t: EntityType, id: string) => `${t}:${id}`;

const load = (): Map => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

let map: Map = load();
const listeners = new Set<() => void>();
const persist = () => {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  }
};
const emit = () => {
  persist();
  listeners.forEach((l) => l());
};

const sub = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export const setOwnership = (t: EntityType, id: string, o: Ownership) => {
  map = { ...map, [keyOf(t, id)]: o };
  emit();
};

export const updateOwnership = (
  t: EntityType,
  id: string,
  patch: Partial<Ownership>,
) => {
  const k = keyOf(t, id);
  const cur = map[k];
  if (!cur) return;
  map = { ...map, [k]: { ...cur, ...patch } };
  emit();
};

export const removeOwnership = (t: EntityType, id: string) => {
  const k = keyOf(t, id);
  if (!map[k]) return;
  const next = { ...map };
  delete next[k];
  map = next;
  emit();
};

export const getOwnership = (t: EntityType, id: string): Ownership | undefined =>
  map[keyOf(t, id)];

export const canEdit = (
  t: EntityType,
  id: string,
  email?: string | null,
): boolean => {
  const o = map[keyOf(t, id)];
  if (!o) return true; // unowned (shouldn't happen after seed)
  if (!email) return false;
  const e = email.toLowerCase();
  if (o.ownerEmail.toLowerCase() === e) return true;
  if (o.allowAll) return true;
  return o.collaborators.some((c) => c.email.toLowerCase() === e);
};

export const useOwnership = (t: EntityType, id: string): Ownership | undefined =>
  useSyncExternalStore(
    sub,
    () => map[keyOf(t, id)],
    () => undefined,
  );

export const denyToast = () =>
  toast.error(
    "⚠️ Você não tem permissão para realizar esta ação. Apenas o criador ou colaboradores autorizados podem editar ou excluir este registro.",
  );

export const makeOwnership = (
  email: string,
  name?: string,
): Ownership => ({
  ownerEmail: email.toLowerCase(),
  ownerName: name || userNameByEmail(email),
  allowAll: false,
  collaborators: [],
});

// ---- Seeding ----
const E = {
  teste: "teste@ongchapada.org.br",
  maria: "maria@chapada.org.br",
  jose: "jose.pedro@chapada.org.br",
  ana: "ana@chapada.org.br",
  carlos: "carlos@chapada.org.br",
  lucia: "lucia@chapada.org.br",
};

const own = (email: string): Ownership => makeOwnership(email);

export const seedOwnership = (
  atividadesSortedIds: string[],
  atividadeProjetoMap: Record<string, string>,
) => {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEED_FLAG)) return;

  const seed: Map = { ...map };

  // Projetos
  const projOwners: Record<string, string> = {
    "1": E.teste,
    "2": E.teste,
    "3": E.maria,
    "4": E.jose,
    "5": E.ana,
  };
  for (const [pid, em] of Object.entries(projOwners)) {
    if (!seed[keyOf("projeto", pid)]) seed[keyOf("projeto", pid)] = own(em);
  }

  // Atividades — first 3 in sorted display order to teste; rest by projetoId
  const projToOwner: Record<string, string> = {
    "1": E.teste,
    "2": E.teste,
    "3": E.maria,
    "4": E.jose,
    "5": E.ana,
  };
  const firstThree = new Set(atividadesSortedIds.slice(0, 3));
  for (const aid of atividadesSortedIds) {
    const k = keyOf("atividade", aid);
    if (seed[k]) continue;
    if (firstThree.has(aid)) {
      seed[k] = own(E.teste);
    } else {
      const pid = atividadeProjetoMap[aid];
      const em = projToOwner[pid];
      if (em) seed[k] = own(em);
      else seed[k] = own(E.carlos); // remaining unassigned
    }
  }

  // Tecnologias
  const tecOwners: Record<string, string> = {
    t1: E.teste, t2: E.teste, t3: E.teste,
    t4: E.maria, t20: E.maria, t19: E.maria,
    t7: E.jose, t8: E.jose,
    t9: E.ana, t10: E.ana, t5: E.ana, t17: E.ana, t22: E.ana, t23: E.ana,
    t12: E.carlos, t13: E.carlos,
    t15: E.lucia, t16: E.lucia,
    // Remaining by project
    t6: E.teste, t11: E.teste, t14: E.teste, t18: E.teste, t21: E.teste,
  };
  for (const [tid, em] of Object.entries(tecOwners)) {
    const k = keyOf("tecnologia", tid);
    if (!seed[k]) seed[k] = own(em);
  }

  // Imagens
  const imgOwners: Record<string, string> = {
    "img-ex1": E.teste,
    "img-ex2": E.teste,
    "img-ex3": E.lucia,
    "img-ex4": E.lucia,
    "img-ex5": E.lucia,
    "img-ex6": E.lucia,
  };
  for (const [iid, em] of Object.entries(imgOwners)) {
    const k = keyOf("imagem", iid);
    if (!seed[k]) seed[k] = own(em);
  }

  map = seed;
  persist();
  localStorage.setItem(SEED_FLAG, "1");
  listeners.forEach((l) => l());
};

// Expose directory for collaborator lookup convenience
export { DIRECTORY };
