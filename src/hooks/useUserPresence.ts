import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile, fullName } from "@/lib/profileStore";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type UserStatus = "online" | "inactive" | "offline";

export interface PresenceUser {
  id: string;
  nome: string;
  status: UserStatus;
}

export interface UseUserPresenceReturn {
  onlineUsers: PresenceUser[];
  getStatusOf: (userId: string) => UserStatus;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Tempo sem interação para passar para 'inactive' (5 min em ms) */
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

/** Intervalo de atualização periódica do last_seen no banco (2 min em ms) */
const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUserPresence(): UseUserPresenceReturn {
  const { user } = useAuth();
  const profile = useProfile(user?.email ?? "");

  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

  // Refs para não re-criar closures a cada render
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentStatusRef = useRef<UserStatus>("online");

  // ─── Nome do usuário atual ───────────────────────────────────────────────
  const currentName = fullName(profile, user?.email?.split("@")[0] ?? "Usuário");
  const currentNameRef = useRef(currentName);
  useEffect(() => {
    currentNameRef.current = currentName;
  }, [currentName]);

  // ─── Atualiza last_seen no banco ────────────────────────────────────────
  const updateLastSeen = useCallback(async () => {
    if (!user?.id) return;
    await supabase
      .from("profiles")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", user.id);
  }, [user?.id]);

  // ─── Track do status no canal Presence ──────────────────────────────────
  const trackStatus = useCallback(
    async (status: UserStatus) => {
      if (!user?.id || !channelRef.current) return;
      currentStatusRef.current = status;
      await channelRef.current.track({
        id: user.id,
        nome: currentNameRef.current,
        status,
      } satisfies PresenceUser);
    },
    [user?.id]
  );

  // ─── Idle Detector ───────────────────────────────────────────────────────
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    // Se estava inativo, voltar para online
    if (currentStatusRef.current === "inactive") {
      trackStatus("online");
    }

    idleTimerRef.current = setTimeout(() => {
      trackStatus("inactive");
    }, IDLE_TIMEOUT_MS);
  }, [trackStatus]);

  // ─── Efeito principal ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    // Criar canal Realtime com Presence
    const channel = supabase.channel("chapada-user-presence", {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    // Listener de estado Presence: sincroniza lista de usuários online
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresenceUser>();
      // Deduplicação: pega apenas a primeira instância de presença para cada key (user_id)
      const users: PresenceUser[] = Object.values(state)
        .map((presences) => presences[0])
        .filter(Boolean);
      setOnlineUsers(users);
    });

    // Inscrever no canal e fazer o primeiro track
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await trackStatus("online");
      }
    });

    // Heartbeat: atualizar last_seen no banco a cada 2 min
    heartbeatRef.current = setInterval(updateLastSeen, HEARTBEAT_INTERVAL_MS);

    // Iniciar idle timer
    resetIdleTimer();

    // Adicionar listeners de atividade do usuário
    const activityEvents: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    activityEvents.forEach((evt) =>
      window.addEventListener(evt, resetIdleTimer, { passive: true })
    );

    // Atualizar last_seen quando a aba perde/recupera visibilidade
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        updateLastSeen();
        trackStatus("offline");
      } else {
        trackStatus("online");
        resetIdleTimer();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Atualizar last_seen antes de fechar a aba
    const handleBeforeUnload = () => {
      updateLastSeen();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // ─── Cleanup ──────────────────────────────────────────────────────────
    return () => {
      // Limpar timers
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);

      // Remover listeners de atividade
      activityEvents.forEach((evt) =>
        window.removeEventListener(evt, resetIdleTimer)
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      // Atualizar last_seen e remover do canal Presence
      updateLastSeen();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user?.id, trackStatus, resetIdleTimer, updateLastSeen]);

  // ─── getStatusOf ─────────────────────────────────────────────────────────
  const getStatusOf = useCallback(
    (userId: string): UserStatus => {
      const found = onlineUsers.find((u) => u.id === userId);
      return found?.status ?? "offline";
    },
    [onlineUsers]
  );

  return { onlineUsers, getStatusOf };
}
