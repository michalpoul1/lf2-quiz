"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase";

interface AuthContextValue {
  /** null before first check finishes, then Session | null. */
  session: Session | null;
  user: User | null;
  /** true until the initial getSession() resolves. */
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();

    // Initial fetch of current session.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    // Subscribe to further changes (sign-in, sign-out, token refresh).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    if (!isSupabaseConfigured()) return;
    await getSupabase().auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
