"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  getSubjectData,
  getChapterQuestions,
  getSubchapterQuestions,
  filterValidQuestions,
  shuffleArray,
  getExplanation,
} from "@/lib/data";
import { recordAnswer, getSubjectProgress } from "@/lib/progress";
import { isQuestionSaved } from "@/lib/collections";
import SaveToCollectionModal from "@/components/SaveToCollectionModal";
import type { Question } from "@/lib/types";

interface Props {
  subject: string;
  chapterParam: string;
  subchapterParam?: string;
  mode: string;
}

type QuizState = "setup" | "active" | "results";

export default function QuizRunner({
  subject,
  chapterParam,
  subchapterParam,
  mode,
}: Props) {
  const data = getSubjectData(subject);
  const chapterId = chapterParam === "all" ? "all" : Number(chapterParam);
  const chapter =
    chapterId === "all"
      ? null
      : data.chapters.find((ch) => ch.id === chapterId);

  let quizName: string;
  if (chapterId === "all") {
    quizName = "Všechny otázky";
  } else if (subchapterParam && chapter?.subchapters) {
    const sub = chapter.subchapters.find((s) => s.id === subchapterParam);
    quizName = sub ? sub.name : chapter?.name || "";
  } else {
    quizName = chapter?.name || "Neznámá kapitola";
  }

  const backHref = subchapterParam
    ? `/${subject}/chapter/${chapterParam}`
    : `/${subject}`;

  const [shuffle, setShuffle] = useState(true);
  const [quizState, setQuizState] = useState<QuizState>("setup");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<
    { questionId: number | string; correct: boolean }[]
  >([]);
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [modalQuestionId, setModalQuestionId] = useState<number | string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const sourceQuestions = useMemo(() => {
    if (subchapterParam && chapterId !== "all") {
      return filterValidQuestions(
        getSubchapterQuestions(subject, chapterId as number, subchapterParam)
      );
    }
    return filterValidQuestions(getChapterQuestions(subject, chapterId));
  }, [subject, chapterId, subchapterParam]);

  const questions = useMemo(() => {
    let qs: Question[];
    if (mode === "wrong") {
      const progress = getSubjectProgress(subject);
      const wrongIds = new Set<string>();
      if (chapterId === "all") {
        for (const cp of Object.values(progress)) {
          cp.wrongIds.forEach((id) => wrongIds.add(String(id)));
        }
      } else {
        // Collect from chapter and any subchapters
        const cp = progress[String(chapterId)];
        if (cp) cp.wrongIds.forEach((id) => wrongIds.add(String(id)));
        if (subchapterParam) {
          const scp = progress[subchapterParam];
          if (scp) scp.wrongIds.forEach((id) => wrongIds.add(String(id)));
        }
      }
      qs = sourceQuestions.filter((q) => wrongIds.has(String(q.id)));
    } else {
      qs = sourceQuestions;
    }
    return shuffle ? shuffleArray(qs) : qs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizState]);

  // Initialize bookmark state from localStorage (after mount, to avoid hydration mismatch)
  useEffect(() => {
    const bm = new Set<string>();
    for (const q of sourceQuestions) {
      if (isQuestionSaved(subject, q.id)) bm.add(String(q.id));
    }
    setBookmarked(bm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  const handleOpenBookmark = (qId: number | string) => {
    setModalQuestionId(qId);
  };

  const handleModalSaved = (qId: number | string, isSaved: boolean) => {
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (isSaved) next.add(String(qId));
      else next.delete(String(qId));
      return next;
    });
  };

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;

  const findProgressKey = useCallback(
    (qId: number | string): string => {
      // For subjects with subchapters, use subchapter id as key
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
      return chapterParam;
    },
    [data.chapters, chapterParam]
  );

  const handleCheck = () => {
    if (!currentQuestion || selected.size === 0) return;
    setChecked(true);
    const correctSet = new Set(currentQuestion.correct);
    const selectedArr = Array.from(selected);
    const isCorrect =
      selectedArr.length === correctSet.size &&
      selectedArr.every((s) => correctSet.has(s));

    const key = findProgressKey(currentQuestion.id);
    recordAnswer(subject, key, currentQuestion.id, isCorrect);
    setResults((prev) => [
      ...prev,
      { questionId: currentQuestion.id, correct: isCorrect },
    ]);
  };

  const handleNext = () => {
    if (currentIndex + 1 >= totalQuestions) {
      setQuizState("results");
    } else {
      setCurrentIndex((i) => i + 1);
      setSelected(new Set());
      setChecked(false);
      setShowExplanation(false);
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

  // Build quiz URL for replay
  const quizUrl = subchapterParam
    ? `/${subject}/quiz?chapter=${chapterParam}&sub=${subchapterParam}`
    : `/${subject}/quiz?chapter=${chapterParam}`;

  // --- SETUP SCREEN ---
  if (quizState === "setup") {
    return (
      <main className="pt-6 fade-in">
        <Link
          href={backHref}
          className="inline-flex items-center text-sm text-gray-500 mb-6 tap-highlight"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Zpět
        </Link>

        <h1 className="text-xl font-bold text-[var(--color-primary)] mb-1">
          {quizName}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {sourceQuestions.length} otázek
          {mode === "wrong" && " (pouze chybné)"}
        </p>

        <div className="bg-white dark:bg-[#1e293b] rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-5">
          <label className="flex items-center justify-between tap-highlight cursor-pointer">
            <span className="text-base font-medium">Zamíchat otázky</span>
            <div
              className={`w-12 h-7 rounded-full transition-colors relative ${
                shuffle ? "bg-[var(--color-primary)]" : "bg-gray-300"
              }`}
              onClick={() => setShuffle((s) => !s)}
            >
              <div
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  shuffle ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </div>
          </label>
        </div>

        <button
          onClick={() => setQuizState("active")}
          className="w-full bg-[var(--color-primary)] text-white font-semibold py-4 rounded-xl text-lg tap-highlight active:opacity-80 transition-opacity"
        >
          Začít procvičování
        </button>
      </main>
    );
  }

  // --- RESULTS SCREEN ---
  if (quizState === "results") {
    const correctCount = results.filter((r) => r.correct).length;
    const wrongCount = results.length - correctCount;
    const pct =
      results.length > 0
        ? Math.round((correctCount / results.length) * 100)
        : 0;

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
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">
            Hotovo!
          </h1>
          <p className="text-gray-500 mt-1">
            {correctCount} z {results.length} správně
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-[var(--color-correct)]">
              {correctCount}
            </div>
            <div className="text-sm text-gray-500">Správně</div>
          </div>
          <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-[var(--color-wrong)]">
              {wrongCount}
            </div>
            <div className="text-sm text-gray-500">Špatně</div>
          </div>
        </div>

        <div className="space-y-2.5">
          {wrongCount > 0 && (
            <Link
              href={`${quizUrl}&mode=wrong`}
              className="block w-full text-center bg-[var(--color-primary)] text-white font-semibold py-3.5 rounded-xl tap-highlight active:opacity-80 transition-opacity"
            >
              Zopakovat chybné ({wrongCount})
            </Link>
          )}
          <Link
            href={quizUrl}
            className="block w-full text-center bg-white dark:bg-transparent text-[var(--color-primary)] dark:text-blue-400 font-semibold py-3.5 rounded-xl border-2 border-[var(--color-primary)] dark:border-blue-400 tap-highlight active:bg-gray-50 dark:active:bg-gray-800 transition-colors"
          >
            Zopakovat vše
          </Link>
          <Link
            href={backHref}
            className="block w-full text-center text-gray-500 font-medium py-3.5 tap-highlight"
          >
            Zpět na kapitoly
          </Link>
        </div>
      </main>
    );
  }

  // --- QUIZ ACTIVE ---
  if (!currentQuestion) {
    return (
      <main className="pt-10 text-center">
        <p className="text-gray-500 mb-4">Žádné otázky k procvičování.</p>
        <Link
          href={backHref}
          className="text-[var(--color-primary)] font-medium"
        >
          Zpět na kapitoly
        </Link>
      </main>
    );
  }

  const correctSet = new Set(currentQuestion.correct);
  const selectedCorrectCount = Array.from(selected).filter((s) =>
    correctSet.has(s)
  ).length;

  return (
    <main className="pt-4 pb-4">
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href={backHref}
          className="text-gray-400 tap-highlight p-1"
          aria-label="Zavřít"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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

      {/* Question */}
      <div key={String(currentQuestion.id)} className="fade-in">
        <div className="bg-white dark:bg-[#1e293b] rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-xs text-gray-400">
              Otázka {currentQuestion.id}
            </p>
            <button
              onClick={() => handleOpenBookmark(currentQuestion.id)}
              className="tap-highlight -mt-1 -mr-1 p-1"
              aria-label="Záložka"
            >
              <svg
                className={`w-5 h-5 transition-colors ${
                  bookmarked.has(String(currentQuestion.id))
                    ? "text-[var(--color-primary)] dark:text-blue-400 fill-current"
                    : "text-gray-300 dark:text-gray-600"
                }`}
                fill={bookmarked.has(String(currentQuestion.id)) ? "currentColor" : "none"}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
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

        {/* Options */}
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
                          : "border-gray-300 text-gray-400"
                      : isSelected
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                        : "border-gray-300 text-gray-500"
                  }`}
                >
                  {checked && isCorrectAnswer ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : checked && isSelected && !isCorrectAnswer ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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

        {/* Action button */}
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

            {/* Explanation toggle & card */}
            {(() => {
              const isCorrect = selectedCorrectCount === correctSet.size && selected.size === correctSet.size;
              const explanation = getExplanation(subject, currentQuestion.id);
              return (
                <>
                  {!showExplanation && (
                    <button
                      onClick={() => setShowExplanation(true)}
                      className={`w-full text-sm font-medium py-2.5 rounded-xl tap-highlight transition-colors ${
                        isCorrect
                          ? "text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                          : "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/50"
                      }`}
                    >
                      💡 {isCorrect ? "Zobrazit vysvětlení" : "Vysvětlit"}
                    </button>
                  )}
                  {showExplanation && (
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-lg leading-none">💡</span>
                        <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300">Vysvětlení</h3>
                      </div>
                      {explanation ? (
                        <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed explanation-content">
                          {explanation.split("\n\n").map((block, i) => (
                            <p key={i} className={i > 0 ? "mt-2" : ""}>
                              {block.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
                                part.startsWith("**") && part.endsWith("**") ? (
                                  <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
                                ) : (
                                  <span key={j}>{part}</span>
                                )
                              )}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Vysvětlení pro tuto otázku zatím není k dispozici.
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            Tip: Vyhledej si správnou odpověď v učebnici pro lepší zapamatování.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}

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
        subject={subject}
        questionId={modalQuestionId ?? ""}
        onClose={() => setModalQuestionId(null)}
        onSaved={(isSaved) => {
          if (modalQuestionId !== null) handleModalSaved(modalQuestionId, isSaved);
        }}
      />
    </main>
  );
}
