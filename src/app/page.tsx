"use client";

import Link from "next/link";
import { useState } from "react";
import { getSubjectData } from "@/lib/data";
import { getTotalProgress } from "@/lib/progress";
import { getStreak, getTodayCount, getDailyGoal } from "@/lib/streak";
import { useRefreshOnReturn } from "@/lib/useRefreshOnReturn";
import GlobalSearch from "@/components/GlobalSearch";

const SUBJECTS = [
  { id: "biology", name: "Biologie" },
  { id: "chemistry", name: "Chemie" },
  { id: "physics", name: "Fyzika" },
];

export default function Home() {
  const [progress, setProgress] = useState<
    Record<string, { answered: number; correct: number }>
  >({});
  const [streak, setStreak] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [goal, setGoal] = useState(10);

  useRefreshOnReturn(() => {
    const p: Record<string, { answered: number; correct: number }> = {};
    for (const s of SUBJECTS) {
      p[s.id] = getTotalProgress(s.id);
    }
    setProgress(p);
    setStreak(getStreak());
    setTodayCount(getTodayCount());
    setGoal(getDailyGoal());
  });

  const goalPct = goal > 0 ? Math.min(100, Math.round((todayCount / goal) * 100)) : 0;
  // Compact SVG ring: r=18, C=2πr≈113.1
  const ringR = 18;
  const ringC = 2 * Math.PI * ringR;
  const ringDash = (goalPct / 100) * ringC;

  return (
    <main className="pt-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-primary)] text-white text-xl font-bold mb-4">
          2.LF
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-primary)] dark:text-blue-400">
          Přijímačky na 2. LF UK
        </h1>
        <p className="text-gray-500 mt-1 text-base">
          Modelové otázky pro přijímací zkoušky
        </p>
      </div>

      <GlobalSearch />

      {/* Streak + daily-goal card */}
      <div className="flex items-center gap-4 bg-white dark:bg-[#1e293b] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none" aria-hidden="true">🔥</span>
          <div>
            <p className="text-xl font-bold leading-tight text-gray-800 dark:text-gray-100">
              {streak}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
              {streak === 1 ? "den v řadě" : streak < 5 ? "dny v řadě" : "dní v řadě"}
            </p>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="relative w-11 h-11" aria-label={`Dnes ${todayCount} z ${goal}`}>
            <svg viewBox="0 0 44 44" className="w-11 h-11 -rotate-90">
              <circle cx="22" cy="22" r={ringR} className="fill-none stroke-gray-200 dark:stroke-gray-700" strokeWidth="4" />
              <circle
                cx="22"
                cy="22"
                r={ringR}
                className="fill-none stroke-[var(--color-correct)] transition-all"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${ringDash} ${ringC}`}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-gray-700 dark:text-gray-200">
              {Math.min(todayCount, goal)}
            </span>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-200">
              Dnes {todayCount} / {goal}
            </p>
            <Link
              href="/settings"
              className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-[var(--color-primary)] dark:hover:text-blue-400"
            >
              Změnit cíl
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <Link
          href="/quick-test"
          className="block rounded-2xl p-5 bg-gradient-to-br from-amber-400 to-orange-500 dark:from-amber-500 dark:to-orange-600 shadow-md tap-highlight active:opacity-90 transition-opacity"
        >
          <svg className="w-8 h-8 text-white mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
          <h2 className="text-white font-bold text-base">Rychlý test</h2>
          <p className="text-white/80 text-xs mt-0.5">Náhodné otázky</p>
        </Link>
        <Link
          href="/exam-simulation"
          className="block rounded-2xl p-5 bg-gradient-to-br from-violet-500 to-purple-600 dark:from-violet-600 dark:to-purple-700 shadow-md tap-highlight active:opacity-90 transition-opacity"
        >
          <svg className="w-8 h-8 text-white mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-white font-bold text-base">Simulace</h2>
          <p className="text-white/80 text-xs mt-0.5">Přijímací zkouška</p>
        </Link>
      </div>

      <div className="space-y-3">
        {SUBJECTS.map((s) => {
          const data = getSubjectData(s.id);
          const total = data?.totalQuestions ?? 0;
          const p = progress[s.id] || { answered: 0, correct: 0 };

          return (
            <Link
              key={s.id}
              href={`/${s.id}`}
              className="block bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 tap-highlight active:bg-gray-50 dark:active:bg-gray-800 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-[var(--color-primary)] dark:text-blue-400">
                  {s.name}
                </h2>
                <span className="text-sm text-gray-400">
                  {total} otázek
                </span>
              </div>
              {p.answered > 0 ? (
                <>
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 mb-1.5">
                    <div
                      className="bg-[var(--color-correct)] h-2 rounded-full transition-all"
                      style={{
                        width: total > 0 ? `${Math.round((p.correct / total) * 100)}%` : "0%",
                      }}
                    />
                  </div>
                  <p className="text-sm text-gray-500">
                    {p.correct} / {p.answered} správně
                    ({Math.round((p.correct / p.answered) * 100)} %)
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400">Zatím nezahájeno</p>
              )}
            </Link>
          );
        })}
      </div>
    </main>
  );
}
