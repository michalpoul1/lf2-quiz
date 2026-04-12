"use client";

import { useTheme } from "@/lib/theme";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <main className="pt-6 pb-4 fade-in">
      <h1 className="text-2xl font-bold text-[var(--color-primary)] dark:text-blue-400 mb-5">
        Nastavení
      </h1>

      <div className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="font-medium">Tmavý režim</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
              {theme === "dark" ? "Zapnutý" : "Vypnutý"}
            </p>
          </div>
          <button
            onClick={toggleTheme}
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

      <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-8">
        Přijímačky na 2. LF UK &middot; v1.0
      </p>
    </main>
  );
}
