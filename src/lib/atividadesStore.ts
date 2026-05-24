import { useSyncExternalStore, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AtividadeIndicadores {
  participantes?: number;
  mulheres?: number;
  jovens?: number;
  quilombolas?: number;
  povosOriginarios?: number;
  comunidadesTradicionais?: number;
  tecnologiasSociais?: number;
}

export interface AtividadeFull {
  id: string;
  projetoId: string;
  data: string; // ISO date
  tipo: string;
  descricao: string;
  local: string;
  municipio?: string;
  responsaveis: string;
  anexos?: { nome: string; dataUrl: string }[];
  indicadores?: AtividadeIndicadores;
  editado?: boolean;
}

// ─── State ────────────────────────────────────────────────────────────────────
let atividades: AtividadeFull[] = [];
let initialized = false;

const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

const emit = () => listeners.forEach((l) => l());

const sortDesc = (arr: AtividadeFull[]) =>
  [...arr].sort((x, y) => y.data.localeCompare(x.data));

// ─── Database Row → AtividadeFull ─────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAtividade(row: any): AtividadeFull {
  return {
    id: row.id,
    projetoId: row.projeto_id ?? "",
    data: row.data ?? "",
    tipo: row.tipo ?? "",
    descricao: row.descricao ?? "",
    local: row.local ?? "",
    municipio: row.municipio ?? undefined,
    responsaveis: row.responsaveis ?? "",
    // indicadores are stored as JSON in a dedicated column (if present)
    indicadores: row.indicadores ?? undefined,
    anexos: row.anexos ?? undefined,
  };
}

// ─── Initialize (lazy, called once) ───────────────────────────────────────────
export const initAtividades = async () => {
  if (initialized) return;
  initialized = true;

  const { data, error } = await supabase
    .from("atividades")
    .select("*")
    .order("data", { ascending: false });

  if (error) {
    console.error("[atividadesStore] init error:", error);
    return;
  }

  atividades = sortDesc((data ?? []).map(rowToAtividade));
  emit();
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export const addAtividade = async (
  a: Omit<AtividadeFull, "id">
): Promise<string> => {
  const { data, error } = await supabase
    .from("atividades")
    .insert({
      projeto_id: a.projetoId || null,
      data: a.data,
      tipo: a.tipo,
      descricao: a.descricao,
      local: a.local || null,
      municipio: a.municipio || null,
      responsaveis: a.responsaveis || null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[atividadesStore] insert error:", error);
    throw error ?? new Error("Falha ao salvar atividade.");
  }

  const novo = rowToAtividade(data);
  atividades = sortDesc([novo, ...atividades]);
  emit();
  return novo.id;
};

export const updateAtividade = async (
  id: string,
  patch: Partial<AtividadeFull>
) => {
  const updatePayload: Record<string, unknown> = {};
  if (patch.projetoId !== undefined) updatePayload.projeto_id = patch.projetoId;
  if (patch.data !== undefined) updatePayload.data = patch.data;
  if (patch.tipo !== undefined) updatePayload.tipo = patch.tipo;
  if (patch.descricao !== undefined) updatePayload.descricao = patch.descricao;
  if (patch.local !== undefined) updatePayload.local = patch.local;
  if (patch.municipio !== undefined) updatePayload.municipio = patch.municipio;
  if (patch.responsaveis !== undefined)
    updatePayload.responsaveis = patch.responsaveis;

  const { error } = await supabase
    .from("atividades")
    .update(updatePayload)
    .eq("id", id);

  if (error) {
    console.error("[atividadesStore] update error:", error);
    throw error;
  }

  atividades = sortDesc(
    atividades.map((a) => (a.id === id ? { ...a, ...patch, editado: true } : a))
  );
  emit();
};

export const deleteAtividade = async (id: string) => {
  const { error } = await supabase.from("atividades").delete().eq("id", id);
  if (error) {
    console.error("[atividadesStore] delete error:", error);
    throw error;
  }
  atividades = atividades.filter((a) => a.id !== id);
  emit();
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useAtividades = (): AtividadeFull[] => {
  useEffect(() => {
    initAtividades();
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => atividades,
    () => atividades
  );
};

export const useAtividadesIndicadores = () => {
  const list = useAtividades();
  return list.reduce(
    (acc, a) => {
      const i = a.indicadores;
      if (!i) return acc;
      acc.participantes += i.participantes ?? 0;
      acc.mulheres += i.mulheres ?? 0;
      acc.jovens += i.jovens ?? 0;
      acc.quilombolas += i.quilombolas ?? 0;
      acc.povosOriginarios += i.povosOriginarios ?? 0;
      acc.comunidadesTradicionais += i.comunidadesTradicionais ?? 0;
      acc.tecnologiasSociais += i.tecnologiasSociais ?? 0;
      return acc;
    },
    {
      participantes: 0,
      mulheres: 0,
      jovens: 0,
      quilombolas: 0,
      povosOriginarios: 0,
      comunidadesTradicionais: 0,
      tecnologiasSociais: 0,
    }
  );
};
