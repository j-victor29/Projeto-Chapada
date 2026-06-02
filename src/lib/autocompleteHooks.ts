import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

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
    mutationFn: async ({ tipo, item_nome, isFavorito }: { tipo: string, item_nome: string, isFavorito: boolean }) => {
      if (!user?.id) return;
      if (isFavorito) {
        await supabase.from("user_favoritos").delete().match({ user_id: user.id, tipo, item_nome });
      } else {
        await supabase.from("user_favoritos").insert({ user_id: user.id, tipo, item_nome });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_favoritos", user?.id] });
    }
  });

  return {
    favoritos: query.data ?? [],
    toggleFavorito: toggleMutation.mutate,
    isFavorito: useCallback((tipo: string, nome: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (query.data ?? []).some((f: any) => f.tipo === tipo && f.item_nome === nome);
    }, [query.data]),
  };
}
