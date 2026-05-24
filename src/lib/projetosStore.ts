import { useSyncExternalStore, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ProjetoStatus } from "@/lib/mockData";

export interface ProjetoDB {
  id: string;
  nome: string;
  contrato: string;
  financiador: string;
  inicio: string; // ISO date
  termino: string;
  valor: number;
  municipios: string[];
  publicoQuant: number;
  publicoCaract: string;
  status: ProjetoStatus;
}

// ─── State ────────────────────────────────────────────────────────────────────
let projetos: ProjetoDB[] = [];
let initialized = false;

const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const emit = () => listeners.forEach((l) => l());

// ─── Database Row → ProjetoDB ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProjeto(row: any): ProjetoDB {
  return {
    id: row.id,
    nome: row.nome ?? "",
    contrato: row.contrato ?? "",
    financiador: row.financiador ?? "",
    inicio: row.inicio ?? "",
    termino: row.termino ?? "",
    valor: Number(row.valor ?? 0),
    municipios: Array.isArray(row.municipios) ? row.municipios : [],
    publicoQuant: Number(row.publico_quant ?? 0),
    publicoCaract: row.publico_caract ?? "",
    status: (row.status as ProjetoStatus) ?? "Em execução",
  };
}

// ─── Initialize ───────────────────────────────────────────────────────────────
export const initProjetos = async () => {
  if (initialized) return;
  initialized = true;

  const { data, error } = await supabase
    .from("projetos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[projetosStore] init error:", error);
    return;
  }

  projetos = (data ?? []).map(rowToProjeto);
  emit();
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export const addProjeto = async (
  p: Omit<ProjetoDB, "id">
): Promise<ProjetoDB> => {
  const { data, error } = await supabase
    .from("projetos")
    .insert({
      nome: p.nome,
      contrato: p.contrato,
      financiador: p.financiador,
      inicio: p.inicio,
      termino: p.termino,
      valor: p.valor,
      municipios: p.municipios,
      publico_quant: p.publicoQuant,
      publico_caract: p.publicoCaract || null,
      status: p.status,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[projetosStore] insert error:", error);
    throw error ?? new Error("Falha ao salvar projeto.");
  }

  const novo = rowToProjeto(data);
  projetos = [novo, ...projetos];
  emit();
  return novo;
};

export const updateProjeto = async (
  id: string,
  patch: Partial<Omit<ProjetoDB, "id">>
) => {
  const updatePayload: Record<string, unknown> = {};
  if (patch.nome !== undefined) updatePayload.nome = patch.nome;
  if (patch.contrato !== undefined) updatePayload.contrato = patch.contrato;
  if (patch.financiador !== undefined)
    updatePayload.financiador = patch.financiador;
  if (patch.inicio !== undefined) updatePayload.inicio = patch.inicio;
  if (patch.termino !== undefined) updatePayload.termino = patch.termino;
  if (patch.valor !== undefined) updatePayload.valor = patch.valor;
  if (patch.municipios !== undefined)
    updatePayload.municipios = patch.municipios;
  if (patch.publicoQuant !== undefined)
    updatePayload.publico_quant = patch.publicoQuant;
  if (patch.publicoCaract !== undefined)
    updatePayload.publico_caract = patch.publicoCaract;
  if (patch.status !== undefined) updatePayload.status = patch.status;

  const { error } = await supabase
    .from("projetos")
    .update(updatePayload)
    .eq("id", id);

  if (error) {
    console.error("[projetosStore] update error:", error);
    throw error;
  }

  projetos = projetos.map((p) =>
    p.id === id ? { ...p, ...patch } : p
  );
  emit();
};

export const deleteProjeto = async (id: string) => {
  const { error } = await supabase.from("projetos").delete().eq("id", id);
  if (error) {
    console.error("[projetosStore] delete error:", error);
    throw error;
  }
  projetos = projetos.filter((p) => p.id !== id);
  emit();
};

export const getSnapshot = () => projetos;

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useProjetos = (): ProjetoDB[] => {
  useEffect(() => {
    initProjetos();
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, () => projetos);
};
