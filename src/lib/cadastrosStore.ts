import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Municipio {
  id: string;
  nome: string;
  uf: string;
  regiao?: string | null;
  created_at?: string;
  codigo_ibge?: string | null;
  estado?: string | null;
  microrregiao?: string | null;
}

export interface Comunidade {
  id: string;
  nome: string;
  municipio_id?: string | null;
  tipo?: string | null;
  categoria?: string | null;
  created_at?: string;
}

export interface Financiador {
  id: string;
  nome: string;
  tipo?: string | null;
  contato?: string | null;
  site?: string | null;
  cnpj?: string | null;
  created_at?: string;
}

export interface Categoria {
  id: string;
  nome: string;
  tipo: string;
  cor?: string | null;
  icone?: string | null;
  created_at?: string;
}

export interface Publico {
  id: string;
  nome: string;
  descricao?: string | null;
  created_at?: string;
}

export interface Familia {
  id: string;
  nome_responsavel: string;
  cpf?: string | null;
  nis?: string | null;
  municipio_id?: string | null;
  comunidade_id?: string | null;
  quilombola?: boolean | null;
  povo_originario?: boolean | null;
  quantidade_familiares?: number;
  genero?: string | null;
  faixa_etaria?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LinhaAcao {
  id: string;
  nome: string;
  ativo?: boolean;
  created_at?: string;
}

export interface CatalogoTecnologia {
  id: string;
  nome: string;
  linha_acao: string;
  ativo?: boolean;
  created_at?: string;
}

function makeCrud<T extends { id: string }>(
  table: string,
  key: string,
  defaultSort: string = "nome"
) {
  const QK = [key] as const;
  return {
    useList: () =>
      useQuery({
        queryKey: QK,
        queryFn: async (): Promise<T[]> => {
          const { data, error } = await supabase
            .from(table)
            .select("*")
            .order(defaultSort);
          if (error) throw error;
          return (data ?? []) as T[];
        },
      }),

    useUpsert: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: async (row: Partial<T> & { id?: string }) => {
          const payload = { ...row };

          // Especial: para a tabela beneficiarios (Familias), manter documento_identificador sincronizado
          if (table === "beneficiarios") {
            const fam = payload as any;
            fam.documento_identificador = fam.cpf || fam.nis || null;
            // Garantir que campos obrigatórios de beneficiarios tenham valores de fallback defensivos
            if (!fam.quantidade_familiares) {
              fam.quantidade_familiares = 1;
            }
            if (!fam.genero) {
              fam.genero = "Outro";
            }
            if (!fam.faixa_etaria) {
              fam.faixa_etaria = "Adulto";
            }
          }

          if (row.id) {
            const { id, created_at, updated_at, ...rest } = payload as any;
            const { error } = await supabase
              .from(table)
              .update(rest)
              .eq("id", id);
            if (error) throw error;
          } else {
            const { id, created_at, updated_at, ...rest } = payload as any;
            const { error } = await supabase
              .from(table)
              .insert(rest);
            if (error) throw error;
          }
        },
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: QK });
        },
      });
    },

    useDelete: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: async (id: string) => {
          const { error } = await supabase.from(table).delete().eq("id", id);
          if (error) throw error;
        },
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: QK });
        },
      });
    },
  };
}

export interface TipoAcao {
  id: string;
  nome: string;
  padrao: boolean;
  criado_via?: string | null;
  created_at?: string;
}

export const Municipios = makeCrud<Municipio>("municipios", "municipios");
export const Comunidades = makeCrud<Comunidade>("comunidades", "comunidades");
export const Financiadores = makeCrud<Financiador>("financiadores", "financiadores");
export const Categorias = makeCrud<Categoria>("categorias", "categorias");
export const Publicos = makeCrud<Publico>("publicos", "publicos");
export const Familias = makeCrud<Familia>("beneficiarios", "familias", "nome_responsavel");
export const TiposAcao = makeCrud<TipoAcao>("tipos_acao", "tipos_acao");

// ─── Linhas de Ação ──────────────────────────────────────────────────────────
export const LinhasAcao = {
  useList: () =>
    useQuery({
      queryKey: ["linhas_acao"] as const,
      queryFn: async (): Promise<LinhaAcao[]> => {
        const { data, error } = await supabase
          .from("linhas_acao")
          .select("*")
          .eq("ativo", true)
          .order("nome");
        if (error) throw error;
        return (data ?? []) as LinhaAcao[];
      },
    }),

  useCreate: () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (nome: string) => {
        const { data, error } = await supabase
          .from("linhas_acao")
          .insert({ nome })
          .select("id, nome, ativo")
          .single();
        if (error) throw error;
        return data as LinhaAcao;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ["linhas_acao"] }),
    });
  },
};

// ─── Catálogo de Tecnologias (tabela tecnologias) ────────────────────────────
export const CatalogoTecnologias = {
  useList: () =>
    useQuery({
      queryKey: ["catalogo_tecnologias"] as const,
      queryFn: async (): Promise<CatalogoTecnologia[]> => {
        const { data, error } = await supabase
          .from("tecnologias")
          .select("id, nome, linha_acao, ativo")
          .order("linha_acao")
          .order("nome");
        if (error) throw error;
        return (data ?? []) as CatalogoTecnologia[];
      },
    }),

  useUpsert: () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (row: Partial<CatalogoTecnologia> & { id?: string }) => {
        if (row.id) {
          const { id, created_at, ...rest } = row as any;
          const { error } = await supabase
            .from("tecnologias")
            .update(rest)
            .eq("id", id);
          if (error) throw error;
        } else {
          const { id, created_at, ...rest } = row as any;
          const { error } = await supabase
            .from("tecnologias")
            .insert({ ...rest, ativo: true });
          if (error) throw error;
        }
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ["catalogo_tecnologias"] }),
    });
  },

  useDeactivate: () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase
          .from("tecnologias")
          .update({ ativo: false })
          .eq("id", id);
        if (error) throw error;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ["catalogo_tecnologias"] }),
    });
  },

  useReactivate: () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase
          .from("tecnologias")
          .update({ ativo: true })
          .eq("id", id);
        if (error) throw error;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ["catalogo_tecnologias"] }),
    });
  },
};
