import { useSyncExternalStore, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ProjetoStatus } from "@/lib/mockData";

export interface ProjetoDB {
  id: string;
  nome: string;
  contrato: string;
  financiador: string;
  financiadorId?: string | null;
  inicio: string; // ISO date
  termino: string;
  valor: number;
  municipios: string[];
  comunidadesAtendidas: string[];
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
    financiadorId: row.financiador_id ?? null,
    inicio: row.inicio ?? "",
    termino: row.termino ?? "",
    valor: Number(row.valor ?? 0),
    municipios: Array.isArray(row.municipios) ? row.municipios : [],
    comunidadesAtendidas: Array.isArray(row.comunidades_atendidas) ? row.comunidades_atendidas : [],
    publicoQuant: Number(row.publico_quant ?? 0),
    publicoCaract: row.publico_caract ?? "",
    status: (row.status as ProjetoStatus) ?? "Em execução",
  };
}

// Helper to sync pivot table projeto_municipios
const syncProjetoMunicipios = async (projetoId: string, municipios: string[]) => {
  try {
    // 1. Delete existing associations
    await supabase.from("projeto_municipios").delete().eq("projeto_id", projetoId);

    if (!municipios || municipios.length === 0) return;

    // 2. Fetch UUIDs for selected municipio names
    const { data: dbMuns } = await supabase
      .from("municipios")
      .select("id, nome")
      .in("nome", municipios);

    if (dbMuns && dbMuns.length > 0) {
      // 3. Insert associations
      const inserts = dbMuns.map((m) => ({
        projeto_id: projetoId,
        municipio_id: m.id,
      }));
      await supabase.from("projeto_municipios").insert(inserts);
    }
  } catch (err) {
    console.error("[projetosStore] Error syncing project municipios:", err);
  }
};

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
      financiador_id: p.financiadorId || null,
      inicio: p.inicio,
      termino: p.termino,
      valor: p.valor,
      municipios: p.municipios,
      comunidades_atendidas: p.comunidadesAtendidas || [],
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
  await syncProjetoMunicipios(novo.id, p.municipios);
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
  if (patch.financiadorId !== undefined)
    updatePayload.financiador_id = patch.financiadorId || null;
  if (patch.inicio !== undefined) updatePayload.inicio = patch.inicio;
  if (patch.termino !== undefined) updatePayload.termino = patch.termino;
  if (patch.valor !== undefined) updatePayload.valor = patch.valor;
  if (patch.municipios !== undefined)
    updatePayload.municipios = patch.municipios;
  if (patch.comunidadesAtendidas !== undefined)
    updatePayload.comunidades_atendidas = patch.comunidadesAtendidas;
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

  if (patch.municipios !== undefined) {
    await syncProjetoMunicipios(id, patch.municipios);
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

export const refreshProjetos = async () => {
  initialized = false;
  await initProjetos();
};

export const getSnapshot = () => projetos;

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useProjetos = (): ProjetoDB[] => {
  useEffect(() => {
    initProjetos();
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, () => projetos);
};
