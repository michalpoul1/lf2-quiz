"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSubjectData, countValidQuestions } from "@/lib/data";
import { getChapterProgress } from "@/lib/progress";
import type { ChapterProgress } from "@/lib/types";

interface Props {
  subject: string;
  subjectPath: string; // "chemistry"
  chapterId: number;
  backHref: string;
}

export default function SubchapterList({
  subject,
  subjectPath,
  chapterId,
  backHref,
}: Props) {
  const data = getSubjectData(subject);
  const chapter = data?.chapters.find((ch) => ch.id === chapterId);
  const [subProgress, setSubProgress] = useState<Record<string, ChapterProgress>>({});

  useEffect(() => {
    if (!chapter?.subchapters) return;
    const sp: Record<string, ChapterProgress> = {};
    for (const sub of chapter.subchapters) {
      sp[sub.id] = getChapterProgress(subject, sub.id);
    }
    setSubProgress(sp);
  }, [chapter, subject]);

  if (!chapter) {
    return (
      <main className="pt-10 text-center">
        <p className="text-gray-500">Kapitola nenalezena.</p>
        <Link href={backHref} className="text-[var(--color-primary)] dark:text-blue-400 font-medium">
          Zpět
        </Link>
      </main>
    );
  }

  if (!chapter.subchapters || chapter.subchapters.length === 0) {
    // Shouldn't happen if used correctly, but fail gracefully.
    return (
      <main className="pt-10 text-center">
        <p className="text-gray-500">Kapitola nemá podkapitoly.</p>
        <Link href={backHref} className="text-[var(--color-primary)] dark:text-blue-400 font-medium">
          Zpět
        </Link>
      </main>
    );
  }

  const totalValid = chapter.subchapters.reduce(
    (sum, s) => sum + countValidQuestions(s.questions),
    0
  );

  return (
    <main className="pt-6 pb-6">
      <Link
        href={backHref}
        className="inline-flex items-center text-sm text-gray-500 mb-4 tap-highlight"
      >
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Zpět na kapitoly
      </Link>

      <h1 className="text-xl font-bold text-[var(--color-primary)] dark:text-blue-400 mb-1">
        {chapter.id}. {chapter.name}
      </h1>
      <p className="text-sm text-gray-500 mb-5">{totalValid} otázek</p>

      <Link
        href={`/${subjectPath}/quiz?chapter=${chapterId}`}
        className="block w-full text-center bg-[var(--color-primary)] text-white font-semibold py-3.5 rounded-xl mb-5 tap-highlight active:opacity-80 transition-opacity"
      >
        Procvičit celou kapitolu od začátku
      </Link>

      <div className="space-y-2.5">
        {chapter.subchapters.map((sub) => {
          const validCount = countValidQuestions(sub.questions);
          const cp = subProgress[sub.id] || { answered: 0, correct: 0, wrongIds: [] };
          return (
            <Link
              key={sub.id}
              href={`/${subjectPath}/chapter/${chapterId}/${encodeURIComponent(sub.id)}`}
              className="block bg-white dark:bg-[#1e293b] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 tap-highlight active:bg-gray-50 dark:active:bg-gray-800 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <h2 className="text-base font-semibold text-[var(--color-primary)] dark:text-blue-400 leading-snug flex-1 min-w-0">
                  {sub.id} {sub.name}
                </h2>
                <div className="flex items-center gap-1 pt-0.5 flex-shrink-0">
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {validCount} ot.
                  </span>
                  <svg className="w-4 h-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              {cp.answered > 0 && (
                <div className="mt-2">
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                    <div
                      className="bg-[var(--color-correct)] h-1.5 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.round((cp.correct / validCount) * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {cp.correct}/{cp.answered} správně
                  </p>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </main>
  );
}
