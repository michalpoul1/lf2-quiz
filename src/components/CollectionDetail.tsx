"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CollectionQuestion,
  getAllSavedQuestions,
  getCollection,
  getCollectionsContaining,
  removeQuestionFromCollection,
} from "@/lib/collections";
import { getSubjectData } from "@/lib/data";
import type { Question } from "@/lib/types";

const SUBJECT_NAMES: Record<string, string> = {
  biology: "Biologie",
  chemistry: "Chemie",
  physics: "Fyzika",
};

const SUBJECT_SHORT: Record<string, string> = {
  biology: "Bio",
  chemistry: "Chem",
  physics: "Fyz",
};

interface ResolvedQuestion {
  subject: string;
  questionId: number | string;
  question: Question;
  chapterPath: string;
}

function findQuestion(
  subject: string,
  qId: number | string
): { question: Question; chapterPath: string } | null {
  const data = getSubjectData(subject);
  if (!data) return null;
  for (const ch of data.chapters) {
    if (ch.questions) {
      const q = ch.questions.find((q) => String(q.id) === String(qId));
      if (q) {
        return {
          question: q,
          chapterPath: `${SUBJECT_NAMES[subject] || subject} > ${ch.name}`,
        };
      }
    }
    if (ch.subchapters) {
      for (const sub of ch.subchapters) {
        const q = sub.questions.find((q) => String(q.id) === String(qId));
        if (q) {
          return {
            question: q,
            chapterPath: `${SUBJECT_NAMES[subject] || subject} > ${ch.name} > ${sub.name}`,
          };
        }
      }
    }
  }
  return null;
}

interface Props {
  /** Collection id to view, or "all" for the virtual all-saved collection. */
  collectionId: string | "all";
}

