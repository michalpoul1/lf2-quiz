/**
 * localStorage backup/restore for the 2. LF UK quiz.
 *
 * All app state lives under keys with the `lf2-quiz-` prefix (progress,
 * wrongIds, bookmarks, collections, streak, daily goal, theme, test history…).
 * Export snapshots every such key. Import validates the header, asks for
 * confirmation, then overwrites those keys — other localStorage entries stay
 * untouched.
 */

const KEY_PREFIX = "lf2-quiz-";
const BACKUP_MAGIC = "lf2-quiz-backup";
const BACKUP_VERSION = 1;

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
