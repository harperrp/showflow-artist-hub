import * as React from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  loading: boolean;
  user: User | null;
};

const AuthContext = React.createContext<AuthState>({ loading: true, user: null });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({ loading: true, user: null });

  React.useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ loading: false, user: session?.user ?? null });
    });

    void supabase.auth.getSession().then(({ data }) => {
      setState({ loading: false, user: data.session?.user ?? null });
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return React.useContext(AuthContext);
}
