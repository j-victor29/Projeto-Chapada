import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useRegistroPermissao(
  tabela: string,
  registroId: string | undefined,
  createdBy: string | null | undefined
) {
  const { user } = useAuth(); // usuário logado atualmente

  // Se não houver id ou se o dono for nulo (migração/sem dono), qualquer um pode editar/excluir
  const isCriador = !!user?.id && createdBy === user?.id;

  const { data: colaboradores } = useQuery({
    queryKey: ["colaboradores", tabela, registroId],
    queryFn: async () => {
      if (!registroId) return [];
      const { data, error } = await supabase
        .from("registro_colaboradores")
        .select("*")
        .eq("tabela", tabela)
        .eq("registro_id", registroId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!registroId,
  });

  const permitirTodos = colaboradores?.some((c) => c.permitir_todos) ?? false;
  const isColaborador = colaboradores?.some((c) => c.user_id === user?.id) ?? false;

  // Se não foi definido o criador (ex: registros antigos migrados), permite editar/excluir
  const semDono = !createdBy;

  const podeEditar = semDono || isCriador || permitirTodos || isColaborador;
  const podeExcluir = semDono || isCriador || permitirTodos || isColaborador;

  return { isCriador, podeEditar, podeExcluir, colaboradores };
}
