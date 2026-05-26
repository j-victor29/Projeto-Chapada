import { useSyncExternalStore, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DocumentoItem {
  id: string;
  nome: string;
  url: string;
  tipo_arquivo: "documento";
  projeto_id?: string;
  projeto?: string;
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
    projeto_id: row.projeto_id ?? undefined,
    // Join com projetos pode vir como objeto ou undefined
    projeto: row.projetos?.nome ?? row.projeto ?? "",
    // categoria é coluna texto simples (sem FK)
    categoria: row.categoria ?? "",
    // tags e versao são colunas novas — podem não existir ainda no banco
    tags: Array.isArray(row.tags) ? row.tags : [],
    versao: typeof row.versao === "number" ? row.versao : 1,
    documento_pai_id: row.documento_pai_id ?? undefined,
    created_at: row.created_at ?? "",
  };
}

// ── Init ────────────────────────────────────────────────────────────────────────
export const initDocumentos = async () => {
  if (initialized) return;
  initialized = true;

  try {
    // Tentamos o join com projetos; as colunas novas podem não existir,
    // então fazemos SELECT * e deixamos rowToDoc lidar com undefined
    const { data, error } = await supabase
      .from("arquivos_midia")
      .select("*, projetos(nome)") // sem join em categorias (tabela pode não existir)
      .eq("tipo_arquivo", "documento")
      .order("created_at", { ascending: false });

    if (error) {
      // Se a tabela não tiver a coluna tipo_arquivo ainda, trate silenciosamente
      console.warn("[documentosStore] Aviso ao carregar documentos:", error.message);
      documentos = [];
      emit();
      return;
    }

    documentos = (data ?? []).map(rowToDoc);
    emit();
  } catch (e) {
    console.warn("[documentosStore] Erro inesperado:", e);
    documentos = [];
    emit();
  }
};

export const resetInit = () => {
  initialized = false;
};

// ── CRUD ───────────────────────────────────────────────────────────────────────
export const addDocumento = async (params: {
  file: File;
  projetoId?: string;
  categoria?: string;
  tags?: string[];
  documentoPaiId?: string;
}): Promise<DocumentoItem> => {
  // Sanitizar nome do arquivo (remover caracteres especiais para o path do Storage)
  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${Date.now()}-${safeName}`;

  // 1. Upload para o bucket de documentos
  const { error: uploadError } = await supabase.storage
    .from("documentos")
    .upload(path, params.file, { upsert: false });

  if (uploadError) {
    console.error("[documentosStore] Storage upload error:", uploadError);
    throw new Error(`Falha no upload: ${uploadError.message}`);
  }

  // 2. Obter URL assinada (o bucket é privado)
  const { data: signedData, error: signedError } = await supabase.storage
    .from("documentos")
    .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 ano de validade

  const url = signedData?.signedUrl ?? "";
  if (signedError) console.warn("[documentosStore] URL assinada falhou, usando path:", path);

  // 3. Determinar versão se há documento pai
  let versao = 1;
  if (params.documentoPaiId) {
    try {
      const { data: versions } = await supabase
        .from("arquivos_midia")
        .select("versao")
        .eq("documento_pai_id", params.documentoPaiId)
        .order("versao", { ascending: false })
        .limit(1);
      const maxVer = versions?.[0]?.versao ?? 1;
      versao = maxVer + 1;
    } catch {
      versao = 2; // Fallback caso coluna versao não exista ainda
    }
  }

  // 4. Montar payload — incluímos as colunas novas apenas se passarem sem erro
  const insertPayload: Record<string, unknown> = {
    nome: params.file.name,
    url: url || path,
    tipo_arquivo: "documento",
    projeto_id: params.projetoId ?? null,
  };

  // Colunas novas (migration pode não ter rodado ainda — tentamos incluir)
  try {
    insertPayload.categoria = params.categoria ?? null;
    insertPayload.tags = params.tags ?? [];
    insertPayload.versao = versao;
    insertPayload.documento_pai_id = params.documentoPaiId ?? null;
  } catch {
    // silencioso
  }

  // 5. Inserir registro na tabela de metadados
  const { data, error } = await supabase
    .from("arquivos_midia")
    .insert(insertPayload)
    .select("*, projetos(nome)")
    .single();

  if (error || !data) {
    // Reverter upload em caso de falha no insert
    await supabase.storage.from("documentos").remove([path]);
    throw error ?? new Error("Falha ao salvar metadados do documento.");
  }

  const novo = rowToDoc(data);
  documentos = [novo, ...documentos];
  emit();
  return novo;
};

export const deleteDocumento = async (id: string) => {
  // Buscar a URL para tentar remover do Storage também
  const docToDelete = documentos.find((d) => d.id === id);

  const { error } = await supabase.from("arquivos_midia").delete().eq("id", id);
  if (error) throw error;

  // Tentar remover do Storage (não crítico se falhar)
  if (docToDelete?.url) {
    try {
      // Extrair o path do arquivo da URL
      const urlObj = new URL(docToDelete.url);
      const pathParts = urlObj.pathname.split("/documentos/");
      if (pathParts.length > 1) {
        await supabase.storage.from("documentos").remove([pathParts[1].split("?")[0]]);
      }
    } catch {
      // silencioso — arquivo pode não estar no storage
    }
  }

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
