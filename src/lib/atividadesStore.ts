import { useSyncExternalStore, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trimText } from "@/utils/sanitize";

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
  titulo?: string;
  data: string; // ISO date
  tipo: string;
  descricao: string;
  local: string;
  municipio?: string;
  responsaveis: string;
  anexos?: { nome: string; dataUrl: string }[];
  indicadores?: AtividadeIndicadores;
  editado?: boolean;
  arquivosMidia?: any[];
  created_by?: string | null;
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

let atividadesIndependentes: AtividadeFull[] = [];
let initializedIndependentes = false;

const listenersIndependentes = new Set<() => void>();

const subscribeIndependentes = (cb: () => void) => {
  listenersIndependentes.add(cb);
  return () => {
    listenersIndependentes.delete(cb);
  };
};

const emitIndependentes = () => listenersIndependentes.forEach((l) => l());

const sortDesc = (arr: AtividadeFull[]) =>
  [...arr].sort((x, y) => y.data.localeCompare(x.data));

// ─── Auxiliares para Upload de Anexos ──────────────────────────────────────────

const dataURLtoFile = (dataurl: string, filename: string): File => {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] ?? '';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

const isImageFile = (file: File): boolean => {
  return file.type.startsWith('image/') || 
         /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(file.name);
};

const getOrCreateAtividadesCategoria = async (): Promise<string> => {
  const { data: cat, error } = await supabase
    .from("categorias")
    .select("id")
    .eq("nome", "Atividades")
    .maybeSingle();

  if (cat) return cat.id;

  const { data: newCat, error: insertError } = await supabase
    .from("categorias")
    .insert({
      nome: "Atividades",
      tipo: "geral"
    })
    .select("id")
    .single();

  if (insertError || !newCat) {
    console.error("Erro ao criar categoria Atividades:", insertError);
    throw insertError ?? new Error("Erro ao criar categoria Atividades.");
  }

  return newCat.id;
};

const getOrCreateAcoesIndependentesCategoria = async (): Promise<string> => {
  const { data: cat, error } = await supabase
    .from("categorias")
    .select("id")
    .eq("nome", "Ações Independentes")
    .maybeSingle();

  if (cat) return cat.id;

  const { data: newCat, error: insertError } = await supabase
    .from("categorias")
    .insert({
      nome: "Ações Independentes",
      tipo: "geral"
    })
    .select("id")
    .single();

  if (insertError || !newCat) {
    console.error("Erro ao criar categoria Ações Independentes:", insertError);
    throw insertError ?? new Error("Erro ao criar categoria Ações Independentes.");
  }

  return newCat.id;
};

