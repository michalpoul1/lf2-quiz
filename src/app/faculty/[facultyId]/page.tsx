"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSubjectData } from "@/lib/data";
import { getTotalProgress } from "@/lib/progress";
import { getFaculty } from "@/config/faculties";
import GlobalSearch from "@/components/GlobalSearch";

export default function FacultyHome() {
  const routeParams = useParams();
  const facultyId = String(routeParams?.facultyId ?? "2lf");
  const faculty = getFaculty(facultyId);

  const [progress, setProgress] = useState<
    Record<string, { answered: number; correct: number }>
  >({});

  useEffect(() => {
    if (!faculty) return;
    const p: Record<string, { answered: number; correct: number }> = {};
    for (const s of faculty.subjects) {
      p[s.id] = getTotalProgress(facultyId, s.id);
    }
    setProgress(p);
  }, [facultyId, faculty]);

  if (!faculty) {
    return (
      <main className="pt-20 text-center">
        <h1 className="text-xl font-bold mb-2">Fakulta nenalezena</h1>
        <Link href="/" className="text-[var(--color-primary)] dark:text-blue-400 font-medium">
          Zpět na výběr fakulty
        </Link>
      </main>
    );
  }

  return (
    <main className="pt-6">
      <Link
        href="/"
        className="inline-flex items-center text-sm text-gray-500 mb-4 tap-highlight"
      >
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Zpět
      </Link>

      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-primary)] text-white text-xl font-bold mb-4">
          {faculty.shortName}
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-primary)] dark:text-blue-400">
          Přijímačky na {faculty.name}
        </h1>
        <p className="text-gray-500 mt-1 text-base">
          Modelové otázky pro přijímací zkoušky
        </p>
      </div>

      <GlobalSearch />

      <div className="grid grid-cols-2 gap-3 mb-5">
        <Link
          href={`/faculty/${facultyId}/quick-test`}
          className="block rounded-2xl p-5 bg-gradient-to-br from-amber-400 to-orange-500 dark:from-amber-500 dark:to-orange-600 shadow-md tap-highlight active:opacity-90 transition-opacity"
        >
          <svg className="w-8 h-8 text-white mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
          <h2 className="text-white font-bold text-base">Rychlý test</h2>
          <p className="text-white/80 text-xs mt-0.5">Náhodné otázky</p>
        </Link>
        <Link
          href={`/faculty/${facultyId}/exam-simulation`}
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
        {faculty.subjects.map((s) => {
          const data = getSubjectData(facultyId, s.id);
          const total = data?.totalQuestions ?? 0;
          const p = progress[s.id] || { answered: 0, correct: 0 };

          return (
            <Link
              key={s.id}
              href={`/faculty/${facultyId}/${s.id}`}
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
