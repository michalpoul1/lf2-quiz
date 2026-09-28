"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { FACULTY_KEY } from "@/lib/progressStore";

function countLocalItems(data: Record<string, unknown>): number {
  const bucket = data[FACULTY_KEY] as Record<string, unknown> | undefined;
  if (!bucket) return 0;
  let count = 0;
  for (const subject of Object.values(bucket)) {
    if (subject && typeof subject === "object") {
      count += Object.keys(subject as Record<string, unknown>).length;
    }
  }
  return count;
}

export default function MigrationDialog() {
  const { pendingMigration, confirmMigrationUpload, confirmMigrationDiscard } = useAuth();
  const [busy, setBusy] = useState<"upload" | "discard" | null>(null);
  const [error, setError] = useState<string>("");

  if (!pendingMigration) return null;

  const localCount = countLocalItems(pendingMigration.localData);

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
          Nahrát váš postup do cloudu?
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          V tomto zařízení máme uložený váš dosavadní postup ({localCount}{" "}
          {localCount === 1 ? "položka" : localCount < 5 ? "položky" : "položek"}).
          Chcete ho nahrát na účet, ať máte data k dispozici i jinde? Původní
          data ve zdejším prohlížeči zůstanou zachovaná jako záloha.
        </p>
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
            {busy === "upload" ? "Nahrávám…" : "Nahrát postup"}
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
