/**
 * In-memory state for the user's progress.
 *
 * Reads (getSubjectProgress etc.) hit this store synchronously, so no
 * consumer had to become async. Writes (recordAnswer, removeFromWrong)
 * mutate the store and schedule a debounced flush to either localStorage
 * (mode "local") or Supabase (mode "cloud").
 *
 * The sync layer (progressSync.ts) is what flips the mode on login/logout
 * and hydrates from Supabase.
 */

import type { SubjectProgress } from "./types";

const STORAGE_KEY = "lf2-quiz-progress";
const LEGACY_SUBJECT_KEYS = new Set(["biology", "chemistry", "physics"]);
const FACULTY = "2lf";
const CLOUD_FLUSH_DELAY_MS = 1500;
const LOCAL_FLUSH_DELAY_MS = 0;

export type FacultyProgress = Record<string, SubjectProgress>;
export type AllProgress = Record<string, FacultyProgress>;

export type StoreMode =
  | "local" // logged out — persist to localStorage
  | "loading" // logged in, hydrating from Supabase (writes queued)
  | "cloud" // logged in, hydrated — persist to Supabase
  | "error"; // last cloud flush failed; keep retrying

export interface StoreState {
  data: AllProgress;
  mode: StoreMode;
  syncError: string | null;
  /** Bumps on every successful hydration/mutation so consumers can rerun. */
  version: number;
}

type Listener = (state: StoreState) => void;

interface CloudAdapter {
  save(data: AllProgress): Promise<void>;
}

let state: StoreState = {
  data: {},
  mode: "local",
  syncError: null,
  version: 0,
};

const listeners = new Set<Listener>();
let cloudAdapter: CloudAdapter | null = null;
let hydratedFromLocal = false;

// ─── Legacy shape migration ──────────────────────────────────────────────

function migrateIfNeeded(raw: unknown): AllProgress {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const topKeys = Object.keys(obj);
  const looksLegacy = topKeys.some((k) => LEGACY_SUBJECT_KEYS.has(k));
  if (!looksLegacy) return obj as AllProgress;
  const migrated: AllProgress = {};
  const legacyBucket: FacultyProgress = {};
  for (const [k, v] of Object.entries(obj)) {
    if (LEGACY_SUBJECT_KEYS.has(k)) legacyBucket[k] = v as SubjectProgress;
    else migrated[k] = v as FacultyProgress;
  }
  if (Object.keys(legacyBucket).length > 0) {
    migrated[FACULTY] = { ...(migrated[FACULTY] || {}), ...legacyBucket };
  }
  return migrated;
}

// ─── Subscribers & state helpers ─────────────────────────────────────────

function emit() {
  for (const l of listeners) l(state);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("lf2-progress-updated"));
  }
}

function setState(next: Partial<StoreState>) {
  state = { ...state, ...next };
  emit();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getStoreState(): StoreState {
  return state;
}

// ─── Local hydration (from localStorage) ─────────────────────────────────

function readLocal(): AllProgress {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return migrateIfNeeded(raw ? JSON.parse(raw) : {});
  } catch {
    return {};
  }
}

function writeLocal(data: AllProgress) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota exceeded — silently ignore, we still have in-memory state */
  }
}

/** Client-only. Idempotent — safe to call on every mount. */
export function hydrateFromLocalOnce() {
  if (typeof window === "undefined") return;
  if (hydratedFromLocal) return;
  hydratedFromLocal = true;
  state = {
    data: readLocal(),
    mode: "local",
    syncError: null,
    version: state.version + 1,
  };
  emit();
}

/** Called by sync layer when the user logs out — go back to local storage. */
export function reloadFromLocal() {
  state = {
    data: readLocal(),
    mode: "local",
    syncError: null,
    version: state.version + 1,
  };
  emit();
}

/** Read-only snapshot of what's currently in localStorage (for migration UI). */
export function peekLocal(): AllProgress {
  return readLocal();
}

// ─── Cloud mode entry points ─────────────────────────────────────────────

export function setCloudAdapter(a: CloudAdapter | null) {
  cloudAdapter = a;
}

/** Called by sync layer when it begins hydrating from Supabase. */
export function setLoading() {
  setState({ mode: "loading", syncError: null });
}

/** Called by sync layer after Supabase data arrived. Replaces state. */
export function setCloudData(data: AllProgress) {
  state = {
    data,
    mode: "cloud",
    syncError: null,
    version: state.version + 1,
  };
  emit();
}

/**
 * Set state and flush cloud IMMEDIATELY. Used by migration path: user
 * confirmed "Nahrát postup" and we want the write to complete before we
 * consider migration done.
 */
export async function setCloudDataAndFlush(data: AllProgress): Promise<void> {
  state = {
    data,
    mode: "cloud",
    syncError: null,
    version: state.version + 1,
  };
  emit();
  if (cloudAdapter) {
    await cloudAdapter.save(data);
  }
}

// ─── Mutation & flush ────────────────────────────────────────────────────

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushInFlight = false;
let flushDirty = false;

function scheduleFlush() {
  const delay =
    state.mode === "cloud" ? CLOUD_FLUSH_DELAY_MS : LOCAL_FLUSH_DELAY_MS;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, delay);
}

async function flush() {
  if (state.mode === "loading") return; // writes queued during hydration
  if (state.mode === "local" || state.mode === "error") {
    // "error" falls back to local write attempts too — we never lose data.
    if (state.mode === "local") writeLocal(state.data);
    else writeLocal(state.data); // mirror to local while cloud is broken
  }
  if (state.mode === "cloud" || state.mode === "error") {
    if (!cloudAdapter) return;
    if (flushInFlight) {
      flushDirty = true;
      return;
    }
    flushInFlight = true;
    flushDirty = false;
    try {
      await cloudAdapter.save(state.data);
      // Recover from previous error automatically.
      if (state.mode === "error") setState({ mode: "cloud", syncError: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState({ mode: "error", syncError: msg });
      // Retry once more in a moment; if it keeps failing we stay in "error"
      // but user data is safe in localStorage as a backup.
      setTimeout(() => scheduleFlush(), 5000);
    } finally {
      flushInFlight = false;
      if (flushDirty) {
        flushDirty = false;
        scheduleFlush();
      }
    }
  }
}

export function mutate(updater: (data: AllProgress) => void) {
  const draft: AllProgress = JSON.parse(JSON.stringify(state.data));
  updater(draft);
  state = { ...state, data: draft, version: state.version + 1 };
  emit();
  scheduleFlush();
}

// ─── Convenience readers for progress.ts ─────────────────────────────────

export const FACULTY_KEY = FACULTY;
