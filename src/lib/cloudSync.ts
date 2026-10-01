"use client";

import { getSupabase } from "./supabase";
import {
  getStoreState as getProgressState,
  peekLocal as peekProgressLocal,
  reloadFromLocal as reloadProgressFromLocal,
  resetAndClearLocal as resetProgressAndClearLocal,
  setCloudAdapter as setProgressCloudAdapter,
  setCloudData as setProgressCloudData,
  setCloudDataAndFlush as setProgressCloudDataAndFlush,
  setLoading as setProgressLoading,
  FACULTY_KEY,
  type AllProgress,
} from "./progressStore";
import {
  collectionsStore,
  type CollectionsData,
} from "./collectionsStore";
import { streakStore, type StreakBlob } from "./streakStore";

/**
 * Owns the login/logout lifecycle for all cloud-synced blobs
 * (progress / collections / streak). Called from AuthProvider.
 *
 * On login:
 *   1. All stores go to "loading".
 *   2. Fetch each row in parallel.
 *   3. If a row exists → set cloud data for that store.
 *      If a row doesn't exist → remember the local payload as a potential
 *      migration candidate. We don't create empty rows yet; the migration
 *      dialog resolves it (upload local or discard & insert empty).
 *   4. If ANY store has a non-empty local payload with no cloud row,
 *      return `needsMigrationChoice: true`.
 *      Else: insert empty rows for stores that are both empty, finalize.
 *
 * On "Nahrát postup": upload each non-empty local payload for stores whose
 * cloud row is missing. Empty-side stores get an empty row.
 * On "Začít od nuly": every store that was missing a cloud row gets an
 * empty one; local data stays as a passive backup.
 */

const PROGRESS_TABLE = "user_progress";
const COLLECTIONS_TABLE = "user_collections";
const STREAK_TABLE = "user_streak";

type Blob = AllProgress | CollectionsData | StreakBlob;

interface PerStoreState<T extends Blob> {
  rowExists: boolean;
  localData: T;
  localHasPayload: boolean;
}

interface SyncState {
  userId: string;
  progress?: PerStoreState<AllProgress>;
  collections?: PerStoreState<CollectionsData>;
  streak?: PerStoreState<StreakBlob>;
}

let pending: SyncState | null = null;

// ─── Payload-emptiness heuristics ────────────────────────────────────────

function progressHasPayload(d: AllProgress): boolean {
  const bucket = d[FACULTY_KEY];
  return !!bucket && Object.keys(bucket).length > 0;
}
function collectionsHasPayload(d: CollectionsData): boolean {
  return (d.collections?.length ?? 0) > 0;
}
function streakHasPayload(d: StreakBlob): boolean {
  if (!d) return false;
  const s = d.streak;
  if (!s) return d.dailyGoal !== 10;
  return (
    (s.current ?? 0) > 0 ||
    (s.longest ?? 0) > 0 ||
    (s.todayCount ?? 0) > 0 ||
    !!s.lastActiveDate ||
    !!s.lastMetDate ||
    (d.dailyGoal != null && d.dailyGoal !== 10)
  );
}

// ─── Fetch / upsert helpers ──────────────────────────────────────────────

async function fetchRow<T>(
  table: string,
  userId: string,
  parse: (raw: unknown) => T
): Promise<{ exists: boolean; data: T }> {
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error("Session not ready yet");
  const { data, error } = await supabase
    .from(table)
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `${error.message}${error.code ? ` (code ${error.code})` : ""}${
        error.details ? ` — ${error.details}` : ""
      }`
    );
  }
  if (!data) return { exists: false, data: parse(null) };
  return { exists: true, data: parse(data.data) };
}

async function upsertRow(
  table: string,
  userId: string,
  data: unknown
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from(table)
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString() });
  if (error) {
    throw new Error(
      `${error.message}${error.code ? ` (code ${error.code})` : ""}${
        error.details ? ` — ${error.details}` : ""
      }`
    );
  }
}

