"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  getSubjectData,
  filterValidQuestions,
  shuffleArray,
} from "@/lib/data";
import {
  getAllSavedQuestions,
  getCollection,
  removeQuestionFromCollection,
} from "@/lib/collections";
import type { CollectionQuestion } from "@/lib/collections";
import { recordAnswer } from "@/lib/progress";
import SaveToCollectionModal from "@/components/SaveToCollectionModal";
import type { Question } from "@/lib/types";

function findProgressKey(facultyId: string, subject: string, qId: number | string): string {
  const data = getSubjectData(facultyId, subject);
  if (!data) return "unknown";
  for (const ch of data.chapters) {
    if (ch.subchapters) {
      for (const sub of ch.subchapters) {
        if (sub.questions.some((q) => String(q.id) === String(qId))) {
          return sub.id;
        }
      }
    }
    if (ch.questions?.some((q) => String(q.id) === String(qId))) {
      return String(ch.id);
    }
  }
  return "unknown";
}

function findQuestion(
  facultyId: string,
  subject: string,
  qId: number | string
): Question | null {
  const data = getSubjectData(facultyId, subject);
  if (!data) return null;
  for (const ch of data.chapters) {
    if (ch.questions) {
      const q = ch.questions.find((q) => String(q.id) === String(qId));
      if (q) return q;
    }
    if (ch.subchapters) {
      for (const sub of ch.subchapters) {
        const q = sub.questions.find((q) => String(q.id) === String(qId));
        if (q) return q;
      }
    }
  }
  return null;
}

interface BmQuestion extends Question {
  _facultyId: string;
  _subject: string;
}

interface ResultRow {
  questionId: number | string;
  facultyId: string;
  subject: string;
  correct: boolean;
}

