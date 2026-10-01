/**
 * Generic in-memory JSON blob store with debounced flushing.
 *
 * Extracts the pattern first used by progressStore so collections/streak can
 * reuse it. Each caller supplies a localStorage key, an "empty" factory, and
 * an optional migration function for legacy local shapes. Reads stay
 * synchronous; writes are mutated in-memory immediately and flushed either
 * to localStorage (mode "local") or via a cloud adapter (mode "cloud").
 *
 * progressStore is intentionally NOT refactored onto this — it has subtler
 * legacy-shape migration and is already shipped. Future unification is fine.
 */

const CLOUD_FLUSH_DELAY_MS = 1500;
const LOCAL_FLUSH_DELAY_MS = 0;

export type BlobStoreMode =
  | "local"
  | "loading"
  | "cloud"
  | "error";

export interface BlobStoreState<T> {
  data: T;
  mode: BlobStoreMode;
  syncError: string | null;
  version: number;
}

type Listener<T> = (state: BlobStoreState<T>) => void;

export interface BlobCloudAdapter<T> {
  save(data: T): Promise<void>;
}

export interface BlobStoreOptions<T> {
  /** localStorage key used for the offline/logged-out mirror. */
  storageKey: string;
  /** Debug name used in the custom DOM event (`${name}-updated`). */
  eventName: string;
  /** Factory for an empty value. */
  empty: () => T;
  /** Normalize whatever was in localStorage into the current shape. */
  parse?: (raw: unknown) => T;
}

export interface BlobStore<T> {
  getState(): BlobStoreState<T>;
  subscribe(fn: Listener<T>): () => void;
  hydrateFromLocalOnce(): void;
  reloadFromLocal(): void;
  peekLocal(): T;
  setCloudAdapter(a: BlobCloudAdapter<T> | null): void;
  setLoading(): void;
  setCloudData(data: T): void;
  setCloudDataAndFlush(data: T): Promise<void>;
  mutate(updater: (draft: T) => void): void;
}

export function createBlobStore<T>(opts: BlobStoreOptions<T>): BlobStore<T> {
  const parse = opts.parse ?? ((raw: unknown) => (raw as T) ?? opts.empty());

  let state: BlobStoreState<T> = {
    data: opts.empty(),
    mode: "local",
    syncError: null,
    version: 0,
  };
  const listeners = new Set<Listener<T>>();
  let adapter: BlobCloudAdapter<T> | null = null;
  let hydrated = false;

  // ─── Subscribers & state helpers ───────────────────────────────────────
  function emit() {
    for (const l of listeners) l(state);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(`${opts.eventName}-updated`));
    }
  }
  function setState(next: Partial<BlobStoreState<T>>) {
    state = { ...state, ...next };
    emit();
  }

  // ─── Local hydration ───────────────────────────────────────────────────
  function readLocal(): T {
    if (typeof window === "undefined") return opts.empty();
    try {
      const raw = localStorage.getItem(opts.storageKey);
      if (!raw) return opts.empty();
      return parse(JSON.parse(raw));
    } catch {
      return opts.empty();
    }
  }
  function writeLocal(data: T) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(opts.storageKey, JSON.stringify(data));
    } catch {
      /* quota exceeded — keep in-memory, nothing we can do */
    }
  }

  // ─── Flush scheduling ──────────────────────────────────────────────────
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
    if (state.mode === "loading") return;
    if (state.mode === "local" || state.mode === "error") {
      writeLocal(state.data);
    }
    if (state.mode === "cloud" || state.mode === "error") {
      if (!adapter) return;
      if (flushInFlight) {
        flushDirty = true;
        return;
      }
      flushInFlight = true;
      flushDirty = false;
      try {
        await adapter.save(state.data);
        if (state.mode === "error") setState({ mode: "cloud", syncError: null });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setState({ mode: "error", syncError: msg });
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

  return {
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    hydrateFromLocalOnce() {
      if (typeof window === "undefined") return;
      if (hydrated) return;
      hydrated = true;
      state = {
        data: readLocal(),
        mode: "local",
        syncError: null,
        version: state.version + 1,
      };
      emit();
    },
    reloadFromLocal() {
      state = {
        data: readLocal(),
        mode: "local",
        syncError: null,
        version: state.version + 1,
      };
      emit();
    },
    peekLocal: readLocal,
    setCloudAdapter(a) {
      adapter = a;
    },
    setLoading() {
      setState({ mode: "loading", syncError: null });
    },
    setCloudData(data) {
      state = {
        data,
        mode: "cloud",
        syncError: null,
        version: state.version + 1,
      };
      emit();
    },
    async setCloudDataAndFlush(data) {
      state = {
        data,
        mode: "cloud",
        syncError: null,
        version: state.version + 1,
      };
      emit();
      if (adapter) await adapter.save(data);
    },
    mutate(updater) {
      const draft: T = JSON.parse(JSON.stringify(state.data));
      updater(draft);
      state = { ...state, data: draft, version: state.version + 1 };
      emit();
      scheduleFlush();
    },
  };
}

// ─── Shared helper for cloud sync modules ────────────────────────────────

export async function fetchBlobRow<T>(opts: {
  supabaseFrom: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{
          data: { data: unknown } | null;
          error: { message: string; code?: string; details?: string } | null;
        }>;
      };
    };
  };
  table: string;
  userId: string;
  parse: (raw: unknown) => T;
}): Promise<{ exists: boolean; data: T }> {
  const { data, error } = await opts
    .supabaseFrom(opts.table)
    .select("data")
    .eq("user_id", opts.userId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `${error.message}${error.code ? ` (code ${error.code})` : ""}${
        error.details ? ` — ${error.details}` : ""
      }`
    );
  }
  if (!data) return { exists: false, data: opts.parse(null) };
  return { exists: true, data: opts.parse(data.data) };
}
