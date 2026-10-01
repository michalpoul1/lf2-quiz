import { createBlobStore } from "./blobStore";

export const DEFAULT_GOAL = 10;
export const STREAK_LOCAL_KEY = "lf2-quiz-streak";
export const GOAL_LOCAL_KEY = "lf2-quiz-daily-goal";

export interface StreakData {
  current: number;
  longest: number;
  lastActiveDate: string;
  todayCount: number;
  lastMetDate: string;
}

export interface StreakBlob {
  streak: StreakData;
  dailyGoal: number;
}

export function emptyStreak(): StreakData {
  return {
    current: 0,
    longest: 0,
    lastActiveDate: "",
    todayCount: 0,
    lastMetDate: "",
  };
}

export function emptyBlob(): StreakBlob {
  return { streak: emptyStreak(), dailyGoal: DEFAULT_GOAL };
}

/**
 * Normalize a stored blob — tolerates the legacy localStorage layout where
 * streak and dailyGoal lived under separate keys.
 */
function parseBlob(raw: unknown): StreakBlob {
  if (!raw || typeof raw !== "object") return emptyBlob();
  const obj = raw as Record<string, unknown>;
  // New shape — nested under `streak` and `dailyGoal`.
  if (obj.streak || obj.dailyGoal != null) {
    const s = (obj.streak as Partial<StreakData> & { lastDate?: string }) ?? {};
    const streak: StreakData = {
      current: typeof s.current === "number" ? s.current : 0,
      longest:
        typeof s.longest === "number"
          ? s.longest
          : typeof s.current === "number"
          ? s.current
          : 0,
      lastActiveDate: s.lastActiveDate ?? s.lastDate ?? "",
      todayCount: typeof s.todayCount === "number" ? s.todayCount : 0,
      lastMetDate: s.lastMetDate ?? s.lastDate ?? "",
    };
    const goalRaw = obj.dailyGoal;
    const goalNum = typeof goalRaw === "number" ? goalRaw : Number(goalRaw);
    const dailyGoal =
      Number.isFinite(goalNum) && goalNum >= 1 ? Math.round(goalNum) : DEFAULT_GOAL;
    return { streak, dailyGoal };
  }
  // Legacy shape — plain StreakData at the top level.
  const legacy = obj as Partial<StreakData> & { lastDate?: string };
  const streak: StreakData = {
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
  };
  return { streak, dailyGoal: DEFAULT_GOAL };
}

export const streakStore = createBlobStore<StreakBlob>({
  storageKey: STREAK_LOCAL_KEY,
  eventName: "lf2-streak",
  empty: emptyBlob,
  parse: parseBlob,
});

/**
 * Legacy local data lived under TWO keys: `lf2-quiz-streak` (StreakData) and
 * `lf2-quiz-daily-goal` (number as string). Called once on first hydration
 * to merge the goal in — the streak store itself only reads
 * `lf2-quiz-streak`, so without this bridge the goal would appear reset.
 */
export function hydrateLegacyStreakGoal() {
  if (typeof window === "undefined") return;
  const current = streakStore.getState().data;
  if (current.dailyGoal !== DEFAULT_GOAL) return; // already personalised
  try {
    const raw = localStorage.getItem(GOAL_LOCAL_KEY);
    if (!raw) return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return;
    streakStore.mutate((d) => {
      d.dailyGoal = Math.round(n);
    });
  } catch {
    /* ignore */
  }
}
