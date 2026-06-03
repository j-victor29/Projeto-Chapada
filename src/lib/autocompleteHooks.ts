import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

// ─── Utilitário: Title Case ──────────────────────────────────────────────────
export function toTitleCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// ─── Hook: Autocomplete de Comunidades ──────────────────────────────────────
export function useComunidadesAutocomplete(query: string) {
  const [suggestions, setSuggestions] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from("comunidades")
        .select("id, nome")
        .ilike("nome", `%${query.trim()}%`)
        .order("nome")
        .limit(8);
      setSuggestions(data ?? []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return { suggestions, loading };
}

// ─── Hook: Autocomplete de Municípios (IBGE) ─────────────────────────────────
export function useIbgeAutocomplete(query: string) {
  const { data: ibgeMuns = [], isLoading } = useQuery({
    queryKey: ["ibge-municipios"],
    queryFn: async () => {
      const res = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios");
      if (!res.ok) throw new Error("Erro ao buscar municípios do IBGE");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return res.json() as Promise<any[]>;
    },
    staleTime: 1000 * 60 * 30, // 30 minutos de cache
  });

  const suggestions = useMemo(() => {
    if (query.trim().length < 2) return [];
    const lower = query.toLowerCase().trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ibgeMuns.filter((m: any) =>
      m.nome.toLowerCase().includes(lower) ||
      m.microrregiao?.mesorregiao?.UF?.sigla?.toLowerCase() === lower
    ).slice(0, 50);
  }, [query, ibgeMuns]);

  return { suggestions, loading: isLoading };
}

// ─── Hook: Favoritos do Usuário ──────────────────────────────────────────────
export function useFavoritos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["user_favoritos", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_favoritos")
        .select("tipo, item_nome");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({
      tipo,
      item_nome,
      isFavorito,
    }: {
      tipo: string;
      item_nome: string;
      isFavorito: boolean;
    }) => {
      if (!user?.id) return;
      if (isFavorito) {
        await supabase
          .from("user_favoritos")
          .delete()
          .match({ user_id: user.id, tipo, item_nome });
      } else {
        await supabase
          .from("user_favoritos")
          .insert({ user_id: user.id, tipo, item_nome });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_favoritos", user?.id] });
    },
  });

  return {
    favoritos: query.data ?? [],
    toggleFavorito: toggleMutation.mutate,
    isFavorito: useCallback(
      (tipo: string, nome: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (query.data ?? []).some(
          (f: any) => f.tipo === tipo && f.item_nome === nome
        );
      },
      [query.data]
    ),
  };
}

// ─── Tipos: TipoAcao ──────────────────────────────────────────────────────────
export interface TipoAcao {
  id: string;
  nome: string;
  padrao: boolean;
  criado_via: string | null;
}

// ─── Hook: Tipos de Ação (dinâmico do banco) ─────────────────────────────────
export function useTiposAcao() {
  const queryClient = useQueryClient();

  const { data: tipos = [], isLoading } = useQuery<TipoAcao[]>({
    queryKey: ["tipos_acao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_acao")
        .select("id, nome, padrao, criado_via")
        .order("padrao", { ascending: false })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TipoAcao[];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Adiciona um novo tipo de ação. Verifica duplicata antes de inserir.
  // Retorna o nome normalizado (do registro novo ou existente).
  const adicionarTipo = useCallback(
    async (nomeRaw: string): Promise<string | null> => {
      const nome = toTitleCase(nomeRaw);
      if (!nome) return null;

      // Verificar duplicata
      const { data: existing } = await supabase
        .from("tipos_acao")
        .select("id, nome")
        .ilike("nome", nome)
        .limit(1);

      if (existing && existing.length > 0) {
        // Já existe — devolver o nome do registro existente
        return existing[0].nome as string;
      }

      const { data: inserted, error } = await supabase
        .from("tipos_acao")
        .insert({ nome, padrao: false, criado_via: "usuario" })
        .select("id, nome")
        .single();

      if (error || !inserted) throw error ?? new Error("Falha ao salvar tipo de ação.");

      await queryClient.invalidateQueries({ queryKey: ["tipos_acao"] });
      return inserted.nome as string;
    },
    [queryClient]
  );

  return { tipos, loading: isLoading, adicionarTipo };
}

// ─── Tipos: LocalSuggestion ───────────────────────────────────────────────────
export interface LocalSuggestion {
  id: string;
  nome: string;
  fonte: "comunidade" | "local";
}

// ─── Hook: Autocomplete Unificado Local/Comunidade ───────────────────────────
// Busca na tabela `comunidades`, retorna lista unificada
// com campo `fonte` mapeado a partir da coluna `categoria`.
export function useLocaisAutocomplete(query: string) {
  const [suggestions, setSuggestions] = useState<LocalSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const term = query.trim();

      const { data, error } = await supabase
        .from("comunidades")
        .select("id, nome, categoria")
        .ilike("nome", `%${term}%`)
        .order("nome")
        .limit(12);

      if (error) {
        console.error("Erro no autocomplete de locais:", error);
        setSuggestions([]);
      } else {
        const items: LocalSuggestion[] = (data ?? []).map((c) => ({
          id: c.id,
          nome: c.nome,
          fonte: c.categoria === "Local/Espaço" ? "local" : "comunidade",
        }));
        setSuggestions(items);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return { suggestions, loading };
}

// ─── Tipos: LocalSalvo ────────────────────────────────────────────────────────
export interface LocalSalvo {
  nome: string;
  fonte: "comunidade" | "local";
  jaExistia: boolean;
}

// ─── Hook: Salvar Local com Deduplicação ─────────────────────────────────────
// Verifica se já existe na tabela `comunidades` por nome.
// Se já existir, vincula ao registro existente.
// Se não existir, cria com a categoria correspondente.
export function useSalvarLocal() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const salvar = useCallback(
    async (nomeRaw: string, tipo: "comunidade" | "local"): Promise<LocalSalvo> => {
      const nome = toTitleCase(nomeRaw);
      if (!nome) throw new Error("Nome inválido.");

      setSaving(true);
      try {
        // 1. Checar em comunidades
        const { data: existeCom, error: checkError } = await supabase
          .from("comunidades")
          .select("id, nome, categoria")
          .ilike("nome", nome)
          .limit(1);

        if (checkError) throw checkError;

        if (existeCom && existeCom.length > 0) {
          return {
            nome: existeCom[0].nome,
            fonte: existeCom[0].categoria === "Local/Espaço" ? "local" : "comunidade",
            jaExistia: true,
          };
        }

        // 2. Não existe — inserir com a categoria correta
        const categoriaFinal = tipo === "comunidade" ? "Comunidade" : "Local/Espaço";
        const { data: inserted, error: insertError } = await supabase
          .from("comunidades")
          .insert({
            nome,
            categoria: categoriaFinal,
            criado_via: "atividade",
          })
          .select("id, nome, categoria")
          .single();

        if (insertError || !inserted) throw insertError ?? new Error("Falha ao salvar local.");

        await queryClient.invalidateQueries({ queryKey: ["comunidades"] });
        return {
          nome: inserted.nome,
          fonte: inserted.categoria === "Local/Espaço" ? "local" : "comunidade",
          jaExistia: false,
        };
      } finally {
        setSaving(false);
      }
    },
    [queryClient]
  );

  return { salvar, saving };
}

