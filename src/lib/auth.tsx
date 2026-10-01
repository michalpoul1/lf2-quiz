"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import {
  aggregateSyncMode,
  finishMigrationDiscard,
  finishMigrationUpload,
  startSyncFor,
  stopSync,
  type AggregateSyncMode,
} from "./cloudSync";
import {
  getStoreState as getProgressState,
  hydrateFromLocalOnce as hydrateProgressLocalOnce,
  subscribe as subscribeProgress,
} from "./progressStore";
import { collectionsStore } from "./collectionsStore";
import { streakStore } from "./streakStore";

export interface PendingMigrationCounts {
  progressKeys: number;
  collections: number;
  streakCurrent: number;
  streakLongest: number;
  dailyGoal: number;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  syncMode: AggregateSyncMode;
  syncError: string | null;
  pendingMigration: PendingMigrationCounts | null;
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
  const [progressMode, setProgressMode] = useState<string>(() => getProgressState().mode);
  const [collectionsMode, setCollectionsMode] = useState<string>(() => collectionsStore.getState().mode);
  const [streakMode, setStreakMode] = useState<string>(() => streakStore.getState().mode);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingMigration, setPendingMigration] =
    useState<PendingMigrationCounts | null>(null);

  // Hydrate all three stores on mount so logged-out reads work immediately.
  useEffect(() => {
    hydrateProgressLocalOnce();
    collectionsStore.hydrateFromLocalOnce();
    streakStore.hydrateFromLocalOnce();
    setProgressMode(getProgressState().mode);
    setCollectionsMode(collectionsStore.getState().mode);
    setStreakMode(streakStore.getState().mode);
    const offP = subscribeProgress((s) => {
      setProgressMode(s.mode);
      if (s.syncError) setSyncError(s.syncError);
    });
    const offC = collectionsStore.subscribe((s) => {
      setCollectionsMode(s.mode);
      if (s.syncError) setSyncError(s.syncError);
    });
    const offS = streakStore.subscribe((s) => {
      setStreakMode(s.mode);
      if (s.syncError) setSyncError(s.syncError);
    });
    return () => {
      offP();
      offC();
      offS();
    };
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

  // React to login/logout — hydrate cloud data for all stores or reset to local.
  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (!userId) {
      stopSync();
      setPendingMigration(null);
      setSyncError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await startSyncFor(userId);
      if (cancelled) return;
      if (res.needsMigrationChoice && res.itemCounts) {
        setPendingMigration(res.itemCounts);
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
    await finishMigrationUpload();
    setPendingMigration(null);
  };
  const confirmMigrationDiscard = async () => {
    await finishMigrationDiscard();
    setPendingMigration(null);
  };

  const syncMode = aggregateSyncMode(progressMode, collectionsMode, streakMode);

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
