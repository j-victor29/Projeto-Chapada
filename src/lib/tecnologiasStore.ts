import { useSyncExternalStore, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trimText, toTitleCase } from "@/utils/sanitize";

export type CategoriaTec =
  | "hidrica"
  | "saneamento"
  | "ambiente"
  | "alimentacao"
  | "energia"
  | "agroecologia"
  | "inclusao"
  | "formacao"
  | "comunicacao";

export interface Tecnologia {
  id: string;
  categoria: CategoriaTec;
  nome: string;
  quantidade: number;
  unidade: string;
  familias?: number;
  municipios: string;
  comunidades?: string;
  projetoId?: string;
  data: string;
  observacoes?: string;
}

const catToLineId: Record<CategoriaTec, number> = {
  hidrica: 1,
  saneamento: 2,
  energia: 3,
  agroecologia: 4,
  alimentacao: 5,
  inclusao: 6,
  formacao: 7,
  ambiente: 8,
  comunicacao: 9,
};

const lineIdToCat: Record<number, CategoriaTec> = {
  1: "hidrica",
  2: "saneamento",
  3: "energia",
  4: "agroecologia",
  5: "alimentacao",
  6: "inclusao",
  7: "formacao",
  8: "ambiente",
  9: "comunicacao",
};

export const CATEGORIA_ORDEM: CategoriaTec[] = [
  "hidrica",
  "saneamento",
  "energia",
  "agroecologia",
  "alimentacao",
  "inclusao",
  "formacao",
  "ambiente",
  "comunicacao",
];

export const CATEGORIAS: Record<
  CategoriaTec,
  {
    label: string;
    emoji: string;
    color: string;
    exemplos: string[];
    unidades: string[];
    mostraFamilias?: boolean;
  }
> = {
  hidrica: {
    label: "Convivência com o Semiárido e Segurança Hídrica",
    emoji: "💧",
    color: "#1A9FD4",
    exemplos: [
      "Cisternas de consumo humano",
      "Cisternas calçadão",
      "Barreiro trincheira",
      "Reuso de águas cinzas",
      "Sistemas simplificados de irrigação",
      "Captação e armazenamento de água da chuva",
      "Barragens subterrâneas",
    ],
    unidades: ["unidades"],
  },
  saneamento: {
    label: "Saneamento Rural",
    emoji: "🚿",
    color: "#4CAF50",
    exemplos: ["Banheiro redondo"],
    unidades: ["unidades"],
  },
  ambiente: {
    label: "Meio Ambiente e Restauração Ecológica",
    emoji: "🌳",
    color: "#33691E",
    exemplos: [
      "Recuperação de áreas degradadas",
      "Produção de mudas nativas",
      "Plantio de mudas",
      "Manejo sustentável da Caatinga",
    ],
    unidades: ["hectares", "unidades"],
  },
  alimentacao: {
    label: "Segurança Alimentar e Nutricional",
    emoji: "🌽",
    color: "#E65100",
    exemplos: [
      "Hortas comunitárias",
      "Beneficiamento de alimentos",
      "Produção de polpas e derivados",
    ],
    unidades: ["unidades", "famílias"],
    mostraFamilias: true,
  },
  energia: {
    label: "Energias Renováveis",
    emoji: "⚡",
    color: "#F5A623",
    exemplos: [
      "Sistemas fotovoltaicos para produção agrícola",
      "Energia solar residencial",
      "Bombeamento solar",
      "Biodigestores",
    ],
    unidades: ["unidades"],
  },
  agroecologia: {
    label: "Agroecologia e Produção Sustentável",
    emoji: "🌱",
    color: "#2E7D32",
    exemplos: [
      "Quintais produtivos agroecológicos",
      "Sistemas agroflorestais (SAFs)",
      "Adubação verde",
      "Compostagem",
      "Biofertilizantes",
      "Produção agroecológica da mandioca",
      "Bancos comunitários de sementes crioulas",
      "Manejo ecológico do solo",
    ],
    unidades: ["unidades", "hectares", "famílias"],
    mostraFamilias: true,
  },
  inclusao: {
    label: "Inclusão Socioprodutiva e Economia Solidária",
    emoji: "🤝",
    color: "#7B1FA2",
    exemplos: [
      "Casas de farinha",
      "Agroindústrias familiares",
      "Apicultura sustentável",
      "Comercialização coletiva",
      "Grupos produtivos de mulheres e juventudes",
      "Feiras agroecológicas",
    ],
    unidades: ["unidades", "famílias"],
    mostraFamilias: true,
  },
  formacao: {
    label: "Formação, ATER e Gestão Social",
    emoji: "📚",
    color: "#1565C0",
    exemplos: [
      "Diagnóstico Rural Participativo (DRP)",
      "Intercâmbios de experiências",
      "Formação de agentes multiplicadores",
      "Dias de campo",
      "Planejamento participativo comunitário",
    ],
    unidades: ["unidades"],
  },
  comunicacao: {
    label: "Comunicação Popular e Mobilização Social",
    emoji: "📻",
    color: "#C62828",
    exemplos: [
      "Programas de rádio",
      "Produção de vídeos populares",
      "Sistematização de experiências",
    ],
    unidades: ["unidades"],
  },
};

let tecnologias: Tecnologia[] = [];

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const emit = () => listeners.forEach((l) => l());

