/**
 * localStorage backup/restore for the 2. LF UK quiz.
 *
 * All app state lives under keys with the `lf2-quiz-` prefix (progress,
 * wrongIds, bookmarks, collections, streak, daily goal, theme, test history…).
 * Export snapshots every such key. Import validates the header, asks for
 * confirmation, then overwrites those keys — other localStorage entries stay
 * untouched.
 */

import {
  getStoreState as getProgressState,
  reloadFromLocal as reloadProgressLocal,
  setCloudDataAndFlush as setProgressCloudDataAndFlush,
  FACULTY_KEY,
  type AllProgress,
} from "./progressStore";
import { collectionsStore, type CollectionsData } from "./collectionsStore";
import { streakStore, type StreakBlob, DEFAULT_GOAL } from "./streakStore";

const KEY_PREFIX = "lf2-quiz-";
const BACKUP_MAGIC = "lf2-quiz-backup";
const BACKUP_VERSION = 1;

const PROGRESS_KEY = "lf2-quiz-progress";
const COLLECTIONS_KEY = "lf2-quiz-collections";
const STREAK_KEY = "lf2-quiz-streak";
const DAILY_GOAL_KEY = "lf2-quiz-daily-goal";

const CLOUD_SYNCED_KEYS = new Set([
  PROGRESS_KEY,
  COLLECTIONS_KEY,
  STREAK_KEY,
  DAILY_GOAL_KEY,
]);

export interface BackupFile {
  magic: typeof BACKUP_MAGIC;
  version: number;
  exportedAt: string;
  userAgent: string;
  data: Record<string, string>;
}

/** Collect every localStorage entry that belongs to this app. */
export function collectAppStorage(): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof window === "undefined") return out;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(KEY_PREFIX)) continue;
    const v = localStorage.getItem(k);
    if (v !== null) out[k] = v;
  }
  return out;
}

export function buildBackup(): BackupFile {
  return {
    magic: BACKUP_MAGIC,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    data: collectAppStorage(),
  };
}

export function backupFilename(now = new Date()): string {
  const iso = now.toISOString().slice(0, 10);
  return `lf2-quiz-backup-${iso}.json`;
}

/**
 * Validate a parsed JSON payload. Returns the well-typed BackupFile or
 * throws with a human-readable Czech message so the caller can surface it.
 */
export function validateBackup(payload: unknown): BackupFile {
  if (!payload || typeof payload !== "object") {
    throw new Error("Soubor neobsahuje JSON objekt.");
  }
  const obj = payload as Record<string, unknown>;
  if (obj.magic !== BACKUP_MAGIC) {
    throw new Error(
      `Soubor není záloha z této aplikace (chybí "magic": "${BACKUP_MAGIC}").`
    );
  }
  if (typeof obj.version !== "number" || obj.version > BACKUP_VERSION) {
    throw new Error(
      `Neznámá verze zálohy (${String(obj.version)}). Podporovaná: ${BACKUP_VERSION}.`
    );
  }
  if (!obj.data || typeof obj.data !== "object") {
    throw new Error("Zálohovaná data chybí nebo mají neplatný tvar.");
  }
  const data = obj.data as Record<string, unknown>;
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith(KEY_PREFIX)) {
      throw new Error(
        `Záloha obsahuje neočekávaný klíč "${k}" (mimo prefix ${KEY_PREFIX}).`
      );
    }
    if (typeof v !== "string") {
      throw new Error(`Hodnota klíče "${k}" není řetězec.`);
    }
  }
  return {
    magic: BACKUP_MAGIC,
    version: obj.version,
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : "",
    userAgent: typeof obj.userAgent === "string" ? obj.userAgent : "",
    data: data as Record<string, string>,
  };
}

/**
 * Replace all app-prefixed localStorage entries with the backup's payload.
 * Wipes existing app keys first so a smaller backup shrinks storage instead
 * of merging over stale entries. Non-app keys are left alone.
 */
export function restoreBackup(backup: BackupFile): void {
  if (typeof window === "undefined") return;
  const existing: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(KEY_PREFIX)) existing.push(k);
  }
  for (const k of existing) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(backup.data)) {
    localStorage.setItem(k, v);
  }
}

export function countBackupKeys(backup: BackupFile): number {
  return Object.keys(backup.data).length;
}

// ─── Smart restore — cloud-aware ─────────────────────────────────────────

function safeParseJSON(raw: string | undefined): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function parseProgressPayload(raw: string | undefined): AllProgress {
  const v = safeParseJSON(raw);
  if (!v || typeof v !== "object") return {};
  const obj = v as Record<string, unknown>;
  // Tolerate the legacy flat shape where subject names were top-level keys.
  const legacyKeys = ["biology", "chemistry", "physics"];
  if (legacyKeys.some((k) => k in obj)) {
    const bucket: Record<string, unknown> = {};
    const rest: Record<string, unknown> = {};
    for (const [k, v2] of Object.entries(obj)) {
      if (legacyKeys.includes(k)) bucket[k] = v2;
      else rest[k] = v2;
    }
    return { ...(rest as AllProgress), [FACULTY_KEY]: bucket } as AllProgress;
  }
  return obj as AllProgress;
}

