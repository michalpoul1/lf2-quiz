"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme";
import { getDailyGoal, setDailyGoal } from "@/lib/streak";

const GOAL_PRESETS = [5, 10, 15, 20, 30, 50];

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [goal, setGoalState] = useState<number>(10);
  const [customValue, setCustomValue] = useState<string>("");

  useEffect(() => {
    setGoalState(getDailyGoal());
  }, []);

  const applyGoal = (n: number) => {
    setDailyGoal(n);
    setGoalState(getDailyGoal());
    setCustomValue("");
  };

  const applyCustom = () => {
    const n = Number(customValue);
    if (Number.isFinite(n) && n >= 1) applyGoal(Math.round(n));
  };

  const isPreset = GOAL_PRESETS.includes(goal);

  return (
    <main className="pt-6 pb-4 fade-in">
      <h1 className="text-2xl font-bold text-[var(--color-primary)] dark:text-blue-400 mb-5">
        Nastavení
      </h1>

      <div className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-4">
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="font-medium">Tmavý režim</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
              {theme === "dark" ? "Zapnutý" : "Vypnutý"}
            </p>
          </div>
          <button
            onClick={toggleTheme}
            aria-label="Přepnout tmavý režim"
            className={`w-12 h-7 rounded-full transition-colors relative ${
              theme === "dark" ? "bg-[var(--color-primary)]" : "bg-gray-300"
            }`}
          >
            <div
              className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                theme === "dark" ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
        <p className="font-medium">Denní cíl</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5 mb-3">
          Kolik otázek chceš zvládnout každý den, aby streak pokračoval.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {GOAL_PRESETS.map((n) => {
            const active = goal === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => applyGoal(n)}
                className={`px-4 py-2 rounded-lg text-sm font-medium tap-highlight transition-colors ${
                  active
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            Vlastní:
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            placeholder={!isPreset ? String(goal) : "např. 25"}
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyCustom();
            }}
            className="flex-1 px-3 py-2 rounded-lg text-sm bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-[var(--color-primary)]"
          />
          <button
            type="button"
            onClick={applyCustom}
            disabled={!customValue || Number(customValue) < 1}
            className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 tap-highlight"
          >
            Uložit
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          Aktuální cíl: <span className="font-medium text-gray-700 dark:text-gray-200">{goal} otázek / den</span>
        </p>
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-8">
        Přijímačky na 2. LF UK &middot; v1.0
      </p>
    </main>
  );
}
