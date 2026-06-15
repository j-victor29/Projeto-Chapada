import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { trimText, toTitleCase } from "@/utils/sanitize";

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

          // Sanitize all string fields
          for (const key of Object.keys(payload)) {
            const val = (payload as any)[key];
            if (typeof val === "string") {
              // Apply toTitleCase for "nome" and "nome_responsavel" fields, trimText for others
              if (key === "nome" || key === "nome_responsavel") {
                (payload as any)[key] = toTitleCase(val);
              } else if (key !== "id" && key !== "created_at" && key !== "updated_at") {
                (payload as any)[key] = trimText(val);
              }
            }
          }

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
            const { data, error } = await supabase
              .from(table)
              .update(rest)
              .eq("id", id)
              .select()
              .single();
            if (error) throw error;
            return data as T;
          } else {
            const { id, created_at, updated_at, ...rest } = payload as any;
            const { data, error } = await supabase
              .from(table)
              .insert(rest)
              .select()
              .single();
            if (error) throw error;
            return data as T;
          }
        },
        onSuccess: (data) => {
          qc.setQueriesData({ queryKey: QK }, (prev: T[] | undefined) => {
            if (!prev) return prev;
            const exists = prev.some((item) => item.id === data.id);
            if (exists) {
              return prev.map((item) => (item.id === data.id ? data : item));
            } else {
              return [...prev, data];
            }
          });
          qc.setQueriesData({ queryKey: [`${key}-paginated`] }, (prev: any) => {
            if (!prev) return prev;
            const list = Array.isArray(prev.data) ? prev.data : [];
            const exists = list.some((item: any) => item.id === data.id);
            if (exists) {
              return {
                ...prev,
                data: list.map((item: any) => (item.id === data.id ? data : item)),
              };
            } else {
              return {
                ...prev,
                data: [...list, data],
                count: (prev.count ?? 0) + 1,
              };
            }
          });
          qc.invalidateQueries({ queryKey: QK });
          qc.invalidateQueries({ queryKey: [`${key}-paginated`] });
        },
      });
    },

    useDelete: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: async (id: string) => {
          const { error } = await supabase.from(table).delete().eq("id", id);
          if (error) throw error;
          return id;
        },
        onSuccess: (deletedId) => {
          qc.setQueriesData({ queryKey: QK }, (prev: T[] | undefined) => {
            if (!prev) return prev;
            return prev.filter((item) => item.id !== deletedId);
          });
          qc.setQueriesData({ queryKey: [`${key}-paginated`] }, (prev: any) => {
            if (!prev) return prev;
            const list = Array.isArray(prev.data) ? prev.data : [];
            return {
              ...prev,
              data: list.filter((item: any) => item.id !== deletedId),
              count: Math.max(0, (prev.count ?? 0) - 1),
            };
          });
          qc.invalidateQueries({ queryKey: QK });
          qc.invalidateQueries({ queryKey: [`${key}-paginated`] });
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
        const sanitizedNome = toTitleCase(nome);
        const { data, error } = await supabase
          .from("linhas_acao")
          .insert({ nome: sanitizedNome })
          .select("id, nome, ativo")
          .single();
        if (error) throw error;
        return data as LinhaAcao;
      },
      onSuccess: (data) => {
        qc.setQueriesData({ queryKey: ["linhas_acao"] }, (prev: LinhaAcao[] | undefined) => {
          if (!prev) return prev;
          return [...prev, data];
        });
        qc.invalidateQueries({ queryKey: ["linhas_acao"] });
      },
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
          const { data, error } = await supabase
            .from("tecnologias")
            .update(rest)
            .eq("id", id)
            .select("id, nome, linha_acao, ativo")
            .single();
          if (error) throw error;
          return data as CatalogoTecnologia;
        } else {
          const { id, created_at, ...rest } = row as any;
          const { data, error } = await supabase
            .from("tecnologias")
            .insert({ ...rest, ativo: true })
            .select("id, nome, linha_acao, ativo")
            .single();
          if (error) throw error;
          return data as CatalogoTecnologia;
        }
      },
      onSuccess: (data) => {
        qc.setQueriesData({ queryKey: ["catalogo_tecnologias"] }, (prev: CatalogoTecnologia[] | undefined) => {
          if (!prev) return prev;
          const exists = prev.some((item) => item.id === data.id);
          if (exists) {
            return prev.map((item) => (item.id === data.id ? data : item));
          } else {
            return [...prev, data];
          }
        });
        qc.invalidateQueries({ queryKey: ["catalogo_tecnologias"] });
      },
    });
  },

  useDeactivate: () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { data, error } = await supabase
          .from("tecnologias")
          .update({ ativo: false })
          .eq("id", id)
          .select("id, nome, linha_acao, ativo")
          .single();
        if (error) throw error;
        return data as CatalogoTecnologia;
      },
      onSuccess: (data) => {
        qc.setQueriesData({ queryKey: ["catalogo_tecnologias"] }, (prev: CatalogoTecnologia[] | undefined) => {
          if (!prev) return prev;
          return prev.map((item) => (item.id === data.id ? data : item));
        });
        qc.invalidateQueries({ queryKey: ["catalogo_tecnologias"] });
      },
    });
  },

  useReactivate: () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { data, error } = await supabase
          .from("tecnologias")
          .update({ ativo: true })
          .eq("id", id)
          .select("id, nome, linha_acao, ativo")
          .single();
        if (error) throw error;
        return data as CatalogoTecnologia;
      },
      onSuccess: (data) => {
        qc.setQueriesData({ queryKey: ["catalogo_tecnologias"] }, (prev: CatalogoTecnologia[] | undefined) => {
          if (!prev) return prev;
          return prev.map((item) => (item.id === data.id ? data : item));
        });
        qc.invalidateQueries({ queryKey: ["catalogo_tecnologias"] });
      },
    });
  },

  useDelete: () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from("tecnologias").delete().eq("id", id);
        if (error) throw error;
        return id;
      },
      onSuccess: (deletedId) => {
        qc.setQueriesData({ queryKey: ["catalogo_tecnologias"] }, (prev: CatalogoTecnologia[] | undefined) => {
          if (!prev) return prev;
          return prev.filter((item) => item.id !== deletedId);
        });
        qc.invalidateQueries({ queryKey: ["catalogo_tecnologias"] });
      },
    });
  },
};
