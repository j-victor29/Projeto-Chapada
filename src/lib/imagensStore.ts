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
  // legacy compat – dataUrl agora é um alias de url
  dataUrl?: string;
}

// ─── State ────────────────────────────────────────────────────────────────────
let imagens: ImagemItem[] = [];
let initialized = false;

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
    dataUrl: row.url ?? "",
  };
}

// ─── Initialize ───────────────────────────────────────────────────────────────
export const initImagens = async () => {
  if (initialized) return;
  initialized = true;

  // Join arquivos_midia with projetos to get the project name
  const { data, error } = await supabase
    .from("arquivos_midia" as any)
    .select("*, projetos(nome)")
    .eq("tipo_arquivo", "imagem")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[imagensStore] init error:", error);
    return;
  }

  imagens = (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nomeProjeto = (row as any).projetos?.nome ?? "";
    return rowToImagem({ ...row, nome_projeto: nomeProjeto });
  });
  emit();
};

// ─── Upload + Insert ───────────────────────────────────────────────────────────

export interface AddImagemPayload {
  file: File;
  projeto: string;     // nome (display)
  projetoId?: string;  // uuid
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

  // 3. Insert metadata row in arquivos_midia
  const { data: rowData, error: dbError } = await supabase
    .from("arquivos_midia" as any)
    .insert({
      projeto_id: payload.projetoId || null,
      nome: payload.file.name,
      tipo_acao: payload.tipo || null,
      data: payload.date || null,
      local: payload.local || null,
      url: publicUrl,
      tipo_arquivo: "imagem",
    })
    .select("*, projetos(nome)")
    .single();

  if (dbError || !rowData) {
    console.error("[imagensStore] db insert error:", dbError);
    throw dbError ?? new Error("Falha ao salvar metadados da imagem.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nomeProjeto = (rowData as any).projetos?.nome ?? payload.projeto;
  const nova = rowToImagem({ ...rowData, nome_projeto: nomeProjeto });
  imagens = [nova, ...imagens];
  emit();
  return nova.id;
};

export const updateImagem = async (
  id: string,
  patch: Partial<Pick<ImagemItem, "projeto" | "local" | "tipo" | "date" | "projetoId">>
) => {
  const updatePayload: Record<string, unknown> = {};
  if (patch.projetoId !== undefined) updatePayload.projeto_id = patch.projetoId;
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

  const { error } = await supabase
    .from("arquivos_midia" as any)
    .update(updatePayload)
    .eq("id", id);

  if (error) {
    console.error("[imagensStore] update error:", error);
    throw error;
  }

  imagens = imagens.map((i) => (i.id === id ? { ...i, ...patch } : i));
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

  // Best-effort delete from Storage
  if (img?.url) {
    const parts = img.url.split("/imagens/");
    if (parts[1]) {
      await supabase.storage.from("imagens").remove([parts[1]]);
    }
  }

  imagens = imagens.filter((i) => i.id !== id);
  emit();
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
