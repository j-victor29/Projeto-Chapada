import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { refreshAtividades } from "@/lib/atividadesStore";
import { refreshProjetos } from "@/lib/projetosStore";
import { fetchTecnologias } from "@/lib/tecnologiasStore";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

/** Refreshes all custom stores that rely on Supabase auth. */
function refreshAllStores() {
  refreshAtividades();
  refreshProjetos();
  fetchTecnologias();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Track whether we've already triggered the initial store hydration
  const didHydrate = useRef(false);

  useEffect(() => {
    // Clean up any leftover impersonation data from development
    localStorage.removeItem("chapada.impersonated");

    // Subscribe to auth changes FIRST so we don't miss events that fire
    // synchronously during getSession() resolution.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);

      // When the user signs in (including session restored from storage),
      // reset store initialized flags and re-fetch so F5 always loads data.
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && s) {
        refreshAllStores();
        didHydrate.current = true;
      }
    });

    // Then resolve the initial session from localStorage.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);

      // If onAuthStateChange didn't already fire SIGNED_IN for this session
      // (it might not when restoring from storage on first load), do it here.
      if (data.session && !didHydrate.current) {
        refreshAllStores();
        didHydrate.current = true;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
