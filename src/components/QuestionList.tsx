"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSubjectData, filterValidQuestions } from "@/lib/data";
import {
  getQuestionStatus,
  getSubjectProgress,
  removeFromWrong,
} from "@/lib/progress";
import { useRefreshOnReturn } from "@/lib/useRefreshOnReturn";
import type { Question } from "@/lib/types";

interface Props {
  subject: string;
  subjectPath: string; // e.g. "biology", "chemistry" — used in URLs
  backHref: string;
  /** Chapter view: required unless wrongOnly is true. */
  chapterId?: number;
  /** When set (chemistry two-level nav), show only this subchapter's questions. */
  subchapterId?: string;
  /**
   * "Moje chyby" mode — aggregates every wrongIds question across the subject,
   * groups by chapter/subchapter, and offers per-item "Už umím" removal.
   */
  wrongOnly?: boolean;
}

interface Item {
  question: Question;
  chapterId: number;
  /** progress key used by storage — chapter.id for flat, subchapter.id for subchapters */
  progressKey: string;
  /** subchapter id if this question is inside one, undefined otherwise */
  subchapterId?: string;
  status: "correct" | "wrong" | "unanswered";
}

interface Group {
  id: string; // subchapter id / chapter id / "" for a single flat group
  name?: string;
  items: Item[];
}

