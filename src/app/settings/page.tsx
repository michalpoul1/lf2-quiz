"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme";
import { getDailyGoal, setDailyGoal } from "@/lib/streak";
import { diagnoseWrongIds } from "@/lib/wrongIdsDiagnostics";

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

  // ── Wrong-ids diagnostics (temporary tool) ────────────────────────────────
  const [diagText, setDiagText] = useState<string>("");
  const [copyMsg, setCopyMsg] = useState<string>("");

  const runDiagnostics = () => {
    const subjects = ["biology", "chemistry", "physics"] as const;
    const report = {
      generatedAt: new Date().toISOString(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      subjects: subjects.map((s) => diagnoseWrongIds(s)),
    };
    setDiagText(JSON.stringify(report, null, 2));
    setCopyMsg("");
  };

  const copyDiag = async () => {
    if (!diagText) return;
    try {
      await navigator.clipboard.writeText(diagText);
      setCopyMsg("Zkopírováno do schránky ✓");
    } catch {
      setCopyMsg("Kopírování selhalo — označ text prstem a použij Kopírovat.");
    }
  };

  const shareDiag = async () => {
    if (!diagText) return;
    const filename = `wrongIds-diag-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const blob = new Blob([diagText], { type: "application/json" });
    // Web Share API with files (mobile browsers) — preferred path
    const anyNav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };
    if (anyNav.canShare) {
      try {
        const file = new File([blob], filename, { type: "application/json" });
        const shareData = { files: [file], title: "wrongIds diagnostics" } as ShareData;
        if (anyNav.canShare(shareData)) {
          await anyNav.share!(shareData);
          return;
        }
      } catch {
        /* fall through to download */
      }
    }
    // Fallback — anchor download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

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

      {/* Temporary diagnostic tool — remove once wrongIds bug is fully cleaned up. */}
      <div className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 mt-4">
        <p className="font-medium">Diagnostika chyb (dočasné)</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5 mb-3">
          Vygeneruje přehled záznamů v localStorage pro biologii, chemii a fyziku
          — které klíče neodpovídají aktuálním datům a jestli obsahují přesunuté
          nebo mrtvé otázky.
        </p>
        <button
          type="button"
          onClick={runDiagnostics}
          className="w-full px-4 py-3 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white tap-highlight active:opacity-80 transition-opacity"
        >
          Spustit diagnostiku
        </button>

        {diagText && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyDiag}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 tap-highlight active:opacity-80"
              >
                Kopírovat
              </button>
              <button
                type="button"
                onClick={shareDiag}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 tap-highlight active:opacity-80"
              >
                Sdílet / stáhnout
              </button>
            </div>
            {copyMsg && (
              <p className="text-xs text-[var(--color-correct)]">{copyMsg}</p>
            )}
            <pre
              className="mt-2 max-h-80 overflow-auto rounded-lg bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 p-3 text-[11px] leading-snug font-mono text-gray-800 dark:text-gray-200 whitespace-pre select-all"
            >
              {diagText}
            </pre>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-8">
        Přijímačky na 2. LF UK &middot; v1.0
      </p>
    </main>
  );
}