export const fetchTecnologias = async () => {
  try {
    const { data, error } = await supabase
      .from("projeto_tecnologias")
      .select(`
        id,
        projeto_id,
        quantidade,
        unidade,
        familias,
        municipios,
        comunidades,
        data,
        observacoes,
        tecnologias (
          nome,
          linha_acao
        )
      `);

    if (error) {
      console.error("[TecnologiasStore] error fetching from Supabase:", error);
      return;
    }

    if (data) {
      tecnologias = data.map((row: any) => {
        const linha = row.tecnologias?.linha_acao || "";
        const foundCat = (Object.keys(CATEGORIAS) as CategoriaTec[]).find(
          (key) => CATEGORIAS[key].label === linha
        );
        const categoria: CategoriaTec = foundCat || "hidrica";

        return {
          id: row.id,
          categoria,
          nome: row.tecnologias?.nome || "",
          quantidade: row.quantidade,
          unidade: row.unidade,
          familias: row.familias || undefined,
          municipios: row.municipios || "",
          comunidades: row.comunidades || undefined,
          projetoId: row.projeto_id || undefined,
          data: row.data || new Date().toISOString().slice(0, 10),
          observacoes: row.observacoes || undefined,
        };
      });
      emit();
    }
  } catch (err) {
    console.error("[TecnologiasStore] exception during fetch:", err);
  }
};

const getOrCreateCatalogTechId = async (nome: string, categoria: CategoriaTec): Promise<string | null> => {
  try {
    const sanitizedNome = toTitleCase(nome);
    const { data } = await supabase
      .from("tecnologias")
      .select("id")
      .eq("nome", sanitizedNome)
      .maybeSingle();

    if (data) return data.id;

    const { data: newTech, error } = await supabase
      .from("tecnologias")
      .insert({
        nome: sanitizedNome,
        linha_acao: CATEGORIAS[categoria]?.label || "Convivência com o Semiárido e Segurança Hídrica",
        ativo: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[TecnologiasStore] error inserting catalog tech:", error);
      return null;
    }
    return newTech?.id || null;
  } catch (err) {
    console.error("[TecnologiasStore] exception in getOrCreateCatalogTechId:", err);
    return null;
  }
};

export const addTecnologia = async (t: Omit<Tecnologia, "id">): Promise<string> => {
  const id = crypto.randomUUID();
  // Optimistic update: item aparece imediatamente na UI
  tecnologias = [{ ...t, id }, ...tecnologias];
  emit();

  try {
    const techId = await getOrCreateCatalogTechId(t.nome, t.categoria);
    if (!techId) {
      console.error("[TecnologiasStore] failed to get/create catalog tech — keeping optimistic state");
      return id;
    }

    const { error } = await supabase.from("projeto_tecnologias").insert({
      id,
      projeto_id: t.projetoId || null,
      tecnologia_id: techId,
      quantidade: t.quantidade,
      unidade: trimText(t.unidade),
      familias: t.familias || null,
      municipios: t.municipios ? trimText(t.municipios) : null,
      comunidades: t.comunidades ? trimText(t.comunidades) : null,
      data: t.data || null,
      observacoes: t.observacoes ? trimText(t.observacoes) : null,
    });

    if (error) {
      console.error("[TecnologiasStore] error adding technology:", error);
    }
    // Re-fetch após o INSERT estar confirmado no banco
    await fetchTecnologias();
  } catch (err) {
    console.error("[TecnologiasStore] exception in addTecnologia:", err);
  }

  return id;
};

export const updateTecnologia = async (id: string, t: Omit<Tecnologia, "id">): Promise<void> => {
  // Optimistic update
  tecnologias = tecnologias.map((it) => (it.id === id ? { ...t, id } : it));
  emit();

  try {
    const techId = await getOrCreateCatalogTechId(t.nome, t.categoria);
    if (!techId) {
      console.error("[TecnologiasStore] failed to get/create catalog tech for update");
      return;
    }

    const { error } = await supabase
      .from("projeto_tecnologias")
      .update({
        projeto_id: t.projetoId || null,
        tecnologia_id: techId,
        quantidade: t.quantidade,
        unidade: trimText(t.unidade),
        familias: t.familias || null,
        municipios: t.municipios ? trimText(t.municipios) : null,
        comunidades: t.comunidades ? trimText(t.comunidades) : null,
        data: t.data || null,
        observacoes: t.observacoes ? trimText(t.observacoes) : null,
      })
      .eq("id", id);

    if (error) {
      console.error("[TecnologiasStore] error updating technology:", error);
    }
    await fetchTecnologias();
  } catch (err) {
    console.error("[TecnologiasStore] exception in updateTecnologia:", err);
  }
};

export const deleteTecnologia = async (id: string): Promise<void> => {
  // Optimistic update
  tecnologias = tecnologias.filter((it) => it.id !== id);
  emit();

  try {
    const { error } = await supabase
      .from("projeto_tecnologias")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[TecnologiasStore] error deleting technology:", error);
    }
    await fetchTecnologias();
  } catch (err) {
    console.error("[TecnologiasStore] exception in deleteTecnologia:", err);
  }
};

export const useTecnologias = () => {
  useEffect(() => {
    fetchTecnologias();
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => tecnologias,
    () => tecnologias,
  );
};

export const getTotalTecnologias = () =>
  tecnologias.reduce((acc, t) => acc + (Number(t.quantidade) || 0), 0);

export const useTotalTecnologias = () => {
  const list = useTecnologias();
  return list.reduce((acc, t) => acc + (Number(t.quantidade) || 0), 0);
};
