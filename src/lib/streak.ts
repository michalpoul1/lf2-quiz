/**
 * Daily streak + per-day goal. Public API is unchanged; reads and writes
 * now go through streakStore which flushes to localStorage (logged out)
 * or Supabase user_streak (logged in).
 */

import {
  DEFAULT_GOAL,
  streakStore,
  hydrateLegacyStreakGoal,
  type StreakData,
} from "./streakStore";

export { DEFAULT_GOAL };
export type { StreakData };

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ensureHydrated() {
  streakStore.hydrateFromLocalOnce();
  hydrateLegacyStreakGoal();
}

export function getDailyGoal(): number {
  if (typeof window === "undefined") return DEFAULT_GOAL;
  ensureHydrated();
  return streakStore.getState().data.dailyGoal;
}

export function setDailyGoal(n: number): void {
  if (typeof window === "undefined") return;
  ensureHydrated();
  const clamped = Math.max(1, Math.round(n));
  streakStore.mutate((d) => {
    d.dailyGoal = clamped;
  });
}

export function bumpTodayCount(): void {
  if (typeof window === "undefined") return;
  ensureHydrated();
  const today = todayStr();
  const yesterday = yesterdayStr();
  streakStore.mutate((blob) => {
    const data = blob.streak;
    const goal = blob.dailyGoal;

    if (data.lastActiveDate !== today) {
      data.todayCount = 0;
      data.lastActiveDate = today;
      if (data.lastMetDate !== today && data.lastMetDate !== yesterday) {
        data.current = 0;
      }
    }

    data.todayCount += 1;

    if (data.todayCount >= goal && data.lastMetDate !== today) {
      if (data.lastMetDate === yesterday) {
        data.current += 1;
      } else {
        data.current = 1;
      }
      data.lastMetDate = today;
      if (data.current > data.longest) data.longest = data.current;
    }
  });
}

export function getStreak(): number {
  if (typeof window === "undefined") return 0;
  ensureHydrated();
  const data = streakStore.getState().data.streak;
  if (!data.lastMetDate) return 0;
  const today = todayStr();
  const yesterday = yesterdayStr();
  if (data.lastMetDate === today || data.lastMetDate === yesterday) {
    return data.current;
  }
  return 0;
}

export function getLongestStreak(): number {
  if (typeof window === "undefined") return 0;
  ensureHydrated();
  return streakStore.getState().data.streak.longest;
}

export function getTodayCount(): number {
  if (typeof window === "undefined") return 0;
  ensureHydrated();
  const data = streakStore.getState().data.streak;
  if (data.lastActiveDate !== todayStr()) return 0;
  return data.todayCount;
}
