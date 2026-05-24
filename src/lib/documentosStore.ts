import { useSyncExternalStore, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DocumentoItem {
  id: string;
  nome: string;
  url: string;
  tipo_arquivo: "documento";
  projeto_id?: string;
  projeto?: string;
  categoria_id?: string;
  categoria?: string;
  tags: string[];
  versao: number;
  documento_pai_id?: string;
  created_at: string;
}

// ── State ──────────────────────────────────────────────────────────────────────
let documentos: DocumentoItem[] = [];
let initialized = false;
const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const emit = () => listeners.forEach((l) => l());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToDoc(row: any): DocumentoItem {
  return {
    id: row.id,
    nome: row.nome ?? "",
    url: row.url ?? "",
    tipo_arquivo: "documento",
    projeto_id: row.projeto_id,
    projeto: row.projetos?.nome ?? "",
    categoria_id: row.categoria_id,
    categoria: row.categorias?.nome ?? "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    versao: row.versao ?? 1,
    documento_pai_id: row.documento_pai_id ?? undefined,
    created_at: row.created_at ?? "",
  };
}

// ── Init ────────────────────────────────────────────────────────────────────────
export const initDocumentos = async () => {
  if (initialized) return;
  initialized = true;

  const { data, error } = await supabase
    .from("arquivos_midia")
    .select("*, projetos(nome), categorias(nome)")
    .eq("tipo_arquivo", "documento")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[documentosStore] init error:", error);
    return;
  }
  documentos = (data ?? []).map(rowToDoc);
  emit();
};

// ── CRUD ───────────────────────────────────────────────────────────────────────
export const addDocumento = async (params: {
  file: File;
  projetoId?: string;
  categoriaId?: string;
  tags?: string[];
  documentoPaiId?: string;
}): Promise<DocumentoItem> => {
  const path = `documentos/${Date.now()}-${params.file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("documentos")
    .upload(path, params.file, { upsert: false });

  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage.from("documentos").getPublicUrl(path);
  const url = publicData.publicUrl;

  // Determinar versão se há documento pai
  let versao = 1;
  if (params.documentoPaiId) {
    const { data: versions } = await supabase
      .from("arquivos_midia")
      .select("versao")
      .eq("documento_pai_id", params.documentoPaiId)
      .order("versao", { ascending: false })
      .limit(1);
    const maxVer = versions?.[0]?.versao ?? 1;
    versao = maxVer + 1;
  }

  const { data, error } = await supabase
    .from("arquivos_midia")
    .insert({
      nome: params.file.name,
      url,
      tipo_arquivo: "documento",
      projeto_id: params.projetoId ?? null,
      categoria_id: params.categoriaId ?? null,
      tags: params.tags ?? [],
      versao,
      documento_pai_id: params.documentoPaiId ?? null,
    })
    .select("*, projetos(nome), categorias(nome)")
    .single();

  if (error || !data) throw error ?? new Error("Falha ao salvar documento.");
  const novo = rowToDoc(data);
  documentos = [novo, ...documentos];
  emit();
  return novo;
};

export const deleteDocumento = async (id: string) => {
  const { error } = await supabase.from("arquivos_midia").delete().eq("id", id);
  if (error) throw error;
  documentos = documentos.filter((d) => d.id !== id);
  emit();
};

export const getSnapshot = () => documentos;

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useDocumentos = (): DocumentoItem[] => {
  useEffect(() => {
    initDocumentos();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, () => documentos);
};
