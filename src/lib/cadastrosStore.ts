import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Municipio {
  id: string;
  nome: string;
  uf: string;
  regiao?: string | null;
  created_at?: string;
}

export interface Comunidade {
  id: string;
  nome: string;
  municipio_id?: string | null;
  tipo?: string | null;
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

export const Municipios = makeCrud<Municipio>("municipios", "municipios");
export const Comunidades = makeCrud<Comunidade>("comunidades", "comunidades");
export const Financiadores = makeCrud<Financiador>("financiadores", "financiadores");
export const Categorias = makeCrud<Categoria>("categorias", "categorias");
export const Publicos = makeCrud<Publico>("publicos", "publicos");
export const Familias = makeCrud<Familia>("beneficiarios", "familias", "nome_responsavel");
