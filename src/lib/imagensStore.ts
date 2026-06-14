import { useSyncExternalStore, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ImagemItem {
  id: string;
  projeto: string;      // nome do projeto (para exibição)
  projetoId?: string;   // uuid FK
  local: string;
  tipo: string;
  date: string;         // dd/mm/yyyy (para exibição)
  dataIso?: string;     // ISO para ordenação
  url: string;          // URL pública do Supabase Storage
  nomeArquivo: string;
  categoriaId?: string;   // uuid FK para categorias
  categoriaNome?: string; // nome da categoria (para exibição)
  // legacy compat – dataUrl agora é um alias de url
  dataUrl?: string;
  created_by?: string | null;
}

// ─── State ────────────────────────────────────────────────────────────────────
let imagens: ImagemItem[] = [];
let initialized = false;

// ─── Categorias State ──────────────────────────────────────────────────────────────
export interface CategoriaItem {
  id: string;
  nome: string;
}
let categorias: CategoriaItem[] = [];
let categoriasInitialized = false;

const categoriasListeners = new Set<() => void>();
const subscribeC = (cb: () => void) => {
  categoriasListeners.add(cb);
  return () => { categoriasListeners.delete(cb); };
};
const emitC = () => categoriasListeners.forEach((l) => l());

const REQUIRED_CATEGORIES = [
  "Meio ambiente e sustentabilidade",
  "Acesso à água e saneamento rural",
  "Segurança alimentar e geração de renda",
  "Direitos das crianças e adolescentes",
  "Protagonismo feminino",
  "Juventude rural",
  "Comunicação | Eventos",
];

export const initCategorias = async () => {
  if (categoriasInitialized) return;
  categoriasInitialized = true;
  const { data, error } = await supabase
    .from("categorias" as any)
    .select("id, nome")
    .order("nome", { ascending: true });
  if (error) {
    console.error("[imagensStore] categorias init error:", error);
    return;
  }
  
  let dbCategorias = (data ?? []) as { id: string; nome: string }[];
  
  // Ensure required categories exist
  const missingCategories = REQUIRED_CATEGORIES.filter(
    (reqName) => !dbCategorias.some((c) => c.nome === reqName)
  );
  
  if (missingCategories.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("categorias" as any)
      .insert(missingCategories.map((nome) => ({ nome })))
      .select("id, nome");
      
    if (!insertError && inserted) {
      dbCategorias = [...dbCategorias, ...(inserted as { id: string; nome: string }[])];
    }
  }

  // Only expose the required ones to the UI
  categorias = dbCategorias
    .filter((c) => REQUIRED_CATEGORIES.includes(c.nome))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  emitC();
};

const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const emit = () => listeners.forEach((l) => l());

// ─── Database Row → ImagemItem ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToImagem(row: any): ImagemItem {
  let dateDisplay = "";
  if (row.data) {
    const [y, m, d] = row.data.split("-");
    dateDisplay = `${d}/${m}/${y}`;
  }
  return {
    id: row.id,
    projeto: row.nome_projeto ?? "",
    projetoId: row.projeto_id ?? undefined,
    local: row.local ?? "",
    tipo: row.tipo_acao ?? "",
    date: dateDisplay,
    dataIso: row.data ?? "",
    url: row.url ?? "",
    nomeArquivo: row.nome ?? "",
    categoriaId: row.categoria_id ?? undefined,
    categoriaNome: row.nome_categoria ?? undefined,
    dataUrl: row.url ?? "",
    created_by: row.created_by,
  };
}

// ─── Initialize ───────────────────────────────────────────────────────────────
export const initImagens = async () => {
  if (initialized) return;
  initialized = true;

  // Also boot categorias in parallel
  initCategorias();

  // Join arquivos_midia with projetos and categorias
  const { data, error } = await supabase
    .from("arquivos_midia" as any)
    .select("*, projetos(nome), categorias(nome)")
    .eq("tipo_arquivo", "imagem")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[imagensStore] init error:", error);
    return;
  }

  imagens = (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nomeProjeto = (row as any).projetos?.nome ?? "";
    const nomeCategoria = (row as any).categorias?.nome ?? undefined;
    return rowToImagem({ ...(row as any), nome_projeto: nomeProjeto, nome_categoria: nomeCategoria });
  });
  emit();
};

// ─── Upload + Insert ───────────────────────────────────────────────────────────

export interface AddImagemPayload {
  file: File;
  projeto: string;     // nome (display)
  projetoId?: string;  // uuid
  categoriaId?: string; // uuid
  local: string;
  tipo: string;
  date: string; // ISO date yyyy-mm-dd
}

