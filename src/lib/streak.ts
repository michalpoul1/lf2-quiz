/**
 * Daily streak with a configurable per-day goal.
 *
 * Storage keys (namespace `2lf`, additive — no old data is destroyed):
 * - `lf2-quiz-daily-goal` — number; default 10.
 * - `lf2-quiz-streak` — StreakData object. Reads tolerate the legacy shape
 *   `{ current, lastDate }` from the earlier implementation and pad missing
 *   fields with defaults.
 */

const GOAL_KEY = "lf2-quiz-daily-goal";
const STREAK_KEY = "lf2-quiz-streak";
export const DEFAULT_GOAL = 10;

export interface StreakData {
  /** Current consecutive-days-meeting-goal count. */
  current: number;
  /** All-time best `current`. */
  longest: number;
  /** Last calendar day (YYYY-MM-DD, local time) any answer was recorded. */
  lastActiveDate: string;
  /** Answers recorded on `lastActiveDate`. Resets when a new day starts. */
  todayCount: number;
  /** Last calendar day the daily goal was reached — drives streak continuity. */
  lastMetDate: string;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyStreak(): StreakData {
  return { current: 0, longest: 0, lastActiveDate: "", todayCount: 0, lastMetDate: "" };
}

/** Read StreakData, tolerating legacy `{current, lastDate}` shape. */
function readStreak(): StreakData {
  if (typeof window === "undefined") return emptyStreak();
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return emptyStreak();
    const parsed = JSON.parse(raw) as Partial<StreakData> & { lastDate?: string };
    return {
      current: typeof parsed.current === "number" ? parsed.current : 0,
      longest: typeof parsed.longest === "number"
        ? parsed.longest
        : (typeof parsed.current === "number" ? parsed.current : 0),
      lastActiveDate: parsed.lastActiveDate ?? parsed.lastDate ?? "",
      todayCount: typeof parsed.todayCount === "number" ? parsed.todayCount : 0,
      lastMetDate: parsed.lastMetDate ?? parsed.lastDate ?? "",
    };
  } catch {
    return emptyStreak();
  }
}

function writeStreak(data: StreakData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STREAK_KEY, JSON.stringify(data));
}

export function getDailyGoal(): number {
  if (typeof window === "undefined") return DEFAULT_GOAL;
  try {
    const raw = localStorage.getItem(GOAL_KEY);
    if (!raw) return DEFAULT_GOAL;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return DEFAULT_GOAL;
    return Math.round(n);
  } catch {
    return DEFAULT_GOAL;
  }
}

export function setDailyGoal(n: number): void {
  if (typeof window === "undefined") return;
  const clamped = Math.max(1, Math.round(n));
  localStorage.setItem(GOAL_KEY, String(clamped));
}

/**
 * Bump today's answer count by one and, if today's goal has just been met,
 * advance the streak. Called from `recordAnswer` so both chapter practice
 * and quick/simulation tests contribute.
 *
 * Rules:
 * - Every call increments `todayCount` for the local calendar day.
 * - Rollover on a new day resets `todayCount` and, if the last-met day is
 *   older than yesterday, also resets `current` to 0.
 * - Streak advances at most once per day (the first bump that reaches goal).
 */
export function bumpTodayCount(): void {
  if (typeof window === "undefined") return;
  const today = todayStr();
  const yesterday = yesterdayStr();
  const goal = getDailyGoal();
  const data = readStreak();

  // Daily rollover — a new local day since the last recorded answer.
  if (data.lastActiveDate !== today) {
    data.todayCount = 0;
    data.lastActiveDate = today;
    // If the streak wasn't kept alive yesterday or today, it breaks.
    if (data.lastMetDate !== today && data.lastMetDate !== yesterday) {
      data.current = 0;
    }
  }

  data.todayCount += 1;

  // Goal met — advance streak at most once per day.
  if (data.todayCount >= goal && data.lastMetDate !== today) {
    if (data.lastMetDate === yesterday) {
      data.current += 1;
    } else {
      data.current = 1;
    }
    data.lastMetDate = today;
    if (data.current > data.longest) data.longest = data.current;
  }

  writeStreak(data);
}

/**
 * The current streak, adjusted for today. Returns 0 if the last goal-met
 * date is neither today nor yesterday (streak is broken).
 */
export function getStreak(): number {
  const data = readStreak();
  if (!data.lastMetDate) return 0;
  const today = todayStr();
  const yesterday = yesterdayStr();
  if (data.lastMetDate === today || data.lastMetDate === yesterday) {
    return data.current;
  }
  return 0;
}

/** All-time best streak. */
export function getLongestStreak(): number {
  return readStreak().longest;
}

/** How many answers the user has recorded today (reset on new local day). */
export function getTodayCount(): number {
  const data = readStreak();
  if (data.lastActiveDate !== todayStr()) return 0;
  return data.todayCount;
}
