"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";

export default function MigrationDialog() {
  const { pendingMigration, confirmMigrationUpload, confirmMigrationDiscard } =
    useAuth();
  const [busy, setBusy] = useState<"upload" | "discard" | null>(null);
  const [error, setError] = useState<string>("");

  if (!pendingMigration) return null;

  const {
    progressKeys,
    collections,
    streakCurrent,
    streakLongest,
    dailyGoal,
  } = pendingMigration;

  const doUpload = async () => {
    setBusy("upload");
    setError("");
    try {
      await confirmMigrationUpload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  };
  const doDiscard = async () => {
    setBusy("discard");
    setError("");
    try {
      await confirmMigrationDiscard();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
          Nahrát vaše data do cloudu?
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          V tomto zařízení máme uložená vaše dosavadní data. Chcete je nahrát
          na účet, ať jsou k dispozici i jinde? Původní data ve zdejším
          prohlížeči zůstanou zachovaná jako záloha.
        </p>
        <ul className="text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-[#0f172a] rounded-lg p-3 mb-4 space-y-1 border border-gray-100 dark:border-gray-700">
          <li>
            <span className="font-medium">Postup:</span>{" "}
            {progressKeys === 0
              ? "žádný"
              : `${progressKeys} ${progressKeys === 1 ? "položka" : progressKeys < 5 ? "položky" : "položek"}`}
          </li>
          <li>
            <span className="font-medium">Záložky/kolekce:</span>{" "}
            {collections === 0
              ? "žádné"
              : `${collections} ${collections === 1 ? "kolekce" : collections < 5 ? "kolekce" : "kolekcí"}`}
          </li>
          <li>
            <span className="font-medium">Streak:</span>{" "}
            {streakCurrent} dní (nejdelší {streakLongest}), denní cíl {dailyGoal}
          </li>
        </ul>
        {error && (
          <p className="text-xs text-[var(--color-wrong)] mb-3">
            Nepodařilo se nahrát: {error}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={doUpload}
            disabled={busy !== null}
            className="w-full px-4 py-3 rounded-lg text-sm font-semibold bg-[var(--color-primary)] text-white tap-highlight active:opacity-80 transition-opacity disabled:opacity-50"
          >
            {busy === "upload" ? "Nahrávám…" : "Nahrát vše"}
          </button>
          <button
            type="button"
            onClick={doDiscard}
            disabled={busy !== null}
            className="w-full px-4 py-3 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 tap-highlight active:opacity-80 transition-opacity disabled:opacity-50"
          >
            {busy === "discard" ? "Připravuji…" : "Začít od nuly"}
          </button>
        </div>
      </div>
    </div>
  );
}
