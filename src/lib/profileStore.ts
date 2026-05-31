import { useSyncExternalStore, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
  email: string;
  firstName: string;
  lastName: string;
  photoDataUrl?: string;
  role?: "admin" | "editor" | "visualizador";
}

let profiles: Record<string, UserProfile> = {};
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((l) => l());
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export const fetchProfile = async (email: string) => {
  const key = email.toLowerCase();
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", key)
      .maybeSingle();

    if (error) {
      console.error("[ProfileStore] error loading profile:", error);
      return;
    }

    if (data) {
      const parts = (data.full_name || "").split(" ");
      const firstName = parts[0] || "";
      const lastName = parts.slice(1).join(" ") || "";
      profiles = {
        ...profiles,
        [key]: {
          email: key,
          firstName,
          lastName,
          photoDataUrl: data.photo_url || undefined,
          role: (data.role as any) || "visualizador",
        },
      };
      emit();
    }
  } catch (err) {
    console.error("[ProfileStore] exception:", err);
  }
};

export const setProfile = async (email: string, data: Partial<UserProfile>) => {
  const key = email.toLowerCase();
  const current = profiles[key] || { email: key, firstName: "", lastName: "" };
  const updated = { ...current, ...data };
  profiles = { ...profiles, [key]: updated };
  emit();

  try {
    const fullNameVal = [updated.firstName, updated.lastName].filter(Boolean).join(" ");
    const { data: userProf } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", key)
      .maybeSingle();

    if (userProf) {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullNameVal,
          photo_url: updated.photoDataUrl || null,
          role: updated.role || "visualizador",
        })
        .eq("id", userProf.id);

      if (error) {
        console.error("[ProfileStore] error updating profiles:", error);
      }
    }
  } catch (err) {
    console.error("[ProfileStore] update exception:", err);
  }
};

export const getProfile = (email?: string | null): UserProfile | null => {
  if (!email) return null;
  const key = email.toLowerCase();
  const cached = profiles[key];
  if (!cached) {
    // Trigger lazy load
    fetchProfile(key);
  }
  return cached || null;
};

export const useProfile = (email?: string | null): UserProfile | null => {
  const key = email?.toLowerCase();

  useEffect(() => {
    if (key) {
      fetchProfile(key);
    }
  }, [key]);

  return useSyncExternalStore(
    subscribe,
    () => (key ? profiles[key] || null : null),
    () => null,
  );
};

export const capitalize = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";

export const fullName = (p: UserProfile | null, fallback = ""): string => {
  if (!p) return fallback;
  const fn = capitalize(p.firstName);
  const ln = capitalize(p.lastName);
  return [fn, ln].filter(Boolean).join(" ") || fallback;
};

export const initialsFrom = (p: UserProfile | null, email: string): string => {
  if (p && (p.firstName || p.lastName)) {
    return ((p.firstName[0] || "") + (p.lastName[0] || "")).toUpperCase() || "CH";
  }
  const base = email.split("@")[0] || "CH";
  return base.slice(0, 2).toUpperCase();
};