function parseCollectionsPayload(raw: string | undefined): CollectionsData {
  const v = safeParseJSON(raw);
  if (!v || typeof v !== "object") return { collections: [] };
  const obj = v as Record<string, unknown>;
  if (!Array.isArray(obj.collections)) return { collections: [] };
  return { collections: obj.collections as CollectionsData["collections"] };
}

function parseStreakPayload(
  streakRaw: string | undefined,
  dailyGoalRaw: string | undefined
): StreakBlob {
  const empty: StreakBlob = {
    streak: {
      current: 0,
      longest: 0,
      lastActiveDate: "",
      todayCount: 0,
      lastMetDate: "",
    },
    dailyGoal: DEFAULT_GOAL,
  };
  const sVal = safeParseJSON(streakRaw);
  let blob: StreakBlob = empty;
  if (sVal && typeof sVal === "object") {
    const obj = sVal as Record<string, unknown>;
    if (obj.streak || obj.dailyGoal != null) {
      // New combined shape.
      const s = (obj.streak as Partial<StreakBlob["streak"]>) ?? {};
      blob = {
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
            : DEFAULT_GOAL,
      };
    } else {
      // Legacy top-level StreakData.
      const legacy = obj as Partial<StreakBlob["streak"]> & { lastDate?: string };
      blob = {
        streak: {
          current: typeof legacy.current === "number" ? legacy.current : 0,
          longest:
            typeof legacy.longest === "number"
              ? legacy.longest
              : typeof legacy.current === "number"
              ? legacy.current
              : 0,
          lastActiveDate: legacy.lastActiveDate ?? legacy.lastDate ?? "",
          todayCount: typeof legacy.todayCount === "number" ? legacy.todayCount : 0,
          lastMetDate: legacy.lastMetDate ?? legacy.lastDate ?? "",
        },
        dailyGoal: DEFAULT_GOAL,
      };
    }
  }
  // Separate dailyGoal key wins if present (legacy backups had both).
  if (dailyGoalRaw) {
    const n = Number(dailyGoalRaw);
    if (Number.isFinite(n) && n >= 1) blob = { ...blob, dailyGoal: Math.round(n) };
  }
  return blob;
}

function removeLocal(key: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
function writeLocal(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota exceeded — nothing we can do */
  }
}

/**
 * Restore a backup, respecting the current sync mode for cloud-synced stores:
 *  - If a store is in cloud/loading/error mode → upload the backup payload
 *    straight to Supabase via setCloudDataAndFlush. localStorage mirror is
 *    cleared so no stale copy survives.
 *  - If a store is in local mode → write the payload to localStorage and
 *    reload the store so the UI updates immediately.
 *
 * Non-cloud-synced keys (theme, test-history, legacy bookmarks) always go
 * to localStorage, matching the original restoreBackup behaviour.
 *
 * The caller sees any upload error (we rethrow after cleaning up).
 */
export async function restoreBackupSmart(backup: BackupFile): Promise<void> {
  if (typeof window === "undefined") return;

  // 1) Remove every app key not present in the backup (same destructive
  //    semantics as restoreBackup). We skip the cloud-synced ones here — they
  //    get handled per store below.
  const existing: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(KEY_PREFIX)) existing.push(k);
  }
  for (const k of existing) {
    if (!CLOUD_SYNCED_KEYS.has(k)) removeLocal(k);
  }

  // 2) Write non-cloud keys from backup.
  for (const [k, v] of Object.entries(backup.data)) {
    if (CLOUD_SYNCED_KEYS.has(k)) continue;
    writeLocal(k, v);
  }

  // 3) Apply cloud-synced payloads via the stores.
  const isCloud = (mode: string) =>
    mode === "cloud" || mode === "loading" || mode === "error";

  const progressTarget = parseProgressPayload(backup.data[PROGRESS_KEY]);
  const collectionsTarget = parseCollectionsPayload(backup.data[COLLECTIONS_KEY]);
  const streakTarget = parseStreakPayload(
    backup.data[STREAK_KEY],
    backup.data[DAILY_GOAL_KEY]
  );

  // Progress
  if (isCloud(getProgressState().mode)) {
    removeLocal(PROGRESS_KEY);
    await setProgressCloudDataAndFlush(progressTarget);
  } else {
    writeLocal(PROGRESS_KEY, JSON.stringify(progressTarget));
    reloadProgressLocal();
  }

  // Collections
  if (isCloud(collectionsStore.getState().mode)) {
    removeLocal(COLLECTIONS_KEY);
    await collectionsStore.setCloudDataAndFlush(collectionsTarget);
  } else {
    writeLocal(COLLECTIONS_KEY, JSON.stringify(collectionsTarget));
    collectionsStore.reloadFromLocal();
  }

  // Streak (store already merges legacy daily-goal via hydrateLegacyStreakGoal,
  // but on an in-cloud session there's no re-hydration, so we uploaded the
  // combined blob directly above).
  if (isCloud(streakStore.getState().mode)) {
    removeLocal(STREAK_KEY);
    removeLocal(DAILY_GOAL_KEY);
    await streakStore.setCloudDataAndFlush(streakTarget);
  } else {
    writeLocal(STREAK_KEY, JSON.stringify(streakTarget));
    removeLocal(DAILY_GOAL_KEY);
    streakStore.reloadFromLocal();
  }
}
