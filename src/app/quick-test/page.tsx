"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";

import {
  getSubjectData,
  getChapterQuestions,
  filterValidQuestions,
  shuffleArray,
} from "@/lib/data";
import { getFaculty } from "@/config/faculties";
import { isQuestionSaved } from "@/lib/collections";
import SaveToCollectionModal from "@/components/SaveToCollectionModal";
import CustomSlider from "@/components/CustomSlider";
import { recordAnswer } from "@/lib/progress";
import { saveTestResult } from "@/lib/testHistory";
import type { Question } from "@/lib/types";

interface TaggedQuestion extends Question {
  _subject: string;
}

type Phase = "setup" | "active" | "results";

function findProgressKey(facultyId: string, subject: string, qId: number | string): string {
  const data = getSubjectData(facultyId, subject);
  if (!data) return "unknown";
  for (const ch of data.chapters) {
    if (ch.subchapters) {
      for (const sub of ch.subchapters) {
        if (sub.questions.some((q) => String(q.id) === String(qId)))
          return sub.id;
      }
    }
    if (ch.questions?.some((q) => String(q.id) === String(qId)))
      return String(ch.id);
  }
  return "unknown";
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export default function QuickTestPage() {

  const facultyId = "2lf";
  const faculty = getFaculty(facultyId);
  const SUBJECTS = useMemo(
    () =>
      (faculty?.subjects ?? []).map((s) => ({
        key: s.id,
        name: s.name,
        icon: s.icon,
      })),
    [faculty]
  );
  const backHref = "/";

  // Setup state
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(
    new Set(SUBJECTS.map((s) => s.key))
  );
  const [count, setCount] = useState(20);

  // Quiz state
  const [phase, setPhase] = useState<Phase>("setup");
  const [questions, setQuestions] = useState<TaggedQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<
    { question: TaggedQuestion; correct: boolean; userAnswer: string[] }[]
  >([]);
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [bookmarkModalOpen, setBookmarkModalOpen] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [expandedReview, setExpandedReview] = useState<number | null>(null);

  // Timer
  const startTimeRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (phase !== "active") return;
    const tick = () => {
      setElapsed(Date.now() - startTimeRef.current);
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Save test result to history when finished
  const savedRef = useRef(false);
  useEffect(() => {
    if (phase !== "results" || savedRef.current) return;
    savedRef.current = true;
    const correctCount = results.filter((r) => r.correct).length;
    const subjects = [...new Set(results.map((r) => r.question._subject))];
    saveTestResult("quick", facultyId, subjects, results.length, correctCount, Math.floor(elapsed / 1000));
  }, [phase, results, elapsed]);

  const toggleSubject = (key: string) => {
    setSelectedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const startTest = () => {
    const pool: TaggedQuestion[] = [];
    for (const subj of selectedSubjects) {
      const qs = filterValidQuestions(getChapterQuestions(facultyId, subj, "all"));
      pool.push(...qs.map((q) => ({ ...q, _subject: subj })));
    }
    const shuffled = shuffleArray(pool).slice(0, count);
    setQuestions(shuffled);
    setCurrentIndex(0);
    setSelected(new Set());
    setChecked(false);
    setResults([]);
    setConfirmQuit(false);
    // Init bookmarks
    const bm = new Set<string>();
    for (const q of shuffled) {
      if (isQuestionSaved(facultyId, q._subject, q.id)) bm.add(`${q._subject}-${q.id}`);
    }
    setBookmarked(bm);
    startTimeRef.current = Date.now();
    setElapsed(0);
    setPhase("active");
  };

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;

  const handleOpenBookmark = () => {
    if (!currentQuestion) return;
    setBookmarkModalOpen(true);
  };

  const handleBookmarkSaved = (isSaved: boolean) => {
    if (!currentQuestion) return;
    const key = `${currentQuestion._subject}-${currentQuestion.id}`;
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (isSaved) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const handleCheck = () => {
    if (!currentQuestion || selected.size === 0) return;
    setChecked(true);
    const correctSet = new Set(currentQuestion.correct);
    const selectedArr = Array.from(selected);
    const isCorrect =
      selectedArr.length === correctSet.size &&
      selectedArr.every((s) => correctSet.has(s));
    const key = findProgressKey(facultyId, currentQuestion._subject, currentQuestion.id);
    recordAnswer(facultyId, currentQuestion._subject, key, currentQuestion.id, isCorrect);
    setResults((prev) => [
      ...prev,
      {
        question: currentQuestion,
        correct: isCorrect,
        userAnswer: selectedArr,
      },
    ]);
  };

  const handleNext = () => {
    if (currentIndex + 1 >= totalQuestions) {
      setElapsed(Date.now() - startTimeRef.current);
      setPhase("results");
    } else {
      setCurrentIndex((i) => i + 1);
      setSelected(new Set());
      setChecked(false);
    }
  };

  const handleQuit = () => {
    if (!confirmQuit) {
      setConfirmQuit(true);
      return;
    }
    // Submit what we have so far
    setElapsed(Date.now() - startTimeRef.current);
    setPhase("results");
  };

  const toggleOption = (letter: string) => {
    if (checked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
  };

  // Available question counts per subject
  const subjectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of SUBJECTS) {
      counts[s.key] = filterValidQuestions(getChapterQuestions(facultyId, s.key, "all")).length;
    }
    return counts;
  }, [facultyId, SUBJECTS]);

  const totalAvailable = useMemo(() => {
    let total = 0;
    for (const key of selectedSubjects) {
      total += subjectCounts[key] || 0;
    }
    return total;
  }, [selectedSubjects, subjectCounts]);

  const isMix = selectedSubjects.size === SUBJECTS.length;

  const toggleMix = () => {
    if (isMix) return;
    setSelectedSubjects(new Set(SUBJECTS.map((s) => s.key)));
  };

  // --- SETUP ---
  if (phase === "setup") {
    const sliderMax = Math.min(totalAvailable, 100);

    return (
      <main className="pt-6 pb-4 fade-in">
        <Link
          href={backHref}
          className="inline-flex items-center text-sm text-gray-500 mb-6 tap-highlight"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Zpět
        </Link>

        <h1 className="text-2xl font-bold text-[var(--color-primary)] dark:text-blue-400 mb-1">
          Rychlý test
        </h1>
        <p className="text-sm text-gray-500 mb-6">Náhodné otázky z vybraných předmětů</p>

        {/* Subject selection */}
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
          Předměty
        </p>
        <div className="grid grid-cols-2 gap-2.5 mb-6">
          {SUBJECTS.map((s) => {
            const active = selectedSubjects.has(s.key);
            const qCount = subjectCounts[s.key] || 0;
            return (
              <button
                key={s.key}
                onClick={() => toggleSubject(s.key)}
                className={`flex flex-col items-center gap-1 p-4 rounded-2xl border-2 transition-all tap-highlight active:scale-[0.97] ${
                  active
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-md"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e293b]"
                }`}
              >
                <span className="text-2xl">{s.icon}</span>
                <span className="font-semibold text-sm">{s.name}</span>
                <span className={`text-[10px] ${active ? "text-white/70" : "text-gray-400"}`}>
                  {qCount} otázek
                </span>
              </button>
            );
          })}
          <button
            onClick={toggleMix}
            className={`flex flex-col items-center gap-1 p-4 rounded-2xl border-2 transition-all tap-highlight active:scale-[0.97] ${
              isMix
                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-md"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e293b]"
            }`}
          >
            <span className="text-2xl">{"\u{1F3B2}"}</span>
            <span className="font-semibold text-sm">Mix všeho</span>
            <span className={`text-[10px] ${isMix ? "text-white/70" : "text-gray-400"}`}>
              {Object.values(subjectCounts).reduce((a, b) => a + b, 0)} otázek
            </span>
          </button>
        </div>

        {/* Question count slider */}
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-4">
            Počet otázek
          </p>
          <CustomSlider
            value={Math.min(count, sliderMax)}
            min={5}
            max={sliderMax}
            step={1}
            marks={[
              { value: 10 },
              { value: 20 },
              { value: 30 },
              { value: 50 },
              ...(sliderMax >= 100 ? [{ value: 100 }] : []),
            ]}
            onChange={(v) => setCount(v)}
          />
        </div>

        <button
          onClick={startTest}
          className="w-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] text-white font-semibold py-4 rounded-2xl text-lg tap-highlight active:opacity-80 transition-opacity shadow-md"
        >
          Spustit test
        </button>
      </main>
    );
  }

  // --- RESULTS ---
  if (phase === "results") {
    const correctCount = results.filter((r) => r.correct).length;
    const pct = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;
    const wrongResults = results.filter((r) => !r.correct);

    // Per-subject breakdown
    const breakdown: Record<string, { total: number; correct: number }> = {};
    for (const r of results) {
      const s = r.question._subject;
      if (!breakdown[s]) breakdown[s] = { total: 0, correct: 0 };
      breakdown[s].total++;
      if (r.correct) breakdown[s].correct++;
    }

    const subjectNames: Record<string, string> = {
      biology: "Biologie",
      chemistry: "Chemie",
      physics: "Fyzika",
    };

    return (
      <main className="pt-6 pb-4 fade-in">
        <div className="text-center mb-6">
          <div
            className={`inline-flex items-center justify-center w-20 h-20 rounded-full text-white text-2xl font-bold mb-4 ${
              pct >= 80
                ? "bg-[var(--color-correct)]"
                : pct >= 50
                  ? "bg-[var(--color-missed)]"
                  : "bg-[var(--color-wrong)]"
            }`}
          >
            {pct}%
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-primary)] dark:text-blue-400">
            Test dokončen!
          </h1>
          <p className="text-gray-500 mt-1">
            {correctCount} z {results.length} správně
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Čas: {formatTime(elapsed)}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-[var(--color-correct)]">{correctCount}</div>
            <div className="text-sm text-gray-500">Správně</div>
          </div>
          <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-[var(--color-wrong)]">{results.length - correctCount}</div>
            <div className="text-sm text-gray-500">Špatně</div>
          </div>
        </div>

        {/* Subject breakdown */}
        {Object.keys(breakdown).length > 1 && (
          <div className="bg-white dark:bg-[#1e293b] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 mb-5">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Podle předmětů</p>
            <div className="space-y-2">
              {Object.entries(breakdown).map(([subj, stats]) => {
                const subjPct = Math.round((stats.correct / stats.total) * 100);
                return (
                  <div key={subj} className="flex items-center justify-between">
                    <span className="text-sm">{subjectNames[subj] || subj}</span>
                    <span
                      className="text-sm font-semibold"
                      style={{
                        color:
                          subjPct >= 75
                            ? "var(--color-correct)"
                            : subjPct >= 50
                              ? "var(--color-missed)"
                              : "var(--color-wrong)",
                      }}
                    >
                      {stats.correct}/{stats.total} ({subjPct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Wrong answers review */}
        {wrongResults.length > 0 && (
          <div className="mb-5">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              Chybné odpovědi ({wrongResults.length})
            </p>
            <div className="space-y-2">
              {wrongResults.map((r, idx) => {
                const expanded = expandedReview === idx;
                return (
                  <div
                    key={idx}
                    className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedReview(expanded ? null : idx)}
                      className="w-full text-left p-4 tap-highlight flex items-start justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-0.5">
                          {subjectNames[r.question._subject]} &middot; Ot. {r.question.id}
                        </p>
                        <p className="text-sm leading-snug line-clamp-2">{r.question.text}</p>
                      </div>
                      <svg
                        className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-1 transition-transform ${expanded ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expanded && (
                      <div className="px-4 pb-4 space-y-1.5">
                        {r.question.options.map((opt) => {
                          const isCorrect = r.question.correct.includes(opt.letter);
                          const wasSelected = r.userAnswer.includes(opt.letter);
                          return (
                            <div
                              key={opt.letter}
                              className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                                isCorrect
                                  ? "bg-green-50 dark:bg-green-950/30"
                                  : wasSelected
                                    ? "bg-red-50 dark:bg-red-950/30"
                                    : ""
                              }`}
                            >
                              <span
                                className={`w-5 h-5 rounded text-xs flex items-center justify-center font-semibold ${
                                  isCorrect
                                    ? "bg-[var(--color-correct)] text-white"
                                    : wasSelected
                                      ? "bg-[var(--color-wrong)] text-white"
                                      : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                                }`}
                              >
                                {opt.letter}
                              </span>
                              <span className={isCorrect ? "font-medium" : ""}>{opt.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2.5">
          <button
            onClick={() => setPhase("setup")}
            className="w-full bg-[var(--color-primary)] text-white font-semibold py-3.5 rounded-xl tap-highlight active:opacity-80 transition-opacity"
          >
            Nový test
          </button>
          <Link
            href={backHref}
            className="block w-full text-center text-gray-500 font-medium py-3.5 tap-highlight"
          >
            Zpět domů
          </Link>
        </div>
      </main>
    );
  }

  // --- ACTIVE QUIZ ---
  if (!currentQuestion) {
    return (
      <main className="pt-10 text-center">
        <p className="text-gray-500 mb-4">Žádné otázky.</p>
        <Link href={backHref} className="text-[var(--color-primary)] dark:text-blue-400 font-medium">
          Zpět domů
        </Link>
      </main>
    );
  }

  const correctSet = new Set(currentQuestion.correct);
  const selectedCorrectCount = Array.from(selected).filter((s) => correctSet.has(s)).length;
  const isBm = bookmarked.has(`${currentQuestion._subject}-${currentQuestion.id}`);

  return (
    <main className="pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleQuit}
          className="text-gray-400 tap-highlight p-1"
          aria-label="Ukončit"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {confirmQuit && (
          <span className="text-xs text-[var(--color-wrong)] font-medium">
            Klikněte znovu pro ukončení
          </span>
        )}
        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2">
          <div
            className="bg-[var(--color-primary)] h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.round(((currentIndex + 1) / totalQuestions) * 100)}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap min-w-[3.5rem] text-right">
          {currentIndex + 1} / {totalQuestions}
        </span>
      </div>

      {/* Timer */}
      <div className="text-center mb-3">
        <span className="text-xs text-gray-400">{formatTime(elapsed)}</span>
      </div>

      {/* Question */}
      <div key={String(currentQuestion.id)} className="fade-in">
        <div className="bg-white dark:bg-[#1e293b] rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-xs text-gray-400">
              Otázka {currentQuestion.id}
            </p>
            <button onClick={handleOpenBookmark} className="tap-highlight -mt-1 -mr-1 p-1" aria-label="Záložka">
              <svg
                className={`w-5 h-5 transition-colors ${isBm ? "text-[var(--color-primary)] dark:text-blue-400" : "text-gray-300 dark:text-gray-600"}`}
                fill={isBm ? "currentColor" : "none"}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
              </svg>
            </button>
          </div>
          <p className="text-base font-medium leading-relaxed">{currentQuestion.text}</p>
        </div>

        <p className="text-xs text-gray-400 mb-3 px-1">Vyberte 1 nebo více správných odpovědí</p>

        {/* Options */}
        <div className="space-y-2.5 mb-5">
          {currentQuestion.options.map((opt) => {
            const isSelected = selected.has(opt.letter);
            const isCorrectAnswer = correctSet.has(opt.letter);
            let borderClass = "border-gray-200 dark:border-gray-700";
            let bgClass = "bg-white dark:bg-[#1e293b]";
            let textExtra = "";
            if (checked) {
              if (isSelected && isCorrectAnswer) { borderClass = "border-[var(--color-correct)]"; bgClass = "bg-green-50 dark:bg-green-950/30"; }
              else if (isSelected && !isCorrectAnswer) { borderClass = "border-[var(--color-wrong)]"; bgClass = "bg-red-50 dark:bg-red-950/30"; }
              else if (!isSelected && isCorrectAnswer) { borderClass = "border-[var(--color-missed)]"; bgClass = "bg-amber-50 dark:bg-amber-950/30"; textExtra = " (správná odpověď)"; }
            } else if (isSelected) { borderClass = "border-[var(--color-primary)]"; bgClass = "bg-blue-50 dark:bg-blue-950/30"; }

            return (
              <button
                key={opt.letter}
                onClick={() => { toggleOption(opt.letter); setConfirmQuit(false); }}
                disabled={checked}
                className={`w-full text-left flex items-start gap-3 p-4 rounded-xl border-2 ${borderClass} ${bgClass} tap-highlight transition-colors min-h-[44px]`}
              >
                <div
                  className={`flex-shrink-0 w-7 h-7 rounded-md border-2 flex items-center justify-center text-sm font-semibold transition-colors ${
                    checked
                      ? isCorrectAnswer
                        ? "border-[var(--color-correct)] bg-[var(--color-correct)] text-white"
                        : isSelected
                          ? "border-[var(--color-wrong)] bg-[var(--color-wrong)] text-white"
                          : "border-gray-300 dark:border-gray-600 text-gray-400"
                      : isSelected
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                        : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {checked && isCorrectAnswer ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  ) : checked && isSelected && !isCorrectAnswer ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  ) : (
                    opt.letter
                  )}
                </div>
                <span className="text-base leading-snug pt-0.5">
                  {opt.text}
                  {checked && textExtra && <span className="text-[var(--color-missed)] text-sm font-medium">{textExtra}</span>}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action */}
        {!checked ? (
          <button
            onClick={handleCheck}
            disabled={selected.size === 0}
            className={`w-full font-semibold py-4 rounded-xl text-lg tap-highlight transition-all ${
              selected.size > 0
                ? "bg-[var(--color-primary)] text-white active:opacity-80"
                : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
            }`}
          >
            Zkontrolovat
          </button>
        ) : (
          <div className="space-y-3">
            <div
              className={`text-center py-2 rounded-lg font-medium ${
                selectedCorrectCount === correctSet.size && selected.size === correctSet.size
                  ? "bg-green-50 dark:bg-green-950/30 text-[var(--color-correct)]"
                  : "bg-red-50 dark:bg-red-950/30 text-[var(--color-wrong)]"
              }`}
            >
              {selectedCorrectCount === correctSet.size && selected.size === correctSet.size
                ? "Správně!"
                : `${selectedCorrectCount}/${correctSet.size} správně`}
            </div>
            <button
              onClick={handleNext}
              className="w-full bg-[var(--color-primary)] text-white font-semibold py-4 rounded-xl text-lg tap-highlight active:opacity-80 transition-opacity"
            >
              {currentIndex + 1 >= totalQuestions ? "Zobrazit výsledky" : "Další otázka →"}
            </button>
          </div>
        )}
      </div>

      <SaveToCollectionModal
        open={bookmarkModalOpen && !!currentQuestion}
        facultyId={facultyId}
        subject={currentQuestion?._subject ?? ""}
        questionId={currentQuestion?.id ?? ""}
        onClose={() => setBookmarkModalOpen(false)}
        onSaved={handleBookmarkSaved}
      />
    </main>
  );
}
