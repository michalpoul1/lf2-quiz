"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { faculties } from "@/config/faculties";
import { getSubjectData, getChapterQuestions, countValidQuestions } from "@/lib/data";
import { getTotalProgress } from "@/lib/progress";

interface FacultyStats {
  subjectCount: number;
  totalQuestions: number;
  answered: number;
}

export default function Home() {
  const [stats, setStats] = useState<Record<string, FacultyStats>>({});

  useEffect(() => {
    const s: Record<string, FacultyStats> = {};
    for (const f of faculties) {
      if (!f.active) continue;
      let totalQuestions = 0;
      let answered = 0;
      for (const subj of f.subjects) {
        const data = getSubjectData(f.id, subj.id);
        if (!data) continue;
        for (const ch of data.chapters) {
          totalQuestions += countValidQuestions(getChapterQuestions(f.id, subj.id, ch.id));
        }
        const tp = getTotalProgress(f.id, subj.id);
        answered += tp.answered;
      }
      s[f.id] = {
        subjectCount: f.subjects.length,
        totalQuestions,
        answered,
      };
    }
    setStats(s);
  }, []);

  return (
    <main className="pt-10">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-primary)] dark:text-blue-400">
          Přijímačky na medicínu
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Modelové otázky pro přijímací zkoušky na lékařské fakulty
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {faculties.map((f) => {
          if (f.active) {
            const st = stats[f.id];
            const totalQuestions = st?.totalQuestions ?? 0;
            const answered = st?.answered ?? 0;
            const pct = totalQuestions > 0 ? Math.min(100, Math.round((answered / totalQuestions) * 100)) : 0;
            return (
              <Link
                key={f.id}
                href={`/faculty/${f.id}`}
                className="block bg-white dark:bg-[#1e293b] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 tap-highlight active:bg-gray-50 dark:active:bg-gray-800 transition-colors"
              >
                <div className="text-xl font-bold text-[var(--color-primary)] dark:text-blue-400 mb-1">
                  {f.shortName}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate mb-3">
                  {f.fullName}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1.5">
                  {f.subjects.length} {f.subjects.length === 1 ? "předmět" : f.subjects.length < 5 ? "předměty" : "předmětů"} · {totalQuestions} otázek
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                  <div
                    className="bg-[var(--color-correct)] h-1.5 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </Link>
            );
          }
          return (
            <div
              key={f.id}
              className="block bg-white dark:bg-[#1e293b] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 opacity-50 cursor-not-allowed"
            >
              <div className="text-xl font-bold text-gray-400 dark:text-gray-500 mb-1">
                {f.shortName}
              </div>
              <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate mb-3">
                {f.fullName}
              </div>
              <div className="text-[11px] text-gray-400 dark:text-gray-500">
                Připravujeme
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