// Parse helpers (keep in sync with each store's shape).
function parseProgress(raw: unknown): AllProgress {
  if (!raw || typeof raw !== "object") return {};
  return raw as AllProgress;
}
function parseCollections(raw: unknown): CollectionsData {
  if (!raw || typeof raw !== "object") return { collections: [] };
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.collections)) return { collections: [] };
  return { collections: obj.collections as CollectionsData["collections"] };
}
function parseStreak(raw: unknown): StreakBlob {
  if (!raw || typeof raw !== "object") {
    return {
      streak: {
        current: 0,
        longest: 0,
        lastActiveDate: "",
        todayCount: 0,
        lastMetDate: "",
      },
      dailyGoal: 10,
    };
  }
  const obj = raw as Record<string, unknown>;
  const s = (obj.streak as Partial<StreakBlob["streak"]>) ?? {};
  return {
    streak: {
      current: typeof s.current === "number" ? s.current : 0,
      longest: typeof s.longest === "number" ? s.longest : 0,
      lastActiveDate: typeof s.lastActiveDate === "string" ? s.lastActiveDate : "",
      todayCount: typeof s.todayCount === "number" ? s.todayCount : 0,
      lastMetDate: typeof s.lastMetDate === "string" ? s.lastMetDate : "",
    },
    dailyGoal:
      typeof obj.dailyGoal === "number" && obj.dailyGoal >= 1
        ? Math.round(obj.dailyGoal)
        : 10,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────

export interface StartSyncResult {
  needsMigrationChoice: boolean;
  itemCounts?: {
    progressKeys: number;
    collections: number;
    streakCurrent: number;
    streakLongest: number;
    dailyGoal: number;
  };
}

function installAdapters(userId: string) {
  setProgressCloudAdapter({
    async save(data: AllProgress) {
      await upsertRow(PROGRESS_TABLE, userId, data);
    },
  });
  collectionsStore.setCloudAdapter({
    async save(data) {
      await upsertRow(COLLECTIONS_TABLE, userId, data);
    },
  });
  streakStore.setCloudAdapter({
    async save(data) {
      await upsertRow(STREAK_TABLE, userId, data);
    },
  });
}

export async function startSyncFor(userId: string): Promise<StartSyncResult> {
  pending = null;
  setProgressLoading();
  collectionsStore.setLoading();
  streakStore.setLoading();
  installAdapters(userId);

  try {
    const [prog, cols, stk] = await Promise.all([
      fetchRow<AllProgress>(PROGRESS_TABLE, userId, parseProgress),
      fetchRow<CollectionsData>(COLLECTIONS_TABLE, userId, parseCollections),
      fetchRow<StreakBlob>(STREAK_TABLE, userId, parseStreak),
    ]);

    const progressLocal = peekProgressLocal();
    const collectionsLocal = collectionsStore.peekLocal();
    const streakLocal = streakStore.peekLocal();

    const progPending = !prog.exists && progressHasPayload(progressLocal);
    const colsPending = !cols.exists && collectionsHasPayload(collectionsLocal);
    const stkPending = !stk.exists && streakHasPayload(streakLocal);
    const needsMigrationChoice = progPending || colsPending || stkPending;

    if (needsMigrationChoice) {
      // Hold pending — don't finalize stores yet. Dialog will call
      // finishMigrationUpload / finishMigrationDiscard.
      pending = {
        userId,
        progress: prog.exists
          ? { rowExists: true, localData: prog.data, localHasPayload: false }
          : {
              rowExists: false,
              localData: progressLocal,
              localHasPayload: progressHasPayload(progressLocal),
            },
        collections: cols.exists
          ? { rowExists: true, localData: cols.data, localHasPayload: false }
          : {
              rowExists: false,
              localData: collectionsLocal,
              localHasPayload: collectionsHasPayload(collectionsLocal),
            },
        streak: stk.exists
          ? { rowExists: true, localData: stk.data, localHasPayload: false }
          : {
              rowExists: false,
              localData: streakLocal,
              localHasPayload: streakHasPayload(streakLocal),
            },
      };
      // For stores whose cloud row already exists we can hydrate right away;
      // the pending ones stay in "loading" until the dialog is answered.
      if (prog.exists) setProgressCloudData(prog.data);
      if (cols.exists) collectionsStore.setCloudData(cols.data);
      if (stk.exists) streakStore.setCloudData(stk.data);
      return {
        needsMigrationChoice: true,
        itemCounts: computeCounts({
          progress: pending.progress!,
          collections: pending.collections!,
          streak: pending.streak!,
        }),
      };
    }

    // No migration needed — ensure every store ends up in cloud mode.
    await Promise.all([
      prog.exists
        ? Promise.resolve()
        : upsertRow(PROGRESS_TABLE, userId, {}),
      cols.exists
        ? Promise.resolve()
        : upsertRow(COLLECTIONS_TABLE, userId, { collections: [] }),
      stk.exists
        ? Promise.resolve()
        : upsertRow(STREAK_TABLE, userId, parseStreak(null)),
    ]);
    setProgressCloudData(prog.data);
    collectionsStore.setCloudData(cols.data);
    streakStore.setCloudData(stk.data);
    return { needsMigrationChoice: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[cloudSync] hydration failed:", msg);
    reloadProgressFromLocal();
    collectionsStore.reloadFromLocal();
    streakStore.reloadFromLocal();
    return { needsMigrationChoice: false };
  }
}

function computeCounts(ps: {
  progress: PerStoreState<AllProgress>;
  collections: PerStoreState<CollectionsData>;
  streak: PerStoreState<StreakBlob>;
}): StartSyncResult["itemCounts"] {
  const progressBucket = ps.progress.localData[FACULTY_KEY];
  let progressKeys = 0;
  if (progressBucket) {
    for (const subject of Object.values(progressBucket)) {
      if (subject && typeof subject === "object") {
        progressKeys += Object.keys(subject).length;
      }
    }
  }
  return {
    progressKeys,
    collections: ps.collections.localData.collections?.length ?? 0,
    streakCurrent: ps.streak.localData.streak?.current ?? 0,
    streakLongest: ps.streak.localData.streak?.longest ?? 0,
    dailyGoal: ps.streak.localData.dailyGoal ?? 10,
  };
}

export async function finishMigrationUpload(): Promise<void> {
  if (!pending) return;
  const { userId, progress, collections, streak } = pending;
  // Upload local data for each store whose cloud row was missing. Stores
  // that already had cloud data were hydrated during startSyncFor — leave
  // them alone.
  const ops: Promise<void>[] = [];
  if (progress && !progress.rowExists) {
    ops.push(setProgressCloudDataAndFlush(progress.localData));
  }
  if (collections && !collections.rowExists) {
    ops.push(collectionsStore.setCloudDataAndFlush(collections.localData));
  }
  if (streak && !streak.rowExists) {
    ops.push(streakStore.setCloudDataAndFlush(streak.localData));
  }
  await Promise.all(ops);
  pending = null;
}

export async function finishMigrationDiscard(): Promise<void> {
  if (!pending) return;
  const { progress, collections, streak } = pending;
  const ops: Promise<void>[] = [];
  if (progress && !progress.rowExists) {
    ops.push(setProgressCloudDataAndFlush({}));
  }
  if (collections && !collections.rowExists) {
    ops.push(collectionsStore.setCloudDataAndFlush({ collections: [] }));
  }
  if (streak && !streak.rowExists) {
    ops.push(streakStore.setCloudDataAndFlush(parseStreak(null)));
  }
  await Promise.all(ops);
  pending = null;
}

export function stopSync(): void {
  pending = null;
  setProgressCloudAdapter(null);
  collectionsStore.setCloudAdapter(null);
  streakStore.setCloudAdapter(null);

  // If this store was tied to a cloud session (cloud / loading / error),
  // wipe its local cache and reset to empty so a shared device doesn't
  // show the previous user's data to the next person. For stores that
  // were purely local (never signed in), do nothing — we don't touch
  // offline-only usage.
  const wasCloud = (mode: string) =>
    mode === "cloud" || mode === "loading" || mode === "error";

  if (wasCloud(getProgressState().mode)) {
    resetProgressAndClearLocal();
  } else {
    reloadProgressFromLocal();
  }
  if (wasCloud(collectionsStore.getState().mode)) {
    collectionsStore.resetAndClearLocal();
  } else {
    collectionsStore.reloadFromLocal();
  }
  if (wasCloud(streakStore.getState().mode)) {
    streakStore.resetAndClearLocal();
    // Legacy standalone key — streakStore itself doesn't know about it, so
    // wipe it here or the pre-logout daily goal would resurface on reload
    // via hydrateLegacyStreakGoal.
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("lf2-quiz-daily-goal");
      } catch {
        /* ignore */
      }
    }
  } else {
    streakStore.reloadFromLocal();
  }
}

// Aggregate sync mode for the Settings indicator — "cloud" only when all
// three stores are cloud-synced; otherwise the "worst" state wins.
export type AggregateSyncMode = "local" | "loading" | "cloud" | "error";

export function aggregateSyncMode(
  progressMode: string,
  collectionsMode: string,
  streakMode: string
): AggregateSyncMode {
  const modes = [progressMode, collectionsMode, streakMode];
  if (modes.includes("error")) return "error";
  if (modes.includes("loading")) return "loading";
  if (modes.every((m) => m === "cloud")) return "cloud";
  return "local";
}
