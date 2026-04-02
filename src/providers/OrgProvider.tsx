import * as React from "react";
import { db } from "@/lib/db";
import { useAuth } from "./AuthProvider";

type OrgState = {
  loading: boolean;
  activeOrgId: string | null;
  profile: { id: string; email?: string | null; display_name?: string | null } | null;
};

const OrgContext = React.createContext<OrgState>({ loading: true, activeOrgId: null, profile: null });

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = React.useState<OrgState>({ loading: true, activeOrgId: null, profile: null });

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!user) {
        setState({ loading: false, activeOrgId: null, profile: null });
        return;
      }

      setState((s) => ({ ...s, loading: true }));
      const { data, error } = await db
        .from("profiles")
        .select("id,email,display_name,active_organization_id")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        // If profile isn't ready yet (race after signup), keep app usable.
        setState({ loading: false, activeOrgId: null, profile: { id: user.id, email: user.email }, });
        return;
      }

      setState({
        loading: false,
        activeOrgId: data?.active_organization_id ?? null,
        profile: data ? { id: data.id, email: data.email, display_name: data.display_name } : { id: user.id, email: user.email },
      });
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return <OrgContext.Provider value={state}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  return React.useContext(OrgContext);
}
