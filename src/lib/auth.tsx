"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import {
  finishMigrationDiscard,
  finishMigrationUpload,
  startSyncFor,
  stopSync,
} from "./progressSync";
import type { AllProgress } from "./progressStore";
import {
  getStoreState,
  hydrateFromLocalOnce,
  subscribe as subscribeStore,
  type StoreMode,
} from "./progressStore";

interface PendingMigration {
  userId: string;
  localData: AllProgress;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  /** Live sync mode from the progress store, for the settings indicator. */
  syncMode: StoreMode;
  syncError: string | null;
  /** Non-null when the migration dialog should be shown. */
  pendingMigration: PendingMigration | null;
  confirmMigrationUpload: () => Promise<void>;
  confirmMigrationDiscard: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
  syncMode: "local",
  syncError: null,
  pendingMigration: null,
  confirmMigrationUpload: async () => {},
  confirmMigrationDiscard: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncMode, setSyncMode] = useState<StoreMode>(() => getStoreState().mode);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingMigration, setPendingMigration] =
    useState<PendingMigration | null>(null);

  // Hydrate progress store from localStorage at mount so logged-out reads
  // return real data immediately.
  useEffect(() => {
    hydrateFromLocalOnce();
    setSyncMode(getStoreState().mode);
    const off = subscribeStore((s) => {
      setSyncMode(s.mode);
      setSyncError(s.syncError);
    });
    return off;
  }, []);

  // Auth session lifecycle.
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  // React to login/logout — hydrate cloud data or reset to local.
  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (!userId) {
      stopSync();
      setPendingMigration(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await startSyncFor(userId);
      if (cancelled) return;
      if (res.needsMigrationChoice && res.localData) {
        setPendingMigration({ userId, localData: res.localData });
      } else {
        setPendingMigration(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const signOut = async () => {
    if (!isSupabaseConfigured()) return;
    await getSupabase().auth.signOut();
    setSession(null);
  };

  const confirmMigrationUpload = async () => {
    if (!pendingMigration) return;
    await finishMigrationUpload(pendingMigration.userId, pendingMigration.localData);
    setPendingMigration(null);
  };
  const confirmMigrationDiscard = async () => {
    if (!pendingMigration) return;
    await finishMigrationDiscard(pendingMigration.userId);
    setPendingMigration(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signOut,
        syncMode,
        syncError,
        pendingMigration,
        confirmMigrationUpload,
        confirmMigrationDiscard,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
