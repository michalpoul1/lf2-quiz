"use client";

import { getSupabase } from "./supabase";
import {
  type AllProgress,
  peekLocal,
  reloadFromLocal,
  setCloudAdapter,
  setCloudData,
  setCloudDataAndFlush,
  setLoading,
  FACULTY_KEY,
} from "./progressStore";

/**
 * Bridges the auth state with the progress store.
 *
 * Public flow used by AuthProvider:
 *   startSyncFor(userId) → returns
 *     { needsMigrationChoice: true, localData }  when the cloud row is
 *       missing AND local storage has data → the app should show the
 *       migration dialog and then call one of `finishMigrationUpload` /
 *       `finishMigrationDiscard`.
 *     { needsMigrationChoice: false }             otherwise.
 *   stopSync()  → called on logout.
 */

const TABLE = "user_progress";

function hasLocalPayload(data: AllProgress): boolean {
  const bucket = data[FACULTY_KEY];
  if (!bucket) return false;
  return Object.keys(bucket).length > 0;
}

async function fetchRow(
  userId: string
): Promise<{ exists: boolean; data: AllProgress }> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { exists: false, data: {} };
  return { exists: true, data: (data.data as AllProgress) || {} };
}

async function upsertRow(userId: string, data: AllProgress): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

function installAdapter(userId: string) {
  setCloudAdapter({
    async save(data: AllProgress) {
      await upsertRow(userId, data);
    },
  });
}

export interface StartSyncResult {
  needsMigrationChoice: boolean;
  localData?: AllProgress;
}

/**
 * Kick off cloud sync for the just-logged-in user.
 * Never throws — errors become "error" mode inside the store.
 */
export async function startSyncFor(userId: string): Promise<StartSyncResult> {
  setLoading();
  installAdapter(userId);
  try {
    const row = await fetchRow(userId);
    if (row.exists) {
      setCloudData(row.data);
      return { needsMigrationChoice: false };
    }
    // No row yet. Do we have local data worth offering to migrate?
    const local = peekLocal();
    if (hasLocalPayload(local)) {
      // Defer to the UI: it'll call finishMigrationUpload/Discard.
      return { needsMigrationChoice: true, localData: local };
    }
    // Empty local, empty cloud → create empty row and enter cloud mode.
    await upsertRow(userId, {});
    setCloudData({});
    return { needsMigrationChoice: false };
  } catch (err) {
    // Fetch failed. Keep local mode so the user can still work; sync will
    // recover next login.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[progressSync] hydration failed:", msg);
    reloadFromLocal();
    return { needsMigrationChoice: false };
  }
}

/**
 * Upload the given local payload as the initial cloud state. Called after
 * the user confirms "Nahrát postup" in the migration dialog.
 */
export async function finishMigrationUpload(
  userId: string,
  data: AllProgress
): Promise<void> {
  installAdapter(userId);
  await setCloudDataAndFlush(data);
}

/**
 * User chose "Začít od nuly" — create empty cloud row, keep localStorage as
 * a passive backup (per Krok 4 spec).
 */
export async function finishMigrationDiscard(userId: string): Promise<void> {
  installAdapter(userId);
  await setCloudDataAndFlush({});
}

/** Called on logout — drop the cloud adapter and reload from localStorage. */
export function stopSync(): void {
  setCloudAdapter(null);
  reloadFromLocal();
}