export const addImagem = async (payload: AddImagemPayload): Promise<string> => {
  const ext = payload.file.name.split(".").pop() ?? "jpg";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

  // 1. Upload file to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("imagens")
    .upload(fileName, payload.file, { cacheControl: "3600", upsert: false });

  if (uploadError) {
    console.error("[imagensStore] upload error:", uploadError);
    throw uploadError;
  }

  // 2. Get public URL
  const { data: urlData } = supabase.storage
    .from("imagens")
    .getPublicUrl(fileName);

  const publicUrl = urlData.publicUrl;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id || null;

  // 3. Insert metadata row in arquivos_midia
  const { data: rowData, error: dbError } = await supabase
    .from("arquivos_midia" as any)
    .insert({
      projeto_id: payload.projetoId || null,
      categoria_id: payload.categoriaId || null,
      nome: payload.file.name,
      tipo_acao: payload.tipo || null,
      data: payload.date || null,
      local: payload.local || null,
      url: publicUrl,
      tipo_arquivo: "imagem",
      created_by: userId,
    })
    .select("*, projetos(nome), categorias(nome)")
    .single();

  if (dbError || !rowData) {
    console.error("[imagensStore] db insert error:", dbError);
    throw dbError ?? new Error("Falha ao salvar metadados da imagem.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nomeProjeto = (rowData as any).projetos?.nome ?? payload.projeto;
  const nomeCategoria = (rowData as any).categorias?.nome ?? undefined;
  const nova = rowToImagem({ ...(rowData as any), nome_projeto: nomeProjeto, nome_categoria: nomeCategoria });
  imagens = [nova, ...imagens];
  emit();
  return nova.id;
};

export const updateImagem = async (
  id: string,
  patch: Partial<Pick<ImagemItem, "projeto" | "local" | "tipo" | "date" | "projetoId" | "categoriaId">>
) => {
  const updatePayload: Record<string, unknown> = {};
  if (patch.projetoId !== undefined) updatePayload.projeto_id = patch.projetoId;
  if (patch.categoriaId !== undefined) updatePayload.categoria_id = patch.categoriaId || null;
  if (patch.local !== undefined) updatePayload.local = patch.local;
  if (patch.tipo !== undefined) updatePayload.tipo_acao = patch.tipo;
  if (patch.date !== undefined) {
    // Accept dd/mm/yyyy or ISO
    if (patch.date.includes("/")) {
      const [d, m, y] = patch.date.split("/");
      updatePayload.data = `${y}-${m}-${d}`;
    } else {
      updatePayload.data = patch.date;
    }
  }

  const { data, error } = await supabase
    .from("arquivos_midia" as any)
    .update(updatePayload)
    .eq("id", id)
    .select("*, projetos(nome), categorias(nome)")
    .single();

  if (error || !data) {
    console.error("[imagensStore] update error:", error);
    throw error ?? new Error("Falha ao atualizar metadados da imagem.");
  }

  const nomeProjeto = (data as any).projetos?.nome ?? patch.projeto ?? "";
  const nomeCategoria = (data as any).categorias?.nome ?? undefined;
  const updatedItem = rowToImagem({ ...(data as any), nome_projeto: nomeProjeto, nome_categoria: nomeCategoria });

  imagens = imagens.map((i) => (i.id === id ? updatedItem : i));
  emit();
};

export const removeImagem = async (id: string) => {
  // Find the file so we can also remove from Storage
  const img = imagens.find((i) => i.id === id);

  const { error } = await supabase.from("arquivos_midia" as any).delete().eq("id", id);
  if (error) {
    console.error("[imagensStore] delete error:", error);
    throw error;
  }

  // Atualiza o estado local imediatamente após o delete do banco —
  // isso garante que a UI remove o card sem depender da operação de Storage.
  imagens = imagens.filter((i) => i.id !== id);
  emit();

  // Best-effort delete from Storage (não-bloqueante: falha não afeta a UI)
  if (img?.url) {
    const parts = img.url.split("/imagens/");
    if (parts[1]) {
      supabase.storage
        .from("imagens")
        .remove([parts[1]])
        .catch((err) => console.warn("[imagensStore] storage remove warning:", err));
    }
  }
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useImagens = (): ImagemItem[] => {
  useEffect(() => {
    initImagens();
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => imagens,
    () => imagens
  );
};

export const useCategorias = (): CategoriaItem[] => {
  useEffect(() => {
    initCategorias();
  }, []);

  return useSyncExternalStore(
    subscribeC,
    () => categorias,
    () => categorias
  );
};