export default function CollectionDetail({ collectionId }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [items, setItems] = useState<ResolvedQuestion[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const isVirtualAll = collectionId === "all";

  const reload = () => {
    let qs: CollectionQuestion[] = [];
    if (isVirtualAll) {
      qs = getAllSavedQuestions();
      setName("Všechny uložené");
      setColor("#3b82f6");
    } else {
      const c = getCollection(collectionId);
      if (!c) {
        setNotFound(true);
        setLoaded(true);
        return;
      }
      qs = c.questions;
      setName(c.name);
      setColor(c.color);
    }
    const resolved: ResolvedQuestion[] = [];
    for (const q of qs) {
      const found = findQuestion(q.subject, q.questionId);
      if (found) {
        resolved.push({
          subject: q.subject,
          questionId: q.questionId,
          question: found.question,
          chapterPath: found.chapterPath,
        });
      }
    }
    setItems(resolved);
    setLoaded(true);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((it) => it.subject === filter);
  }, [items, filter]);

  const subjectsPresent = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) set.add(it.subject);
    return set;
  }, [items]);

  const handleRemove = (it: ResolvedQuestion) => {
    if (isVirtualAll) {
      // Remove from every collection containing it
      const ids = getCollectionsContaining(it.subject, it.questionId);
      for (const id of ids) {
        removeQuestionFromCollection(id, it.subject, it.questionId);
      }
    } else {
      removeQuestionFromCollection(collectionId, it.subject, it.questionId);
    }
    setItems((prev) =>
      prev.filter(
        (x) =>
          !(x.subject === it.subject && String(x.questionId) === String(it.questionId))
      )
    );
  };

  const quizHref = isVirtualAll
    ? "/bookmarks/quiz?collection=all"
    : `/bookmarks/quiz?collection=${collectionId}`;

  if (!loaded) {
    return (
      <main className="pt-6">
        <p className="text-sm text-gray-500">Načítání...</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="pt-10 text-center">
        <p className="text-gray-500 mb-4">Kolekce nebyla nalezena.</p>
        <Link
          href="/bookmarks"
          className="text-[var(--color-primary)] dark:text-blue-400 font-medium"
        >
          Zpět na záložky
        </Link>
      </main>
    );
  }

  const filterButtons: { key: string; label: string }[] = [
    { key: "all", label: "Vše" },
    { key: "biology", label: "Bio" },
    { key: "chemistry", label: "Chem" },
    { key: "physics", label: "Fyz" },
  ];

  return (
    <main className="pt-4 pb-4 fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Link
          href="/bookmarks"
          className="text-gray-400 tap-highlight p-1 -ml-1"
          aria-label="Zpět"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <div
          className="w-1 h-7 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <h1 className="text-xl font-bold text-[var(--color-primary)] dark:text-blue-400 truncate flex-1">
          {name}
        </h1>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {items.length} {items.length === 1 ? "otázka" : items.length < 5 ? "otázky" : "otázek"}
      </p>

      {items.length > 0 && (
        <Link
          href={quizHref}
          className="block w-full text-center bg-[var(--color-primary)] text-white font-semibold py-3.5 rounded-xl mb-4 tap-highlight active:opacity-80 transition-opacity"
        >
          Procvičovat vše ({items.length})
        </Link>
      )}

      {items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 dark:text-gray-500">
            V této kolekci zatím nejsou žádné otázky
          </p>
        </div>
      ) : (
        <>
          {/* Filter */}
          <div className="flex gap-1.5 mb-4 overflow-x-auto">
            {filterButtons.map((btn) => {
              const enabled = btn.key === "all" || subjectsPresent.has(btn.key);
              const active = filter === btn.key;
              return (
                <button
                  key={btn.key}
                  type="button"
                  onClick={() => enabled && setFilter(btn.key)}
                  disabled={!enabled}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tap-highlight whitespace-nowrap transition-colors ${
                    active
                      ? "bg-[var(--color-primary)] text-white"
                      : enabled
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                        : "bg-gray-50 dark:bg-gray-900 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>

          {/* Question list */}
          <div className="space-y-2.5">
            {filtered.map((it) => {
              const key = `${it.subject}-${it.questionId}`;
              const expanded = expandedKey === key;
              const correctSet = new Set(it.question.correct);
              return (
                <div
                  key={key}
                  className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
                >
                  <div className="flex items-start gap-2 p-4">
                    <button
                      type="button"
                      onClick={() => setExpandedKey(expanded ? null : key)}
                      className="flex-1 text-left tap-highlight min-w-0"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-[var(--color-primary)] dark:text-blue-400">
                          {SUBJECT_SHORT[it.subject] || it.subject}
                        </span>
                        <span className="text-[11px] text-gray-500 truncate">
                          {it.chapterPath}
                        </span>
                      </div>
                      <p
                        className={`text-sm leading-snug ${
                          expanded ? "" : "line-clamp-2"
                        }`}
                      >
                        {it.question.text}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(it)}
                      className="flex-shrink-0 p-1.5 text-gray-300 dark:text-gray-600 hover:text-[var(--color-wrong)] transition-colors tap-highlight"
                      aria-label="Odebrat z kolekce"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>

                  {expanded && (
                    <div className="px-4 pb-4 -mt-1 fade-in">
                      <div className="space-y-1.5 mt-3">
                        {it.question.options.map((opt) => {
                          const isCorrect = correctSet.has(opt.letter);
                          return (
                            <div
                              key={opt.letter}
                              className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${
                                isCorrect
                                  ? "border-[var(--color-correct)] bg-green-50 dark:bg-green-950/30"
                                  : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0f172a]"
                              }`}
                            >
                              <div
                                className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center text-xs font-semibold ${
                                  isCorrect
                                    ? "border-[var(--color-correct)] bg-[var(--color-correct)] text-white"
                                    : "border-gray-300 dark:border-gray-600 text-gray-500"
                                }`}
                              >
                                {isCorrect ? (
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={3}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                ) : (
                                  opt.letter
                                )}
                              </div>
                              <span className="text-sm leading-snug pt-0.5">
                                {opt.text}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
