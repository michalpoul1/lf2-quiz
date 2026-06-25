"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSubjectData } from "@/lib/data";
import { getActiveFaculties } from "@/config/faculties";
import { normalizeText, getHighlightedSegments } from "@/lib/searchUtils";
import type { Question } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchEntry {
  facultyId: string;
  subject: SubjectKey;
  question: Question;
  chapterId: number;
  chapterName: string;
  subchapterId?: string;
}

type SubjectKey = "biology" | "chemistry" | "physics";

// ─── Config ───────────────────────────────────────────────────────────────────

const SUBJECT_CONFIG: Record<
  SubjectKey,
  {
    label: string;
    emoji: string;
    tagClass: string;
    chipActive: string;
    chipInactive: string;
  }
> = {
  biology: {
    label: "Bio",
    emoji: "🧬",
    tagClass:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    chipActive: "bg-blue-500 text-white shadow-sm",
    chipInactive:
      "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  },
  chemistry: {
    label: "Chem",
    emoji: "⚗️",
    tagClass:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    chipActive: "bg-green-500 text-white shadow-sm",
    chipInactive:
      "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  },
  physics: {
    label: "Fyz",
    emoji: "⚡",
    tagClass:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    chipActive: "bg-orange-500 text-white shadow-sm",
    chipInactive:
      "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  },
};

const SUBJECTS: SubjectKey[] = ["biology", "chemistry", "physics"];
const MAX_RESULTS = 20;

// ─── Search index (built once, static data) ───────────────────────────────────

let SEARCH_INDEX: SearchEntry[] | null = null;

function buildSearchIndex(): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const faculty of getActiveFaculties()) {
    for (const subj of faculty.subjects) {
      const subject = subj.id as SubjectKey;
      if (!SUBJECTS.includes(subject)) continue;
      const data = getSubjectData(faculty.id, subject);
      if (!data) continue;
      for (const ch of data.chapters) {
        if (ch.questions) {
          for (const q of ch.questions) {
            if (q.correct.length > 0) {
              entries.push({
                facultyId: faculty.id,
                subject,
                question: q,
                chapterId: ch.id,
                chapterName: ch.name,
              });
            }
          }
        }
        if (ch.subchapters) {
          for (const sub of ch.subchapters) {
            for (const q of sub.questions) {
              if (q.correct.length > 0) {
                entries.push({
                  facultyId: faculty.id,
                  subject,
                  question: q,
                  chapterId: ch.id,
                  chapterName: `${ch.name} › ${sub.name}`,
                  subchapterId: sub.id,
                });
              }
            }
          }
        }
      }
    }
  }
  return entries;
}

function getSearchIndex(): SearchEntry[] {
  if (!SEARCH_INDEX) SEARCH_INDEX = buildSearchIndex();
  return SEARCH_INDEX;
}

// ─── Highlighted text ─────────────────────────────────────────────────────────

function HighlightedText({ text, term }: { text: string; term: string }) {
  const segments = getHighlightedSegments(text, term);
  return (
    <>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark
            key={i}
            className="bg-yellow-200 dark:bg-yellow-700/50 text-inherit font-semibold rounded-sm px-0.5 not-italic"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GlobalSearch() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeSubjects, setActiveSubjects] = useState<Set<SubjectKey>>(
    new Set(SUBJECTS)
  );
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce
  useEffect(() => {
    if (search.length < 3) {
      setDebouncedSearch("");
      return;
    }
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Open/close based on results availability
  useEffect(() => {
    if (debouncedSearch.length >= 3) setOpen(true);
    else setOpen(false);
  }, [debouncedSearch]);

  // Close on click outside
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // Toggle subject filter (keep at least one active)
  const toggleSubject = useCallback((s: SubjectKey) => {
    setActiveSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(s)) {
        if (next.size === 1) return prev;
        next.delete(s);
      } else {
        next.add(s);
      }
      return next;
    });
  }, []);

  // Search
  const allResults = useMemo(() => {
    if (debouncedSearch.length < 3) return null;
    const term = normalizeText(debouncedSearch);
    const index = getSearchIndex();
    const matches: (SearchEntry & { matchedOptionText?: string })[] = [];

    for (const entry of index) {
      if (!activeSubjects.has(entry.subject)) continue;
      const q = entry.question;

      const textMatches = normalizeText(q.text).includes(term);
      if (textMatches) {
        matches.push(entry);
      } else {
        const matchedOpt = q.options.find((o) =>
          normalizeText(o.text).includes(term)
        );
        if (matchedOpt) {
          matches.push({ ...entry, matchedOptionText: matchedOpt.text });
        }
      }

      // Collect enough to show accurate "extra" count
      if (matches.length >= MAX_RESULTS + 100) break;
    }
    return matches;
  }, [debouncedSearch, activeSubjects]);

  const displayed = allResults?.slice(0, MAX_RESULTS) ?? [];
  const extra = allResults ? Math.max(0, allResults.length - MAX_RESULTS) : 0;
  const showPanel = open && allResults !== null;

  function getQuizHref(entry: SearchEntry): string {
    const params = new URLSearchParams();
    params.set("chapter", String(entry.chapterId));
    if (entry.subchapterId) params.set("sub", entry.subchapterId);
    params.set("startId", String(entry.question.id));
    return `/${entry.subject}/quiz?${params.toString()}`;
  }

  function handleResultClick(entry: SearchEntry) {
    setOpen(false);
    setSearch("");
    router.push(getQuizHref(entry));
  }

  function handleClear() {
    setSearch("");
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="relative mb-5">
      {/* Search input */}
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => {
            if (debouncedSearch.length >= 3) setOpen(true);
          }}
          placeholder="Hledat v otázkách..."
          autoComplete="off"
          className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-2xl pl-11 pr-10 py-3.5 text-base placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:focus:ring-blue-400 shadow-sm transition-shadow"
        />
        {search && (
          <button
            onClick={handleClear}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 tap-highlight transition-colors"
            aria-label="Vymazat hledání"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mt-2.5">
        {SUBJECTS.map((s) => {
          const cfg = SUBJECT_CONFIG[s];
          const active = activeSubjects.has(s);
          return (
            <button
              key={s}
              onClick={() => toggleSubject(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all tap-highlight select-none ${
                active ? cfg.chipActive : cfg.chipInactive
              }`}
            >
              <span aria-hidden="true">{cfg.emoji}</span>
              <span>{cfg.label}</span>
            </button>
          );
        })}
        {search.length > 0 && search.length < 3 && (
          <span className="self-center text-xs text-gray-400 ml-1">
            Zadejte aspoň 3 znaky
          </span>
        )}
      </div>

      {/* Results dropdown */}
      <div
        className={`absolute left-0 right-0 z-50 mt-2 bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-200 origin-top ${
          showPanel
            ? "opacity-100 scale-y-100 pointer-events-auto"
            : "opacity-0 scale-y-95 pointer-events-none"
        }`}
        style={{ maxHeight: "68vh", overflowY: "auto", top: "100%" }}
      >
        {allResults !== null && displayed.length === 0 && (
          <div className="py-10 text-center text-gray-400 text-sm">
            <svg
              className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            Žádné výsledky pro „{debouncedSearch}"
          </div>
        )}

        {displayed.length > 0 && (
          <>
            <div className="px-4 pt-3 pb-1.5 text-xs text-gray-400 font-medium border-b border-gray-100 dark:border-gray-800">
              {allResults!.length <= MAX_RESULTS
                ? `${allResults!.length} výsledků`
                : `${MAX_RESULTS} z ${allResults!.length}+ výsledků`}
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {displayed.map((entry) => {
                const cfg = SUBJECT_CONFIG[entry.subject];
                return (
                  <button
                    key={`${entry.facultyId}-${entry.subject}-${entry.question.id}`}
                    onClick={() => handleResultClick(entry)}
                    className="w-full text-left px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 active:bg-gray-100 dark:active:bg-gray-700/50 transition-colors tap-highlight"
                  >
                    {/* Subject tag + chapter */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.tagClass}`}
                      >
                        <span aria-hidden="true">{cfg.emoji}</span>
                        {cfg.label}
                      </span>
                      <span className="text-xs text-gray-400 truncate leading-tight">
                        {entry.chapterName}
                      </span>
                    </div>

                    {/* Question text */}
                    <p className="text-sm leading-snug text-gray-800 dark:text-gray-200 line-clamp-2">
                      <HighlightedText
                        text={entry.question.text}
                        term={debouncedSearch}
                      />
                    </p>

                    {/* Option match snippet */}
                    {entry.matchedOptionText && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                        Odpověď:{" "}
                        <HighlightedText
                          text={entry.matchedOptionText}
                          term={debouncedSearch}
                        />
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
            {extra > 0 && (
              <div className="px-4 py-3 text-center text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800">
                … a dalších {extra}+ výsledků — zpřesněte hledání
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
