import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// TypeScript interfaces
export interface Documento {
  id: string;
  titulo: string;
  descricao?: string | null;
  categoria_id?: string | null;
  projeto_id?: string | null;
  storage_path?: string | null;
  mime_type?: string | null;
  tamanho?: number | null;
  versao: number;
  documento_pai_id?: string | null;
  tags?: string[] | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Categoria {
  id: string;
  nome: string;
  tipo: string;
  created_at: string;
}

// TanStack Query keys
const QK_DOCUMENTOS = ["documentos"] as const;
const QK_CATEGORIAS = ["categorias"] as const;

/**
 * Hook to query all documents
 */
export function useDocumentos() {
  return useQuery({
    queryKey: QK_DOCUMENTOS,
    queryFn: async (): Promise<Documento[]> => {
      const { data, error } = await supabase
        .from("documentos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Documento[];
    },
  });
}

/**
 * Hook to query categories
 */
export function useCategorias() {
  return useQuery({
    queryKey: QK_CATEGORIAS,
    queryFn: async (): Promise<Categoria[]> => {
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Categoria[];
    },
  });
}

/**
 * Hook to handle upload and metadata insertion
 */
export function useUploadDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      titulo: string;
      descricao?: string;
      categoria_id?: string | null;
      projeto_id?: string | null;
      file: File;
      tags?: string[];
      documento_pai_id?: string | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      const ext = input.file.name.split(".").pop() ?? "bin";
      const path = `${uid ?? "anon"}/${crypto.randomUUID()}.${ext}`;

      // 1. Upload to Supabase Storage (bucket is 'documentos')
      const { error: upErr } = await supabase.storage
        .from("documentos")
        .upload(path, input.file, {
          contentType: input.file.type,
          upsert: false,
        });
      if (upErr) throw upErr;

      // 2. Determine version number if a parent document is specified
      let versao = 1;
      if (input.documento_pai_id) {
        const { data: pai, error: paiError } = await supabase
          .from("documentos")
          .select("versao")
          .eq("id", input.documento_pai_id)
          .maybeSingle();
        
        if (!paiError && pai) {
          versao = (pai.versao ?? 1) + 1;
        }
      }

      // 3. Insert metadata into public.documentos
      const { data, error } = await supabase.from("documentos").insert({
        titulo: input.titulo,
        descricao: input.descricao ?? null,
        categoria_id: input.categoria_id ?? null,
        projeto_id: input.projeto_id ?? null,
        storage_path: path,
        mime_type: input.file.type,
        tamanho: input.file.size,
        versao,
        documento_pai_id: input.documento_pai_id ?? null,
        tags: input.tags ?? [],
        created_by: uid,
      })
      .select()
      .single();

      if (error) {
        // Rollback storage upload in case database insert fails
        await supabase.storage.from("documentos").remove([path]);
        throw error;
      }
      return data as Documento;
    },
    onSuccess: (data) => {
      qc.setQueriesData({ queryKey: QK_DOCUMENTOS }, (prev: Documento[] | undefined) => {
        if (!prev) return prev;
        return [data, ...prev];
      });
      qc.setQueriesData({ queryKey: ["documentos-paginated"] }, (prev: any) => {
        if (!prev) return prev;
        const list = Array.isArray(prev.data) ? prev.data : [];
        return {
          ...prev,
          data: [data, ...list],
          count: (prev.count ?? 0) + 1,
        };
      });
      qc.invalidateQueries({ queryKey: QK_DOCUMENTOS });
      qc.invalidateQueries({ queryKey: ["documentos-paginated"] });
    },
  });
}

/**
 * Hook to handle document and storage file deletion
 */
export function useDeleteDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: Documento) => {
      // 1. Delete from database
      const { error } = await supabase
        .from("documentos")
        .delete()
        .eq("id", doc.id);
      if (error) throw error;

      // 2. Delete from storage if storage_path is present (best-effort rollback is not strictly needed)
      if (doc.storage_path) {
        const { error: storageError } = await supabase.storage
          .from("documentos")
          .remove([doc.storage_path]);
        if (storageError) {
          console.warn("[documentosStore] Warning deleting file from storage:", storageError.message);
        }
      }
      return doc.id;
    },
    onSuccess: (deletedId) => {
      qc.setQueriesData({ queryKey: QK_DOCUMENTOS }, (prev: Documento[] | undefined) => {
        if (!prev) return prev;
        return prev.filter((d) => d.id !== deletedId);
      });
      qc.setQueriesData({ queryKey: ["documentos-paginated"] }, (prev: any) => {
        if (!prev) return prev;
        const list = Array.isArray(prev.data) ? prev.data : [];
        return {
          ...prev,
          data: list.filter((d: any) => d.id !== deletedId),
          count: Math.max(0, (prev.count ?? 0) - 1),
        };
      });
      qc.invalidateQueries({ queryKey: QK_DOCUMENTOS });
      qc.invalidateQueries({ queryKey: ["documentos-paginated"] });
    },
  });
}

/**
 * Utility function to obtain a temporary signed URL for file access
 */
export async function getDocumentoUrl(storage_path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("documentos")
    .createSignedUrl(storage_path, 60 * 60);
  if (error) {
    console.error("[documentosStore] error creating signed URL:", error);
    return null;
  }
  return data.signedUrl;
}