export const processAnexosAtividade = async (
  atividadeId: string,
  projetoId: string | null,
  anexosForm: any[],
  anexosOriginais: any[] = []
) => {
  // 1. Identificar excluídos
  const originalIds = anexosOriginais.map(a => a.id).filter(Boolean);
  const formIds = anexosForm.map(a => a.id).filter(Boolean);
  const deletedIds = originalIds.filter(id => !formIds.includes(id));

  for (const id of deletedIds) {
    const orig = anexosOriginais.find(o => o.id === id);
    if (!orig) continue;

    if (orig.tipo_arquivo === 'documento') {
      const { data: doc } = await supabase
        .from("documentos")
        .select("id, storage_path")
        .eq("titulo", orig.nome)
        .eq("projeto_id", projetoId)
        .maybeSingle();

      if (doc) {
        await supabase.from("documentos").delete().eq("id", doc.id);
        if (doc.storage_path) {
          await supabase.storage.from("documentos").remove([doc.storage_path]);
        }
      }
    } else {
      if (orig.url) {
        const parts = orig.url.split("/imagens/");
        if (parts[1]) {
          await supabase.storage.from("imagens").remove([parts[1]]);
        }
      }
    }
    await supabase.from("arquivos_midia").delete().eq("id", id);
  }

  // 2. Upload de novos anexos
  const novosAnexos = anexosForm.filter(a => a.dataUrl && a.dataUrl.startsWith("data:"));
  if (novosAnexos.length === 0) return;

  const isIndependent = !projetoId;
  const categoriaId = isIndependent 
    ? await getOrCreateAcoesIndependentesCategoria()
    : await getOrCreateAtividadesCategoria();
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;

  for (const anexo of novosAnexos) {
    try {
      const file = dataURLtoFile(anexo.dataUrl, anexo.nome);
      const isImg = isImageFile(file);

      if (isImg) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("imagens")
          .upload(fileName, file, { cacheControl: "3600", upsert: false });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("imagens").getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;

        await supabase.from("arquivos_midia").insert({
          projeto_id: projetoId || null,
          atividade_id: atividadeId,
          categoria_id: categoriaId,
          nome: file.name,
          url: publicUrl,
          tipo_arquivo: "imagem",
          data: new Date().toISOString().split("T")[0],
        });

      } else {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${uid ?? "anon"}/${crypto.randomUUID()}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("documentos")
          .upload(path, file, {
            contentType: file.type,
            upsert: false,
          });

        if (upErr) throw upErr;

        const { data: newDoc, error: docInsertErr } = await supabase
          .from("documentos")
          .insert({
            titulo: file.name,
            descricao: isIndependent 
              ? `Anexo da Ação Independente: ${atividadeId}` 
              : `Anexo da Atividade: ${atividadeId}`,
            categoria_id: categoriaId,
            projeto_id: projetoId || null,
            storage_path: path,
            mime_type: file.type,
            tamanho: file.size,
            versao: 1,
            created_by: uid,
          })
          .select("id")
          .single();

        if (docInsertErr) {
          await supabase.storage.from("documentos").remove([path]);
          throw docInsertErr;
        }

        const { data: urlData } = supabase.storage.from("documentos").getPublicUrl(path);
        const fileUrl = urlData.publicUrl;

        await supabase.from("arquivos_midia").insert({
          projeto_id: projetoId || null,
          atividade_id: atividadeId,
          categoria_id: categoriaId,
          nome: file.name,
          url: fileUrl,
          tipo_arquivo: "documento",
          data: new Date().toISOString().split("T")[0],
        });
      }
    } catch (err) {
      console.error(`Erro ao fazer upload do anexo ${anexo.nome}:`, err);
    }
  }
};

// ─── Database Row → AtividadeFull ─────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAtividade(row: any): AtividadeFull {
  const arquivosMidiaMapped = (row.arquivos_midia ?? []).map((am: any) => ({
    id: am.id,
    nome: am.nome,
    url: am.url,
    tipo_arquivo: am.tipo_arquivo,
  }));

  const anexosMapped = row.anexos ?? (arquivosMidiaMapped.length > 0 
    ? arquivosMidiaMapped.map((am: any) => ({
        id: am.id,
        nome: am.nome,
        url: am.url,
        tipo_arquivo: am.tipo_arquivo,
      }))
    : undefined);

  return {
    id: row.id,
    projetoId: row.projeto_id ?? "",
    titulo: row.titulo ?? "",
    data: row.data ?? "",
    tipo: row.tipo ?? "",
    descricao: row.descricao ?? "",
    local: row.local ?? "",
    municipio: row.municipio ?? undefined,
    responsaveis: row.responsaveis ?? "",
    indicadores: row.indicadores ?? undefined,
    anexos: anexosMapped,
    arquivosMidia: arquivosMidiaMapped,
    created_by: row.created_by,
  };
}

// ─── Initialize (lazy, called once) ───────────────────────────────────────────
export const initAtividades = async () => {
  if (initialized) return;
  initialized = true;

  const { data, error } = await (supabase
    .from("atividades")
    .select("*, arquivos_midia(*)")
    .not("projeto_id", "is", null)
    .order("data", { ascending: false }) as any);

  if (error) {
    console.error("[atividadesStore] init error:", error);
    return;
  }

  atividades = sortDesc((data ?? []).map(rowToAtividade));
  emit();
};

