import { useSyncExternalStore } from "react";

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

export const addNotification = (n: Omit<AppNotification, "id" | "createdAt" | "read">) => {
  items = [
    {
      ...n,
      id: `n${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      read: false,
    },
    ...items,
  ];
  emit();
};

export const markAllRead = () => {
  items = items.map((i) => ({ ...i, read: true }));
  emit();
};

export const clearAll = () => {
  items = [];
  emit();
};

export const useNotifications = () =>
  useSyncExternalStore(
    subscribe,
    () => items,
    () => items,
  );
