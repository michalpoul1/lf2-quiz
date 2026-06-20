"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { getSubjectData, getChapterQuestions, countValidQuestions } from "@/lib/data";
import { getChapterProgress, getTotalProgress, getSubjectProgress } from "@/lib/progress";
import { normalizeText, getHighlightedSegments } from "@/lib/searchUtils";
import type { ChapterProgress, Question } from "@/lib/types";

function HighlightedText({ text, term }: { text: string; term: string }) {
  const segments = getHighlightedSegments(text, term);
  return (
    <>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/50 text-inherit font-semibold rounded-sm px-0.5 not-italic">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

interface Props {
  facultyId: string;
  subject: string;
  subjectName: string;
}

export default function ChapterList({ facultyId, subject, subjectName }: Props) {
  const data = getSubjectData(facultyId, subject);
  const [chapterProgress, setChapterProgress] = useState<Record<string, ChapterProgress>>({});
  const [total, setTotal] = useState({ answered: 0, correct: 0 });
  const [totalWrong, setTotalWrong] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (!data) return;
    const cp: Record<string, ChapterProgress> = {};
    for (const ch of data.chapters) {
      cp[ch.id] = getChapterProgress(facultyId, subject, ch.id);
    }
    setChapterProgress(cp);
    setTotal(getTotalProgress(facultyId, subject));

    // Count total wrong answers
    const progress = getSubjectProgress(facultyId, subject);
    let wrongCount = 0;
    for (const cp of Object.values(progress)) {
      wrongCount += cp.wrongIds.length;
    }
    setTotalWrong(wrongCount);
  }, [data, facultyId, subject]);

  // Debounce search
  useEffect(() => {
    if (search.length < 3) {
      setDebouncedSearch("");
      return;
    }
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Search results — diacritic-insensitive
  const searchResults = useMemo(() => {
    if (!debouncedSearch || debouncedSearch.length < 3 || !data) return null;
    const term = normalizeText(debouncedSearch);
    const results: {
      question: Question;
      chapterName: string;
      chapterId: number;
      subchapterId?: string;
      matchedOptionText?: string;
    }[] = [];

    for (const ch of data.chapters) {
      if (ch.questions) {
        for (const q of ch.questions) {
          if (!q.correct.length) continue;
          const textMatch = normalizeText(q.text).includes(term);
          if (textMatch) {
            results.push({ question: q, chapterName: ch.name, chapterId: ch.id });
          } else {
            const matchedOpt = q.options.find((o) => normalizeText(o.text).includes(term));
            if (matchedOpt) {
              results.push({ question: q, chapterName: ch.name, chapterId: ch.id, matchedOptionText: matchedOpt.text });
            }
          }
        }
      }
      if (ch.subchapters) {
        for (const sub of ch.subchapters) {
          for (const q of sub.questions) {
            if (!q.correct.length) continue;
            const textMatch = normalizeText(q.text).includes(term);
            if (textMatch) {
              results.push({ question: q, chapterName: `${ch.name} › ${sub.name}`, chapterId: ch.id, subchapterId: sub.id });
            } else {
              const matchedOpt = q.options.find((o) => normalizeText(o.text).includes(term));
              if (matchedOpt) {
                results.push({ question: q, chapterName: `${ch.name} › ${sub.name}`, chapterId: ch.id, subchapterId: sub.id, matchedOptionText: matchedOpt.text });
              }
            }
          }
        }
      }
    }
    return results.slice(0, 50);
  }, [debouncedSearch, data]);

  if (!data) {
    return (
      <main className="pt-10 text-center">
        <p className="text-gray-500 mb-4">Data nejsou k dispozici.</p>
        <Link href={`/faculty/${facultyId}`} className="text-[var(--color-primary)] dark:text-blue-400 font-medium">
          Zpět
        </Link>
      </main>
    );
  }

  const validTotal = data.chapters.reduce(
    (sum, ch) => sum + countValidQuestions(getChapterQuestions(facultyId, subject, ch.id)),
    0
  );

  const hasSubchapters = data.chapters.some((ch) => ch.subchapters && ch.subchapters.length > 0);

  return (
    <main className="pt-6">
      <Link
        href={`/faculty/${facultyId}`}
        className="inline-flex items-center text-sm text-gray-500 mb-4 tap-highlight"
      >
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Zpět
      </Link>

      <h1 className="text-2xl font-bold text-[var(--color-primary)] dark:text-blue-400 mb-1">
        {subjectName}
      </h1>
      <p className="text-sm text-gray-500 mb-4">
        {validTotal} otázek
        {total.answered > 0 && (
          <> &middot; {total.correct}/{total.answered} správně</>
        )}
      </p>

      {/* Search bar */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hledat v otázkách..."
          className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 text-base placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:focus:ring-blue-400 transition-shadow"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 tap-highlight"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search results */}
      {searchResults !== null ? (
        <div className="mb-6">
          <p className="text-sm text-gray-400 mb-3">
            {searchResults.length > 0
              ? `${searchResults.length}${searchResults.length === 50 ? "+" : ""} výsledků`
              : "Žádné výsledky"}
          </p>
          <div className="space-y-2">
            {searchResults.map((r) => {
              const params = new URLSearchParams();
              params.set("chapter", String(r.chapterId));
              if (r.subchapterId) params.set("sub", r.subchapterId);
              params.set("startId", String(r.question.id));
              const quizHref = `/faculty/${facultyId}/${subject}/quiz?${params.toString()}`;
              return (
                <Link
                  key={quizHref}
                  href={quizHref}
                  className="block bg-white dark:bg-[#1e293b] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 tap-highlight active:bg-gray-50 dark:active:bg-gray-800 transition-colors"
                >
                  <p className="text-xs text-gray-400 mb-1">
                    {r.chapterName} &middot; Ot. {r.question.id}
                  </p>
                  <p className="text-sm leading-snug line-clamp-2 text-gray-800 dark:text-gray-200">
                    <HighlightedText text={r.question.text} term={debouncedSearch} />
                  </p>
                  {r.matchedOptionText && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                      Odpověď: <HighlightedText text={r.matchedOptionText} term={debouncedSearch} />
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Action buttons */}
          <div className="flex gap-2.5 mb-5">
            <Link
              href={`/faculty/${facultyId}/${subject}/quiz?chapter=all`}
              className="flex-1 text-center bg-[var(--color-primary)] text-white font-semibold py-3.5 rounded-xl tap-highlight active:opacity-80 transition-opacity"
            >
              Procvičovat vše
            </Link>
            {totalWrong > 0 && (
              <Link
                href={`/faculty/${facultyId}/${subject}/quiz?chapter=all&mode=wrong`}
                className="flex-1 text-center bg-[var(--color-wrong)] text-white font-semibold py-3.5 rounded-xl tap-highlight active:opacity-80 transition-opacity"
              >
                Chyby ({totalWrong})
              </Link>
            )}
          </div>

          {totalWrong === 0 && total.answered > 0 && (
            <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-3.5 mb-5 text-center">
              <p className="text-sm font-medium text-[var(--color-correct)]">
                Žádné chyby &mdash; skvělá práce!
              </p>
            </div>
          )}

          {/* Chapter list */}
          <div className="space-y-2.5">
            {data.chapters.map((ch) => {
              const cp = chapterProgress[ch.id] || { answered: 0, correct: 0, wrongIds: [] };
              const validCount = countValidQuestions(getChapterQuestions(facultyId, subject, ch.id));
              const href = hasSubchapters
                ? `/faculty/${facultyId}/${subject}/chapter/${ch.id}`
                : `/faculty/${facultyId}/${subject}/quiz?chapter=${ch.id}`;

              return (
                <Link
                  key={ch.id}
                  href={href}
                  className="block bg-white dark:bg-[#1e293b] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 tap-highlight active:bg-gray-50 dark:active:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base font-semibold text-[var(--color-primary)] dark:text-blue-400 leading-snug">
                        {ch.id}. {ch.name}
                      </h2>
                      {ch.subtitle && (
                        <p className="text-xs text-gray-400 mt-0.5 leading-tight">
                          {ch.subtitle}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 pt-0.5">
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {validCount} ot.
                      </span>
                      {hasSubchapters && (
                        <svg className="w-4 h-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      )}
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
        </>
      )}
    </main>
  );
}
