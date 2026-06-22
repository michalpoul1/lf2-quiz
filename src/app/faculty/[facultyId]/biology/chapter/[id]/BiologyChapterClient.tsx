"use client";

import Link from "next/link";
import { useEffect, useState, use } from "react";
import { useParams } from "next/navigation";
import { getSubjectData, countValidQuestions, getChapterQuestions } from "@/lib/data";
import { getChapterProgress } from "@/lib/progress";
import type { ChapterProgress } from "@/lib/types";

export default function BiologyChapterClient({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const routeParams = useParams();
  const facultyId = String(routeParams?.facultyId ?? "2lf");
  const chapterId = Number(params.id);
  const data = getSubjectData(facultyId, "biology");
  const chapter = data?.chapters.find((ch) => ch.id === chapterId);

  const [subProgress, setSubProgress] = useState<Record<string, ChapterProgress>>({});

  useEffect(() => {
    if (!chapter?.subchapters) return;
    const sp: Record<string, ChapterProgress> = {};
    for (const sub of chapter.subchapters) {
      sp[sub.id] = getChapterProgress(facultyId, "biology", sub.id);
    }
    setSubProgress(sp);
  }, [chapter, facultyId]);

  if (!chapter) {
    return (
      <main className="pt-10 text-center">
        <p className="text-gray-500">Kapitola nenalezena.</p>
        <Link href={`/faculty/${facultyId}/biology`} className="text-[var(--color-primary)] dark:text-blue-400 font-medium">
          Zpět
        </Link>
      </main>
    );
  }

  const totalValid = countValidQuestions(getChapterQuestions(facultyId, "biology", chapterId));

  return (
    <main className="pt-6">
      <Link
        href={`/faculty/${facultyId}/biology`}
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
      <p className="text-sm text-gray-500 mb-5">
        {totalValid} otázek
      </p>

      <Link
        href={`/faculty/${facultyId}/biology/quiz?chapter=${chapterId}`}
        className="block w-full text-center bg-[var(--color-primary)] text-white font-semibold py-3.5 rounded-xl mb-5 tap-highlight active:opacity-80 transition-opacity"
      >
        Procvičovat celou kapitolu
      </Link>

      {chapter.subchapters && (
        <div className="space-y-2.5">
          {chapter.subchapters.map((sub) => {
            const validCount = countValidQuestions(sub.questions);
            const cp = subProgress[sub.id] || { answered: 0, correct: 0, wrongIds: [] };

            return (
              <Link
                key={sub.id}
                href={`/faculty/${facultyId}/biology/quiz?chapter=${chapterId}&sub=${sub.id}`}
                className="block bg-white dark:bg-[#1e293b] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 tap-highlight active:bg-gray-50 dark:active:bg-gray-800 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h2 className="text-base font-semibold text-[var(--color-primary)] dark:text-blue-400 leading-snug flex-1 min-w-0">
                    {sub.id} {sub.name}
                  </h2>
                  <span className="text-xs text-gray-400 whitespace-nowrap pt-0.5">
                    {validCount} ot.
                  </span>
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
      )}
    </main>
  );
}
