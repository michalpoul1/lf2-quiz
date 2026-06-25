"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";

import {
  getSubjectData,
  getChapterQuestions,
  filterValidQuestions,
  shuffleArray,
} from "@/lib/data";
import { recordAnswer } from "@/lib/progress";
import { saveTestResult } from "@/lib/testHistory";
import CustomSlider from "@/components/CustomSlider";
import type { Question } from "@/lib/types";

/* ─── types ─── */
interface TaggedQuestion extends Question {
  _subject: string;
}

type Phase = "setup" | "exam" | "results";

const SUBJECT_NAMES: Record<string, string> = {
  biology: "Biologie",
  chemistry: "Chemie",
  physics: "Fyzika",
};

const SESSION_KEY = "lf2-exam-state";

/* ─── helpers ─── */
function formatTimer(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

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

function buildQuestions(
  facultyId: string,
  totalCount: number,
  bioRatio: number,
  chemRatio: number,
  physRatio: number
): TaggedQuestion[] {
  const sum = bioRatio + chemRatio + physRatio;
  const bioCount = Math.round((bioRatio / sum) * totalCount);
  const chemCount = Math.round((chemRatio / sum) * totalCount);
  const physCount = totalCount - bioCount - chemCount;

  const pick = (subject: string, n: number): TaggedQuestion[] => {
    const all = filterValidQuestions(getChapterQuestions(facultyId, subject, "all"));
    return shuffleArray(all)
      .slice(0, n)
      .map((q) => ({ ...q, _subject: subject }));
  };

  const qs = [
    ...pick("biology", bioCount),
    ...pick("chemistry", chemCount),
    ...pick("physics", physCount),
  ];
  return shuffleArray(qs);
}

/* ─── session storage helpers ─── */
interface ExamState {
  questions: TaggedQuestion[];
  answers: Record<number, string[]>;
  deadline: number;
  startedAt: number;
  totalCount: number;
  timeLimitMs: number;
}

function saveExam(state: ExamState) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {}
}

function loadExam(): ExamState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearExam() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}

