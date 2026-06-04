import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { addNotification, setNotifications, type NotificationType } from "@/lib/notificationsStore";
import { toast } from "sonner";

/**
 * Assina as mudanças em tempo real da tabela `notificacoes` para o usuário logado.
 * Ao receber um INSERT, adiciona ao store local e exibe um toast (sonner).
 * Deve ser chamado dentro do AppLayout para escutar globalmente.
 */
export function useRealtimeNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    // 1. Carrega notificações iniciais do banco
    const loadInitial = async () => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("*")
        .eq("usuario_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Erro ao carregar notificações do Supabase:", error);
        return;
      }

      const tipoMap: Record<string, NotificationType> = {
        mensagem: "mensagem",
        atividade: "atividade",
        projeto: "projeto",
        imagem: "imagem",
        tecnologia: "tecnologia",
      };

      const mapped = (data ?? []).map((row) => ({
        id: row.id,
        type: tipoMap[row.tipo ?? "mensagem"] ?? "mensagem",
        title: row.titulo,
        body: row.mensagem,
        createdAt: new Date(row.created_at).getTime(),
        read: row.lida,
        from: row.remetente ?? undefined,
      }));

      setNotifications(mapped);
    };

    loadInitial();

    // 2. Escuta mudanças em tempo real
    const channel = supabase
      .channel(`notificacoes:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: `usuario_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            titulo: string;
            mensagem: string;
            tipo?: string;
            remetente?: string;
            lida: boolean;
            created_at: string;
          };

          const tipoMap: Record<string, NotificationType> = {
            mensagem: "mensagem",
            atividade: "atividade",
            projeto: "projeto",
            imagem: "imagem",
            tecnologia: "tecnologia",
          };
          const tipo = tipoMap[row.tipo ?? "mensagem"] ?? "mensagem";

          // Adiciona ao store local (sininho)
          addNotification({
            id: row.id,
            type: tipo,
            title: row.titulo,
            body: row.mensagem?.slice(0, 140),
            from: row.remetente ?? undefined,
            createdAt: new Date(row.created_at).getTime(),
          });

          // Toast visual de chegada
          toast.info(row.titulo, {
            description: row.mensagem?.slice(0, 100),
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
}