export default function QuestionList({
  subject,
  subjectPath,
  backHref,
  chapterId,
  subchapterId,
  wrongOnly,
}: Props) {
  const data = getSubjectData(subject);
  const chapter = !wrongOnly && chapterId !== undefined
    ? data?.chapters.find((ch) => ch.id === chapterId)
    : undefined;
  const focusedSub = subchapterId && chapter?.subchapters
    ? chapter.subchapters.find((s) => s.id === subchapterId)
    : undefined;

  // Rebuild status map on mount + return (localStorage is client-only).
  const [statusMap, setStatusMap] = useState<Record<string, "correct" | "wrong" | "unanswered">>({});
  const [statusLoaded, setStatusLoaded] = useState(false);
  // Wrong-mode: track items the user has manually dismissed via "Už umím" so
  // they vanish without needing a full storage re-read.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  // A version counter that bumps whenever we come back to this page. It's
  // read by the groups useMemo so wrong-mode re-derives from fresh storage
  // (e.g. user answered new wrongs in a quiz then hit back).
  const [dataVersion, setDataVersion] = useState(0);

  useRefreshOnReturn(() => {
    setDataVersion((v) => v + 1);
    setDismissed(new Set());
  });

  const groups = useMemo<Group[]>(() => {
    if (wrongOnly) {
      if (!data) return [];
      const progress = getSubjectProgress(subject);
      const out: Group[] = [];
      for (const ch of data.chapters) {
        if (ch.subchapters && ch.subchapters.length > 0) {
          for (const sub of ch.subchapters) {
            const cp = progress[sub.id];
            const wrongSet = new Set((cp?.wrongIds ?? []).map(String));
            if (wrongSet.size === 0) continue;
            const items = filterValidQuestions(sub.questions)
              .filter((q) => wrongSet.has(String(q.id)))
              .map((q) => ({
                question: q,
                chapterId: ch.id,
                progressKey: sub.id,
                subchapterId: sub.id,
                status: "wrong" as const,
              }));
            if (items.length > 0) {
              out.push({ id: sub.id, name: `${ch.id}. ${ch.name} › ${sub.id} ${sub.name}`, items });
            }
          }
        } else if (ch.questions) {
          const cp = progress[String(ch.id)];
          const wrongSet = new Set((cp?.wrongIds ?? []).map(String));
          if (wrongSet.size === 0) continue;
          const items = filterValidQuestions(ch.questions)
            .filter((q) => wrongSet.has(String(q.id)))
            .map((q) => ({
              question: q,
              chapterId: ch.id,
              progressKey: String(ch.id),
              status: "wrong" as const,
            }));
          if (items.length > 0) {
            out.push({ id: String(ch.id), name: `${ch.id}. ${ch.name}`, items });
          }
        }
      }
      return out;
    }
    // Chapter view — original behaviour
    if (!chapter) return [];
    if (focusedSub) {
      return [
        {
          id: focusedSub.id,
          items: filterValidQuestions(focusedSub.questions).map((q) => ({
            question: q,
            chapterId: chapter.id,
            progressKey: focusedSub.id,
            subchapterId: focusedSub.id,
            status: "unanswered" as const,
          })),
        },
      ];
    }
    if (chapter.subchapters && chapter.subchapters.length > 0) {
      return chapter.subchapters.map((sub) => ({
        id: sub.id,
        name: sub.name,
        items: filterValidQuestions(sub.questions).map((q) => ({
          question: q,
          chapterId: chapter.id,
          progressKey: sub.id,
          subchapterId: sub.id,
          status: "unanswered" as const,
        })),
      }));
    }
    const flat = chapter.questions ? filterValidQuestions(chapter.questions) : [];
    return [
      {
        id: "",
        items: flat.map((q) => ({
          question: q,
          chapterId: chapter.id,
          progressKey: String(chapter.id),
          status: "unanswered" as const,
        })),
      },
    ];
  }, [chapter, focusedSub, wrongOnly, data, subject, dataVersion]);

  // Rebuild statusMap whenever the groups change (fresh mount, subject/chapter
  // switch, or a bumped dataVersion after returning to this page).
  useEffect(() => {
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
  }, [subject, groups]);

  // ── Rendering ────────────────────────────────────────────────────────────

  if (wrongOnly) {
    const visibleGroups = groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) => !dismissed.has(`${it.progressKey}::${it.question.id}`)
        ),
      }))
      .filter((g) => g.items.length > 0);
    const totalCount = visibleGroups.reduce((sum, g) => sum + g.items.length, 0);

    const dismissItem = (it: Item) => {
      removeFromWrong(subject, it.progressKey, it.question.id);
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(`${it.progressKey}::${it.question.id}`);
        return next;
      });
    };

    return (
      <main className="pt-6 pb-6">
        <Link
          href={backHref}
          className="inline-flex items-center text-sm text-gray-500 mb-4 tap-highlight"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Zpět
        </Link>

        <h1 className="text-xl font-bold text-[var(--color-primary)] dark:text-blue-400 mb-1">
          Moje chyby
        </h1>
        <p className="text-sm text-gray-500 mb-5">
          {totalCount} {totalCount === 1 ? "otázka" : totalCount < 5 ? "otázky" : "otázek"}
        </p>

        {totalCount === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#1e293b] border border-gray-100 dark:border-gray-700 p-8 text-center">
            <div className="text-4xl mb-3" aria-hidden="true">🎉</div>
            <p className="text-base font-medium text-gray-700 dark:text-gray-200 mb-1">
              Zatím žádné chyby
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Když v procvičování označíš otázku špatně, objeví se tady.
            </p>
          </div>
        ) : (
          <>
            <Link
              href={`/${subjectPath}/quiz?chapter=all&mode=wrong`}
              className="block w-full text-center bg-[var(--color-primary)] text-white font-semibold py-3.5 rounded-xl mb-5 tap-highlight active:opacity-80 transition-opacity"
            >
              Procvičit všechny chybné
            </Link>

            <div className="space-y-6">
              {visibleGroups.map((g) => (
                <section key={g.id}>
                  {g.name && (
                    <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2 px-1">
                      {g.name}
                    </h2>
                  )}
                  <ul className="space-y-1.5">
                    {g.items.map((it) => (
                      <li
                        key={`${it.progressKey}::${it.question.id}`}
                        className="flex items-stretch bg-white dark:bg-[#1e293b] rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
                      >
                        <Link
                          href={wrongItemHref(subjectPath, it)}
                          className="flex-1 flex items-start gap-3 px-3 py-2.5 tap-highlight active:bg-gray-50 dark:active:bg-gray-800 transition-colors min-w-0"
                        >
                          <span
                            className="inline-block flex-shrink-0 mt-1.5 w-2.5 h-2.5 rounded-full bg-[var(--color-wrong)]"
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
                        <button
                          type="button"
                          onClick={() => dismissItem(it)}
                          aria-label="Už umím"
                          className="flex-shrink-0 px-3 flex items-center gap-1.5 text-xs font-medium text-[var(--color-correct)] hover:bg-green-50 dark:hover:bg-green-950/30 border-l border-gray-100 dark:border-gray-700 tap-highlight transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="hidden sm:inline">Už umím</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </main>
    );
  }

  // ── Chapter view (unchanged behaviour) ────────────────────────────────────

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
    p.set("chapter", String(it.chapterId));
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

/** Build the href to launch the QuizRunner for a specific wrong question.
 *  Includes mode=wrong so QuizRunner enters wrong-mode and prev/next stay
 *  within the wrong pool. */
function wrongItemHref(
  subjectPath: string,
  it: Item
): string {
  const p = new URLSearchParams();
  p.set("chapter", String(it.chapterId));
  if (it.subchapterId) p.set("sub", it.subchapterId);
  p.set("startId", String(it.question.id));
  p.set("mode", "wrong");
  return `/${subjectPath}/quiz?${p.toString()}`;
}