/* ══════════════════════════════════════════════════════════ */
export default function ExamSimulationPage() {

  const facultyId = "2lf";
  const backHref = "/";
  const [phase, setPhase] = useState<Phase>("setup");

  // Setup
  const [totalCount, setTotalCount] = useState(80);
  const [timeMinutes, setTimeMinutes] = useState(120);
  const [bioRatio, setBioRatio] = useState(33);
  const [chemRatio, setChemRatio] = useState(34);
  const [physRatio, setPhysRatio] = useState(33);
  const [customRatio, setCustomRatio] = useState(false);

  // Exam
  const [questions, setQuestions] = useState<TaggedQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [deadline, setDeadline] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [showAllReview, setShowAllReview] = useState(false);
  const submittedRef = useRef(false);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timeLimitMsRef = useRef(0);

  // Results
  const [finishTime, setFinishTime] = useState(0);

  /* ─── restore session ─── */
  useEffect(() => {
    const saved = loadExam();
    if (saved && saved.deadline > Date.now()) {
      setQuestions(saved.questions);
      setAnswers(saved.answers);
      setDeadline(saved.deadline);
      setStartedAt(saved.startedAt);
      setTotalCount(saved.totalCount);
      timeLimitMsRef.current = saved.timeLimitMs;
      questionRefs.current = new Array(saved.questions.length).fill(null);
      setPhase("exam");
    }
  }, []);

  /* ─── timer tick using Date.now() ─── */
  useEffect(() => {
    if (phase !== "exam") return;
    const tick = () => {
      const r = deadline - Date.now();
      setRemaining(r);
      if (r <= 0 && !submittedRef.current) {
        submittedRef.current = true;
        handleSubmit(true);
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, deadline]);

  /* ─── persist answers to sessionStorage on change ─── */
  useEffect(() => {
    if (phase !== "exam" || questions.length === 0) return;
    saveExam({
      questions,
      answers,
      deadline,
      startedAt,
      totalCount,
      timeLimitMs: timeLimitMsRef.current,
    });
  }, [answers, phase, questions, deadline, startedAt, totalCount]);

  /* ─── start exam ─── */
  const startExam = () => {
    const qs = buildQuestions(facultyId, totalCount, bioRatio, chemRatio, physRatio);
    const timeLimitMs = timeMinutes * 60 * 1000;
    const now = Date.now();
    timeLimitMsRef.current = timeLimitMs;
    setQuestions(qs);
    setAnswers({});
    setDeadline(now + timeLimitMs);
    setStartedAt(now);
    setRemaining(timeLimitMs);
    setConfirmSubmit(false);
    submittedRef.current = false;
    questionRefs.current = new Array(qs.length).fill(null);
    setPhase("exam");
    window.scrollTo(0, 0);
  };

  /* ─── toggle answer ─── */
  const toggleAnswer = useCallback(
    (qIdx: number, letter: string) => {
      setAnswers((prev) => {
        const current = prev[qIdx] || [];
        const next = current.includes(letter)
          ? current.filter((l) => l !== letter)
          : [...current, letter];
        return { ...prev, [qIdx]: next };
      });
    },
    []
  );

  /* ─── submit ─── */
  const handleSubmit = useCallback(
    (timeUp = false) => {
      if (timeUp) {
        // alert handled inline
      }
      const elapsed = Date.now() - startedAt;
      setFinishTime(elapsed);
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const userAns = answers[i] || [];
        const correctSet = new Set(q.correct);
        const isCorrect =
          userAns.length === correctSet.size &&
          userAns.every((l) => correctSet.has(l));
        const key = findProgressKey(facultyId, q._subject, q.id);
        recordAnswer(facultyId, q._subject, key, q.id, isCorrect);
      }
      // Save test result to history
      let correctCount = 0;
      const subjects = new Set<string>();
      for (let i = 0; i < questions.length; i++) {
        subjects.add(questions[i]._subject);
        const userAns = answers[i] || [];
        const cSet = new Set(questions[i].correct);
        if (userAns.length === cSet.size && userAns.every((l) => cSet.has(l)))
          correctCount++;
      }
      saveTestResult("simulation", facultyId, [...subjects], questions.length, correctCount, Math.floor(elapsed / 1000));

      clearExam();
      setPhase("results");
      window.scrollTo(0, 0);
    },
    [questions, answers, startedAt, facultyId]
  );

  /* ─── scroll to question ─── */
  const scrollToQ = (idx: number) => {
    questionRefs.current[idx]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    setShowGrid(false);
  };

  /* ─── computed values (unconditional) ─── */
  const answeredCount = useMemo(
    () => Object.values(answers).filter((a) => a.length > 0).length,
    [answers]
  );

  const scores = useMemo(
    () =>
      questions.map((q, i) => {
        const userAns = answers[i] || [];
        const correctSet = new Set(q.correct);
        const isCorrect =
          userAns.length > 0 &&
          userAns.length === correctSet.size &&
          userAns.every((l) => correctSet.has(l));
        return { question: q, userAnswer: userAns, isCorrect, idx: i };
      }),
    [questions, answers]
  );

  const totalCorrect = useMemo(
    () => scores.filter((s) => s.isCorrect).length,
    [scores]
  );

  const pct =
    questions.length > 0
      ? Math.round((totalCorrect / questions.length) * 100)
      : 0;

  const breakdown = useMemo(() => {
    const b: Record<string, { total: number; correct: number }> = {};
    for (const s of scores) {
      const subj = s.question._subject;
      if (!b[subj]) b[subj] = { total: 0, correct: 0 };
      b[subj].total++;
      if (s.isCorrect) b[subj].correct++;
    }
    return b;
  }, [scores]);

  const displayed = useMemo(
    () => (showAllReview ? scores : scores.filter((s) => !s.isCorrect)),
    [showAllReview, scores]
  );

  const isLowTime = remaining < 10 * 60 * 1000;

  /* ═══════ SINGLE RETURN — conditional JSX by phase ═══════ */
  return (
    <>
      {/* ═══════ SETUP ═══════ */}
      {phase === "setup" && (
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

          {/* Info card */}
          <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-3xl">{"\u{1F393}"}</span>
              <div>
                <h1 className="text-lg font-bold text-violet-900 dark:text-violet-200">
                  Simulace přijímacího testu
                </h1>
                <p className="text-sm text-violet-700 dark:text-violet-300 mt-0.5">
                  na 2. LF UK
                </p>
                <p className="text-xs text-violet-600/70 dark:text-violet-400/70 mt-2 leading-relaxed">
                  Vyzkoušejte si reálné podmínky přijímací zkoušky. Všechny
                  otázky se zobrazí najednou — odpovídejte v libovolném pořadí.
                </p>
              </div>
            </div>
          </div>

          {/* Question count slider */}
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-4">
              Počet otázek
            </p>
            <CustomSlider
              value={totalCount}
              min={10}
              max={150}
              step={5}
              marks={[
                { value: 30 },
                { value: 50 },
                { value: 80 },
                { value: 100 },
                { value: 120 },
              ]}
              unit="otázek"
              onChange={setTotalCount}
            />
          </div>

          {/* Time limit slider */}
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-4">
              Časový limit
            </p>
            <CustomSlider
              value={timeMinutes}
              min={15}
              max={240}
              step={5}
              marks={[
                { value: 30 },
                { value: 60 },
                { value: 90 },
                { value: 120 },
                { value: 180 },
              ]}
              unit="minut"
              subtitle={totalCount > 0 ? `~${Math.round((timeMinutes * 60) / totalCount)} sekund na otázku` : undefined}
              onChange={setTimeMinutes}
            />
          </div>

          {/* Subject ratio */}
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Poměr předmětů
              </p>
              <button
                onClick={() => {
                  setCustomRatio(!customRatio);
                  if (customRatio) {
                    setBioRatio(33);
                    setChemRatio(34);
                    setPhysRatio(33);
                  }
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium tap-highlight transition-colors ${
                  customRatio
                    ? "bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                }`}
              >
                {customRatio ? "Vlastní" : "Rovnoměrný"}
              </button>
            </div>
            {customRatio ? (
              <div className="space-y-4">
                {[
                  { label: "\u{1F9EC} Biologie", value: bioRatio, set: setBioRatio },
                  { label: "\u2697\uFE0F Chemie", value: chemRatio, set: setChemRatio },
                  { label: "\u26A1 Fyzika", value: physRatio, set: setPhysRatio },
                ].map((s) => {
                  const total = bioRatio + chemRatio + physRatio;
                  const pctVal = total > 0 ? Math.round((s.value / total) * 100) : 0;
                  const qCount = total > 0 ? Math.round((s.value / total) * totalCount) : 0;
                  return (
                    <div key={s.label}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-medium">{s.label}</span>
                        <span className="font-semibold text-[var(--color-primary)] dark:text-blue-400">
                          {pctVal}% <span className="text-gray-400 font-normal">({qCount})</span>
                        </span>
                      </div>
                      <input
                        type="range"
                        min={5}
                        max={80}
                        value={s.value}
                        onChange={(e) => s.set(Number(e.target.value))}
                        className="custom-slider w-full"
                        style={{ "--slider-pct": `${((s.value - 5) / 75) * 100}%` } as React.CSSProperties}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex gap-2">
                {[
                  { icon: "\u{1F9EC}", label: "Bio", pct: 33 },
                  { icon: "\u2697\uFE0F", label: "Chem", pct: 34 },
                  { icon: "\u26A1", label: "Fyz", pct: 33 },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex-1 text-center py-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                  >
                    <span className="text-lg">{s.icon}</span>
                    <div className="text-xs font-semibold text-gray-500 mt-1">{s.pct}%</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={startExam}
            className="w-full bg-gradient-to-r from-violet-600 to-violet-500 text-white font-semibold py-4 rounded-2xl text-lg tap-highlight active:opacity-80 transition-opacity shadow-md flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Zahájit zkoušku
          </button>
        </main>
      )}

      {/* ═══════ EXAM ═══════ */}
      {phase === "exam" && (
        <main className="pt-0 pb-4">
          {/* Sticky header */}
          <div className="sticky top-0 z-40 bg-[var(--background)] pb-2 pt-3 -mx-4 px-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span
                  className={`font-mono text-lg font-bold ${
                    isLowTime ? "text-[var(--color-wrong)] animate-pulse" : "text-[var(--color-primary)] dark:text-blue-400"
                  }`}
                >
                  {formatTimer(remaining)}
                </span>
                <span className="text-sm text-gray-400">
                  {answeredCount}/{questions.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 tap-highlight"
                  aria-label="Navigace"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                </button>
                {!confirmSubmit ? (
                  <button
                    onClick={() => setConfirmSubmit(true)}
                    className="px-3 py-1.5 bg-violet-600 text-white text-sm font-semibold rounded-lg tap-highlight"
                  >
                    Odevzdat
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubmit(false)}
                    className="px-3 py-1.5 bg-[var(--color-wrong)] text-white text-sm font-semibold rounded-lg tap-highlight animate-pulse"
                  >
                    Potvrdit!
                  </button>
                )}
              </div>
            </div>

            {/* Question grid overlay */}
            {showGrid && (
              <div className="grid grid-cols-10 gap-1 py-2 max-h-48 overflow-y-auto">
                {questions.map((_, i) => {
                  const hasAnswer = (answers[i]?.length || 0) > 0;
                  return (
                    <button
                      key={i}
                      onClick={() => scrollToQ(i)}
                      className={`w-full aspect-square rounded text-xs font-semibold flex items-center justify-center tap-highlight transition-colors ${
                        hasAnswer
                          ? "bg-[var(--color-correct)] text-white"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Time-up overlay */}
          {remaining <= 0 && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-6 text-center max-w-sm">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-wrong)] flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold mb-2">Čas vypršel!</h2>
                <p className="text-gray-500 mb-4">Test bude automaticky odevzdán.</p>
              </div>
            </div>
          )}

          {/* Questions list */}
          <div className="space-y-4 mt-4">
            {questions.map((q, qIdx) => {
              const selected = answers[qIdx] || [];
              const hasAnswer = selected.length > 0;
              return (
                <div
                  key={qIdx}
                  ref={(el) => { questionRefs.current[qIdx] = el; }}
                  className={`bg-white dark:bg-[#1e293b] rounded-xl p-4 shadow-sm border-2 transition-colors ${
                    hasAnswer
                      ? "border-[var(--color-correct)]/40"
                      : "border-gray-100 dark:border-gray-700"
                  }`}
                >
                  <div className="flex items-start gap-2 mb-3">
                    <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold flex items-center justify-center flex-shrink-0 text-gray-500 dark:text-gray-400">
                      {qIdx + 1}
                    </span>
                    <p className="text-sm font-medium leading-snug flex-1">
                      {q.text}
                    </p>
                  </div>
                  <div className="space-y-1.5 pl-9">
                    {q.options.map((opt) => {
                      const isSelected = selected.includes(opt.letter);
                      return (
                        <button
                          key={opt.letter}
                          onClick={() => {
                            toggleAnswer(qIdx, opt.letter);
                            setConfirmSubmit(false);
                          }}
                          className={`w-full text-left flex items-center gap-2 p-2.5 rounded-lg border transition-colors tap-highlight text-sm ${
                            isSelected
                              ? "border-[var(--color-primary)] bg-blue-50 dark:bg-blue-950/30"
                              : "border-gray-200 dark:border-gray-700"
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-colors ${
                              isSelected
                                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                                : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            {isSelected ? (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              opt.letter
                            )}
                          </div>
                          <span className="leading-snug">{opt.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom spacer + submit button */}
          <div className="mt-6 mb-20">
            <button
              onClick={() => {
                if (!confirmSubmit) {
                  setConfirmSubmit(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } else {
                  handleSubmit(false);
                }
              }}
              className={`w-full font-semibold py-4 rounded-xl text-lg tap-highlight active:opacity-80 transition-opacity ${
                confirmSubmit
                  ? "bg-[var(--color-wrong)] text-white"
                  : "bg-violet-600 text-white"
              }`}
            >
              {confirmSubmit
                ? `Potvrdit odevzdání (${answeredCount}/${questions.length} zodpovězeno)`
                : "Odevzdat test"}
            </button>
          </div>
        </main>
      )}

      {/* ═══════ RESULTS ═══════ */}
      {phase === "results" && (
        <main className="pt-6 pb-4 fade-in">
          {/* Score hero */}
          <div className="text-center mb-6">
            <div
              className={`inline-flex items-center justify-center w-24 h-24 rounded-full text-white text-3xl font-bold mb-4 ${
                pct >= 70
                  ? "bg-[var(--color-correct)]"
                  : pct >= 50
                    ? "bg-[var(--color-missed)]"
                    : "bg-[var(--color-wrong)]"
              }`}
            >
              {pct}%
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-primary)] dark:text-blue-400">
              Výsledky zkoušky
            </h1>
            <p className="text-gray-500 mt-1 text-lg">
              {totalCorrect} / {questions.length} bodů
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Čas: {formatTimer(finishTime)}
            </p>
            <p className="text-xs text-gray-400 mt-2 italic">
              {pct >= 70
                ? "Nad 70% je obvykle dostatečné pro přijetí. Skvělý výkon!"
                : pct >= 50
                  ? "Nad 70% je obvykle dostatečné pro přijetí. Ještě trénujte!"
                  : "Nad 70% je obvykle dostatečné pro přijetí. Je třeba hodně trénovat."}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-[var(--color-correct)]">{totalCorrect}</div>
              <div className="text-xs text-gray-500">Správně</div>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-[var(--color-wrong)]">
                {scores.filter((s) => !s.isCorrect && (answers[s.idx]?.length || 0) > 0).length}
              </div>
              <div className="text-xs text-gray-500">Špatně</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-gray-400">
                {scores.filter((s) => (answers[s.idx]?.length || 0) === 0).length}
              </div>
              <div className="text-xs text-gray-500">Bez odpovědi</div>
            </div>
          </div>

          {/* Subject breakdown */}
          <div className="bg-white dark:bg-[#1e293b] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 mb-5">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Podle předmětů</p>
            <div className="space-y-2.5">
              {Object.entries(breakdown).map(([subj, stats]) => {
                const subjPct =
                  stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                return (
                  <div key={subj}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{SUBJECT_NAMES[subj]}</span>
                      <span
                        className="font-semibold"
                        style={{
                          color:
                            subjPct >= 70
                              ? "var(--color-correct)"
                              : subjPct >= 50
                                ? "var(--color-missed)"
                                : "var(--color-wrong)",
                        }}
                      >
                        {stats.correct}/{stats.total} ({subjPct}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${
                          subjPct >= 70
                            ? "bg-[var(--color-correct)]"
                            : subjPct >= 50
                              ? "bg-[var(--color-missed)]"
                              : "bg-[var(--color-wrong)]"
                        }`}
                        style={{ width: `${subjPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Question review */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Přehled otázek
              </p>
              <button
                onClick={() => setShowAllReview(!showAllReview)}
                className="text-xs text-violet-600 dark:text-violet-400 font-medium tap-highlight"
              >
                {showAllReview ? "Jen chybné" : "Zobrazit vše"}
              </button>
            </div>

            <div className="space-y-2">
              {displayed.map((s) => {
                const userAns = s.userAnswer;
                const correctLetters = s.question.correct;
                return (
                  <div
                    key={s.idx}
                    className={`bg-white dark:bg-[#1e293b] rounded-xl p-3 shadow-sm border ${
                      s.isCorrect
                        ? "border-[var(--color-correct)]/30"
                        : userAns.length > 0
                          ? "border-[var(--color-wrong)]/30"
                          : "border-gray-100 dark:border-gray-700"
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span
                        className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0 ${
                          s.isCorrect
                            ? "bg-[var(--color-correct)] text-white"
                            : userAns.length > 0
                              ? "bg-[var(--color-wrong)] text-white"
                              : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                        }`}
                      >
                        {s.idx + 1}
                      </span>
                      <p className="text-sm leading-snug flex-1">{s.question.text}</p>
                    </div>
                    <div className="pl-8 space-y-1">
                      {s.question.options.map((opt) => {
                        const isCorrect = correctLetters.includes(opt.letter);
                        const wasSelected = userAns.includes(opt.letter);
                        return (
                          <div
                            key={opt.letter}
                            className={`flex items-center gap-1.5 text-xs py-0.5 px-1.5 rounded ${
                              isCorrect
                                ? "bg-green-50 dark:bg-green-950/30 font-medium"
                                : wasSelected
                                  ? "bg-red-50 dark:bg-red-950/30"
                                  : ""
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded text-[10px] flex items-center justify-center font-semibold ${
                                isCorrect
                                  ? "bg-[var(--color-correct)] text-white"
                                  : wasSelected
                                    ? "bg-[var(--color-wrong)] text-white"
                                    : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                              }`}
                            >
                              {opt.letter}
                            </span>
                            <span>{opt.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2.5">
            <button
              onClick={() => {
                clearExam();
                setPhase("setup");
              }}
              className="w-full bg-violet-600 text-white font-semibold py-3.5 rounded-xl tap-highlight active:opacity-80 transition-opacity"
            >
              Nová simulace
            </button>
            <Link
              href={backHref}
              className="block w-full text-center text-gray-500 font-medium py-3.5 tap-highlight"
            >
              Zpět domů
            </Link>
          </div>
        </main>
      )}
    </>
  );
}
