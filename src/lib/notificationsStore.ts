import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type NotificationType =
  | "atividade"
  | "projeto"
  | "imagem"
  | "tecnologia"
  | "mensagem";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  createdAt: number;
  read: boolean;
  from?: string; // sender name for messages
}

const seed: AppNotification[] = [
  {
    id: "n-seed-1",
    type: "atividade",
    title: "Nova atividade cadastrada",
    body: "Oficina de manejo de sementes — Araripina",
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
    read: false,
  },
  {
    id: "n-seed-2",
    type: "imagem",
    title: "Imagens enviadas",
    body: "3 novas fotos no Banco de Imagens",
    createdAt: Date.now() - 1000 * 60 * 60 * 12,
    read: false,
  },
  {
    id: "n-seed-3",
    type: "tecnologia",
    title: "Tecnologia social adicionada",
    body: "Cisterna de placas em Bodocó",
    createdAt: Date.now() - 1000 * 60 * 60 * 36,
    read: true,
  },
];

let items: AppNotification[] = seed;

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const emit = () => listeners.forEach((l) => l());

export const setNotifications = (newItems: AppNotification[]) => {
  items = [...newItems, ...seed.filter(s => !newItems.some(n => n.id === s.id))];
  emit();
};

export const addNotification = (
  n: Omit<AppNotification, "id" | "createdAt" | "read"> & {
    id?: string;
    createdAt?: number;
  }
) => {
  if (n.id && items.some((item) => item.id === n.id)) return;

  items = [
    {
      ...n,
      id: n.id ?? `n${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: n.createdAt ?? Date.now(),
      read: false,
    },
    ...items,
  ];
  emit();
};

export const markRead = async (id: string) => {
  items = items.map((i) => (i.id === id ? { ...i, read: true } : i));
  emit();

  if (!id.startsWith("n-seed-")) {
    const { error } = await supabase
      .from("notificacoes")
      .update({ lida: true })
      .eq("id", id);
    if (error) {
      console.error("Erro ao marcar como lida no Supabase:", error);
    }
  }
};

export const markAllRead = async () => {
  const unreadIds = items
    .filter((i) => !i.read && !i.id.startsWith("n-seed-"))
    .map((i) => i.id);

  items = items.map((i) => ({ ...i, read: true }));
  emit();

  if (unreadIds.length > 0) {
    const { error } = await supabase
      .from("notificacoes")
      .update({ lida: true })
      .in("id", unreadIds);
    if (error) {
      console.error("Erro ao marcar todas como lidas no Supabase:", error);
    }
  }
};

export const clearAll = async () => {
  const dbIds = items
    .filter((i) => !i.id.startsWith("n-seed-"))
    .map((i) => i.id);

  items = seed;
  emit();

  if (dbIds.length > 0) {
    const { error } = await supabase
      .from("notificacoes")
      .delete()
      .in("id", dbIds);
    if (error) {
      console.error("Erro ao limpar notificações no Supabase:", error);
    }
  }
};

export const useNotifications = () =>
  useSyncExternalStore(
    subscribe,
    () => items,
    () => items
  );