function BookmarkQuizInner() {
  const params = useSearchParams();
  const collectionId = params.get("collection") || "all";

  const [loaded, setLoaded] = useState(false);
  const [questions, setQuestions] = useState<BmQuestion[]>([]);
  const [collectionName, setCollectionName] = useState<string>("Všechny uložené");
  const [quizState, setQuizState] = useState<"active" | "results">("active");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [modalQuestionId, setModalQuestionId] = useState<number | string | null>(null);
  const [modalSubject, setModalSubject] = useState<string>("");
  const [modalFacultyId, setModalFacultyId] = useState<string>("2lf");
  const [removeCorrect, setRemoveCorrect] = useState(false);
  const [removalDone, setRemovalDone] = useState(false);

  // Resolve the question pool from the chosen collection (after mount, so localStorage
  // reads don't cause hydration mismatches).
  useEffect(() => {
    let qs: CollectionQuestion[] = [];
    let cName = "Všechny uložené";
    if (collectionId === "all") {
      qs = getAllSavedQuestions();
    } else {
      const c = getCollection(collectionId);
      if (c) {
        qs = c.questions;
        cName = c.name;
      }
    }
    const resolved: BmQuestion[] = [];
    const bmSet = new Set<string>();
    for (const cq of qs) {
      const q = findQuestion(cq.facultyId, cq.subject, cq.questionId);
      if (q) {
        resolved.push({ ...q, _facultyId: cq.facultyId, _subject: cq.subject });
        bmSet.add(`${cq.facultyId}-${cq.subject}-${cq.questionId}`);
      }
    }
    setBookmarked(bmSet);
    setCollectionName(cName);
    setQuestions(shuffleArray(filterValidQuestions(resolved)) as BmQuestion[]);
    setLoaded(true);
  }, [collectionId]);

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;

  const handleOpenBookmark = () => {
    if (!currentQuestion) return;
    setModalQuestionId(currentQuestion.id);
    setModalSubject(currentQuestion._subject);
    setModalFacultyId(currentQuestion._facultyId);
  };

  const handleModalSaved = (isSaved: boolean) => {
    if (modalQuestionId === null) return;
    const key = `${modalFacultyId}-${modalSubject}-${modalQuestionId}`;
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
    const key = findProgressKey(currentQuestion._facultyId, currentQuestion._subject, currentQuestion.id);
    recordAnswer(currentQuestion._facultyId, currentQuestion._subject, key, currentQuestion.id, isCorrect);
    setResults((prev) => [
      ...prev,
      {
        questionId: currentQuestion.id,
        facultyId: currentQuestion._facultyId,
        subject: currentQuestion._subject,
        correct: isCorrect,
      },
    ]);
  };

  const handleNext = () => {
    if (currentIndex + 1 >= totalQuestions) {
      setQuizState("results");
    } else {
      setCurrentIndex((i) => i + 1);
      setSelected(new Set());
      setChecked(false);
    }
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

  const performRemoval = (enabled: boolean) => {
    setRemoveCorrect(enabled);
    if (!enabled || removalDone || collectionId === "all") return;
    // Apply removal: delete correctly answered questions from the collection
    for (const r of results) {
      if (r.correct) {
        removeQuestionFromCollection(collectionId, r.facultyId, r.subject, r.questionId);
      }
    }
    setRemovalDone(true);
  };

  if (!loaded) {
    return (
      <main className="pt-6">
        <p className="text-sm text-gray-500">Načítání...</p>
      </main>
    );
  }

  if (totalQuestions === 0) {
    return (
      <main className="pt-10 text-center fade-in">
        <p className="text-gray-500 mb-4">
          Žádné otázky v této kolekci k procvičování.
        </p>
        <Link
          href="/bookmarks"
          className="text-[var(--color-primary)] dark:text-blue-400 font-medium"
        >
          Zpět na záložky
        </Link>
      </main>
    );
  }

  if (quizState === "results") {
    const correctCount = results.filter((r) => r.correct).length;
    const pct =
      results.length > 0
        ? Math.round((correctCount / results.length) * 100)
        : 0;
    const canRemove = collectionId !== "all" && correctCount > 0;
    const backHref =
      collectionId === "all"
        ? "/bookmarks/all"
        : `/bookmarks/collection?id=${collectionId}`;

    return (
      <main className="pt-6 fade-in">
        <div className="text-center mb-8">
          <div
            className={`inline-flex items-center justify-center w-20 h-20 rounded-full text-white text-2xl font-bold mb-4 ${
              pct >= 80
                ? "bg-[var(--color-correct)]"
                : pct >= 50
                  ? "bg-[var(--color-missed)]"
                  : "bg-[var(--color-wrong)]"
            }`}
          >
            {pct} %
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-primary)] dark:text-blue-400">
            Hotovo!
          </h1>
          <p className="text-gray-500 mt-1">
            {correctCount} z {results.length} správně
          </p>
          <p className="text-xs text-gray-400 mt-1">{collectionName}</p>
        </div>

        {canRemove && (
          <div className="bg-white dark:bg-[#1e293b] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 mb-4">
            <label className="flex items-center justify-between gap-3 cursor-pointer tap-highlight">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  Odebrat správně zodpovězené z kolekce
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {removalDone
                    ? `${correctCount} otázek odebráno`
                    : `${correctCount} otázek bude odebráno`}
                </div>
              </div>
              <div
                className={`flex-shrink-0 w-12 h-7 rounded-full transition-colors relative ${
                  removeCorrect ? "bg-[var(--color-primary)]" : "bg-gray-300 dark:bg-gray-700"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  performRemoval(!removeCorrect);
                }}
              >
                <div
                  className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    removeCorrect ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </div>
            </label>
          </div>
        )}

        <div className="space-y-2.5">
          <Link
            href={`/bookmarks/quiz?collection=${collectionId}`}
            className="block w-full text-center bg-white dark:bg-transparent text-[var(--color-primary)] dark:text-blue-400 font-semibold py-3.5 rounded-xl border-2 border-[var(--color-primary)] dark:border-blue-400 tap-highlight"
          >
            Zopakovat
          </Link>
          <Link
            href={backHref}
            className="block w-full text-center text-gray-500 font-medium py-3.5 tap-highlight"
          >
            Zpět na kolekci
          </Link>
        </div>
      </main>
    );
  }

  if (!currentQuestion) return null;

  const correctSet = new Set(currentQuestion.correct);
  const selectedCorrectCount = Array.from(selected).filter((s) =>
    correctSet.has(s)
  ).length;
  const isBm = bookmarked.has(`${currentQuestion._facultyId}-${currentQuestion._subject}-${currentQuestion.id}`);

  return (
    <main className="pt-4 pb-4">
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/bookmarks"
          className="text-gray-400 tap-highlight p-1"
          aria-label="Zavřít"
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
        </Link>
        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2">
          <div
            className="bg-[var(--color-primary)] h-2 rounded-full transition-all duration-300"
            style={{
              width: `${Math.round(((currentIndex + 1) / totalQuestions) * 100)}%`,
            }}
          />
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap min-w-[3.5rem] text-right">
          {currentIndex + 1} / {totalQuestions}
        </span>
      </div>

      <div key={String(currentQuestion.id)} className="fade-in">
        <div className="bg-white dark:bg-[#1e293b] rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-xs text-gray-400">Otázka {currentQuestion.id}</p>
            <button
              onClick={handleOpenBookmark}
              className="tap-highlight -mt-1 -mr-1 p-1"
              aria-label="Záložka"
            >
              <svg
                className={`w-5 h-5 transition-colors ${
                  isBm
                    ? "text-[var(--color-primary)] dark:text-blue-400"
                    : "text-gray-300 dark:text-gray-600"
                }`}
                fill={isBm ? "currentColor" : "none"}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
                />
              </svg>
            </button>
          </div>
          <p className="text-base font-medium leading-relaxed">
            {currentQuestion.text}
          </p>
        </div>

        <p className="text-xs text-gray-400 mb-3 px-1">
          Vyberte 1 nebo více správných odpovědí
        </p>

        <div className="space-y-2.5 mb-5">
          {currentQuestion.options.map((opt) => {
            const isSelected = selected.has(opt.letter);
            const isCorrectAnswer = correctSet.has(opt.letter);
            let borderClass = "border-gray-200 dark:border-gray-700";
            let bgClass = "bg-white dark:bg-[#1e293b]";
            let textExtra = "";
            if (checked) {
              if (isSelected && isCorrectAnswer) {
                borderClass = "border-[var(--color-correct)]";
                bgClass = "bg-green-50 dark:bg-green-950/30";
              } else if (isSelected && !isCorrectAnswer) {
                borderClass = "border-[var(--color-wrong)]";
                bgClass = "bg-red-50 dark:bg-red-950/30";
              } else if (!isSelected && isCorrectAnswer) {
                borderClass = "border-[var(--color-missed)]";
                bgClass = "bg-amber-50 dark:bg-amber-950/30";
                textExtra = " (správná odpověď)";
              }
            } else if (isSelected) {
              borderClass = "border-[var(--color-primary)]";
              bgClass = "bg-blue-50 dark:bg-blue-950/30";
            }

            return (
              <button
                key={opt.letter}
                onClick={() => toggleOption(opt.letter)}
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
                    <svg
                      className="w-4 h-4"
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
                  ) : checked && isSelected && !isCorrectAnswer ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  ) : (
                    opt.letter
                  )}
                </div>
                <span className="text-base leading-snug pt-0.5">
                  {opt.text}
                  {checked && textExtra && (
                    <span className="text-[var(--color-missed)] text-sm font-medium">
                      {textExtra}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

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
                selectedCorrectCount === correctSet.size &&
                selected.size === correctSet.size
                  ? "bg-green-50 dark:bg-green-950/30 text-[var(--color-correct)]"
                  : "bg-red-50 dark:bg-red-950/30 text-[var(--color-wrong)]"
              }`}
            >
              {selectedCorrectCount === correctSet.size &&
              selected.size === correctSet.size
                ? "Správně!"
                : `${selectedCorrectCount}/${correctSet.size} správně`}
            </div>
            <button
              onClick={handleNext}
              className="w-full bg-[var(--color-primary)] text-white font-semibold py-4 rounded-xl text-lg tap-highlight active:opacity-80 transition-opacity"
            >
              {currentIndex + 1 >= totalQuestions
                ? "Zobrazit výsledky"
                : "Další otázka →"}
            </button>
          </div>
        )}
      </div>

      <SaveToCollectionModal
        open={modalQuestionId !== null}
        facultyId={modalFacultyId}
        subject={modalSubject}
        questionId={modalQuestionId ?? ""}
        onClose={() => setModalQuestionId(null)}
        onSaved={handleModalSaved}
      />
    </main>
  );
}

export default function BookmarkQuizPage() {
  return (
    <Suspense
      fallback={
        <main className="pt-6">
          <p className="text-sm text-gray-500">Načítání...</p>
        </main>
      }
    >
      <BookmarkQuizInner />
    </Suspense>
  );
}
