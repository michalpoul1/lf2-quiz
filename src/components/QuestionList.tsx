"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSubjectData, filterValidQuestions } from "@/lib/data";
import { getQuestionStatus } from "@/lib/progress";
import type { Question } from "@/lib/types";

interface Props {
  subject: string;
  subjectPath: string; // e.g. "biology", "chemistry" — used in URLs
  chapterId: number;
  /** When set (chemistry two-level nav), show only this subchapter's questions. */
  subchapterId?: string;
  backHref: string;
}

interface Item {
  question: Question;
  /** progress key used by storage — chapter.id for flat, subchapter.id for chemistry */
  progressKey: string;
  /** subchapter id if this question is inside one, undefined otherwise */
  subchapterId?: string;
  /** display label for status dot */
  status: "correct" | "wrong" | "unanswered";
}

interface Group {
  id: string; // subchapter id or "" for flat
  name?: string; // subchapter name, missing for flat
  items: Item[];
}

export default function QuestionList({
  subject,
  subjectPath,
  chapterId,
  subchapterId,
  backHref,
}: Props) {
  const data = getSubjectData(subject);
  const chapter = data?.chapters.find((ch) => ch.id === chapterId);
  const focusedSub = subchapterId && chapter?.subchapters
    ? chapter.subchapters.find((s) => s.id === subchapterId)
    : undefined;

  // Rebuild status map after mount (localStorage is client-only, avoids
  // hydration mismatch).
  const [statusMap, setStatusMap] = useState<Record<string, "correct" | "wrong" | "unanswered">>({});
  const [statusLoaded, setStatusLoaded] = useState(false);

  const groups = useMemo<Group[]>(() => {
    if (!chapter) return [];
    // Case A: a specific subchapter is focused — show just its questions, no group heading.
    if (focusedSub) {
      return [
        {
          id: focusedSub.id,
          items: filterValidQuestions(focusedSub.questions).map((q) => ({
            question: q,
            progressKey: focusedSub.id,
            subchapterId: focusedSub.id,
            status: "unanswered" as const,
          })),
        },
      ];
    }
    // Case B: chapter has subchapters and no focus — show all questions grouped by subchapter.
    if (chapter.subchapters && chapter.subchapters.length > 0) {
      return chapter.subchapters.map((sub) => ({
        id: sub.id,
        name: sub.name,
        items: filterValidQuestions(sub.questions).map((q) => ({
          question: q,
          progressKey: sub.id,
          subchapterId: sub.id,
          status: "unanswered" as const,
        })),
      }));
    }
    // Case C: flat chapter — one group, no heading.
    const flat = chapter.questions ? filterValidQuestions(chapter.questions) : [];
    return [
      {
        id: "",
        items: flat.map((q) => ({
          question: q,
          progressKey: String(chapter.id),
          status: "unanswered" as const,
        })),
      },
    ];
  }, [chapter, focusedSub]);

  useEffect(() => {
    if (!chapter) return;
    const map: Record<string, "correct" | "wrong" | "unanswered"> = {};
    for (const g of groups) {
      for (const it of g.items) {
        map[`${it.progressKey}::${it.question.id}`] = getQuestionStatus(
          subject,
          it.progressKey,
          it.question.id
        );
      }
    }
    setStatusMap(map);
    setStatusLoaded(true);
  }, [subject, chapter, groups]);

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

  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);
  const startAllHref = focusedSub
    ? `/${subjectPath}/quiz?chapter=${chapterId}&sub=${focusedSub.id}`
    : `/${subjectPath}/quiz?chapter=${chapterId}`;
  const startAllLabel = focusedSub
    ? "Procvičit celou podkapitolu"
    : "Procvičit celou kapitolu od začátku";
  const backLabel = focusedSub ? "Zpět na podkapitoly" : "Zpět na kapitoly";

  function itemHref(it: Item): string {
    const p = new URLSearchParams();
    p.set("chapter", String(chapterId));
    if (it.subchapterId) p.set("sub", it.subchapterId);
    p.set("startId", String(it.question.id));
    return `/${subjectPath}/quiz?${p.toString()}`;
  }

  function statusDotClass(status: "correct" | "wrong" | "unanswered"): string {
    if (status === "correct") return "bg-[var(--color-correct)]";
    if (status === "wrong") return "bg-[var(--color-wrong)]";
    return "bg-gray-200 dark:bg-gray-700";
  }

  return (
    <main className="pt-6 pb-6">
      <Link
        href={backHref}
        className="inline-flex items-center text-sm text-gray-500 mb-4 tap-highlight"
      >
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {backLabel}
      </Link>

      <h1 className="text-xl font-bold text-[var(--color-primary)] dark:text-blue-400 mb-1">
        {focusedSub
          ? `${focusedSub.id} ${focusedSub.name}`
          : `${chapter.id}. ${chapter.name}`}
      </h1>
      <p className="text-sm text-gray-500 mb-5">
        {totalCount} otázek
      </p>

      <Link
        href={startAllHref}
        className="block w-full text-center bg-[var(--color-primary)] text-white font-semibold py-3.5 rounded-xl mb-5 tap-highlight active:opacity-80 transition-opacity"
      >
        {startAllLabel}
      </Link>

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.id || "flat"}>
            {g.name && (
              <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2 px-1">
                {g.id} {g.name}
              </h2>
            )}
            <ul className="space-y-1.5">
              {g.items.map((it) => {
                const status = statusLoaded
                  ? statusMap[`${it.progressKey}::${it.question.id}`] ?? "unanswered"
                  : "unanswered";
                return (
                  <li key={`${it.progressKey}::${it.question.id}`}>
                    <Link
                      href={itemHref(it)}
                      className="flex items-start gap-3 bg-white dark:bg-[#1e293b] rounded-xl px-3 py-2.5 border border-gray-100 dark:border-gray-700 tap-highlight active:bg-gray-50 dark:active:bg-gray-800 transition-colors"
                    >
                      <span
                        className={`inline-block flex-shrink-0 mt-1.5 w-2.5 h-2.5 rounded-full ${statusDotClass(status)}`}
                        aria-hidden="true"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="text-xs text-gray-400 dark:text-gray-500 mr-2">
                          {it.question.id}.
                        </span>
                        <span className="text-sm leading-snug text-gray-800 dark:text-gray-200">
                          {it.question.text}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