export const initAtividadesIndependentes = async () => {
  if (initializedIndependentes) return;
  initializedIndependentes = true;

  const { data, error } = await (supabase
    .from("atividades")
    .select("*, arquivos_midia(*)")
    .is("projeto_id", null)
    .order("data", { ascending: false }) as any);

  if (error) {
    console.error("[atividadesStore] init independentes error:", error);
    return;
  }

  atividadesIndependentes = sortDesc((data ?? []).map(rowToAtividade));
  emitIndependentes();
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export const addAtividade = async (
  a: Omit<AtividadeFull, "id">
): Promise<string> => {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id || null;

  const { data, error } = await supabase
    .from("atividades")
    .insert({
      projeto_id: a.projetoId || null,
      titulo: a.titulo ? trimText(a.titulo) : null,
      data: a.data,
      tipo: a.tipo ? trimText(a.tipo) : a.tipo,
      descricao: trimText(a.descricao),
      local: a.local ? trimText(a.local) : null,
      municipio: a.municipio ? trimText(a.municipio) : null,
      responsaveis: a.responsaveis ? trimText(a.responsaveis) : null,
      indicadores: a.indicadores || null,
      anexos: null,
      created_by: userId,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[atividadesStore] insert error:", error);
    throw error ?? new Error("Falha ao salvar atividade.");
  }

  if (a.anexos && a.anexos.length > 0) {
    await processAnexosAtividade(data.id, data.projeto_id, a.anexos, []);
  }

  const { data: updatedData } = await (supabase
    .from("atividades")
    .select("*, arquivos_midia(*)")
    .eq("id", data.id)
    .single() as any);

  const novo = rowToAtividade(updatedData || data);
  if (novo.projetoId) {
    atividades = sortDesc([novo, ...atividades]);
    emit();
  } else {
    atividadesIndependentes = sortDesc([novo, ...atividadesIndependentes]);
    emitIndependentes();
  }
  return novo.id;
};

export const updateAtividade = async (
  id: string,
  patch: Partial<AtividadeFull>
) => {
  const updatePayload: Record<string, unknown> = {};
  if (patch.projetoId !== undefined) updatePayload.projeto_id = patch.projetoId || null;
  if (patch.titulo !== undefined) updatePayload.titulo = patch.titulo ? trimText(patch.titulo) : null;
  if (patch.data !== undefined) updatePayload.data = patch.data;
  if (patch.tipo !== undefined) updatePayload.tipo = patch.tipo ? trimText(patch.tipo) : patch.tipo;
  if (patch.descricao !== undefined) updatePayload.descricao = trimText(patch.descricao);
  if (patch.local !== undefined) updatePayload.local = patch.local ? trimText(patch.local) : null;
  if (patch.municipio !== undefined) updatePayload.municipio = patch.municipio ? trimText(patch.municipio) : null;
  if (patch.responsaveis !== undefined)
    updatePayload.responsaveis = patch.responsaveis ? trimText(patch.responsaveis) : null;
  if (patch.indicadores !== undefined)
    updatePayload.indicadores = patch.indicadores || null;

  const { error } = await supabase
    .from("atividades")
    .update(updatePayload)
    .eq("id", id);

  if (error) {
    console.error("[atividadesStore] update error:", error);
    throw error;
  }

  if (patch.anexos !== undefined) {
    const { data: currentMidias } = await supabase
      .from("arquivos_midia")
      .select("id, nome, url, tipo_arquivo")
      .eq("atividade_id", id);

    const anexosOriginais = (currentMidias ?? []).map(cm => ({
      id: cm.id,
      nome: cm.nome,
      url: cm.url,
      tipo_arquivo: cm.tipo_arquivo,
    }));

    await processAnexosAtividade(id, patch.projetoId || null, patch.anexos, anexosOriginais);
  }

  const { data: updatedData } = await (supabase
    .from("atividades")
    .select("*, arquivos_midia(*)")
    .eq("id", id)
    .single() as any);

  const updatedAtividade = rowToAtividade(updatedData);

  if (patch.projetoId || atividades.some((a) => a.id === id)) {
    atividades = sortDesc(
      atividades.map((a) => (a.id === id ? { ...updatedAtividade, editado: true } : a))
    );
    emit();
  }
  if (!patch.projetoId || atividadesIndependentes.some((a) => a.id === id)) {
    atividadesIndependentes = sortDesc(
      atividadesIndependentes.map((a) => (a.id === id ? { ...updatedAtividade, editado: true } : a))
    );
    emitIndependentes();
  }
};

export const deleteAtividade = async (id: string) => {
  const { error } = await supabase.from("atividades").delete().eq("id", id);
  if (error) {
    console.error("[atividadesStore] delete error:", error);
    throw error;
  }
  atividades = atividades.filter((a) => a.id !== id);
  emit();
  atividadesIndependentes = atividadesIndependentes.filter((a) => a.id !== id);
  emitIndependentes();
};

export const refreshAtividades = async () => {
  initialized = false;
  initializedIndependentes = false;
  await Promise.all([initAtividades(), initAtividadesIndependentes()]);
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

export const useAtividadesIndependentes = (): AtividadeFull[] => {
  useEffect(() => {
    initAtividadesIndependentes();
  }, []);

  return useSyncExternalStore(
    subscribeIndependentes,
    () => atividadesIndependentes,
    () => atividadesIndependentes
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

