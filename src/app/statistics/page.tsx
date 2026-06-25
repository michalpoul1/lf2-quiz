"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSubjectData, getChapterQuestions, countValidQuestions } from "@/lib/data";
import { getChapterProgress, getTotalProgress, resetProgress } from "@/lib/progress";
import { getTestHistory, getStreak, getTodayAnswered, clearTestHistory } from "@/lib/testHistory";
import { getActiveFaculties } from "@/config/faculties";
import type { ChapterProgress } from "@/lib/types";
import type { TestRecord } from "@/lib/testHistory";
import DonutChart from "@/components/DonutChart";

const SUBJECT_NAMES: Record<string, string> = {
  biology: "Biologie",
  chemistry: "Chemie",
  physics: "Fyzika",
};

const SUBJECT_ICONS: Record<string, string> = {
  biology: "🧬",
  chemistry: "⚗️",
  physics: "⚡",
};

function pctColor(pct: number): string {
  if (pct >= 75) return "var(--color-correct)";
  if (pct >= 50) return "var(--color-missed)";
  return "var(--color-wrong)";
}

function pctBgClass(pct: number): string {
  if (pct >= 75) return "bg-[var(--color-correct)]";
  if (pct >= 50) return "bg-[var(--color-missed)]";
  return "bg-[var(--color-wrong)]";
}

function pctTextClass(pct: number): string {
  if (pct >= 75) return "text-[var(--color-correct)]";
  if (pct >= 50) return "text-[var(--color-missed)]";
  return "text-[var(--color-wrong)]";
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s > 0 ? `${s}s` : ""}`.trim();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });
}

interface ChapterStat {
  id: number;
  name: string;
  facultyId: string;
  subject: string;
  totalQuestions: number;
  progress: ChapterProgress;
  pct: number;
}

interface SubjectStat {
  facultyId: string;
  subjectId: string;
  subjectName: string;
  icon: string;
  total: { answered: number; correct: number };
  totalQuestions: number;
  chapters: ChapterStat[];
}

function subjectName(key: string): string {
  return SUBJECT_NAMES[key] ?? key;
}

export default function StatisticsPage() {
  const router = useRouter();
  const [data, setData] = useState<Record<string, SubjectStat>>({});
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [testHistory, setTestHistory] = useState<TestRecord[]>([]);
  const [streak, setStreak] = useState(0);
  const [todayCount, setTodayCount] = useState(0);

  const activeFaculties = getActiveFaculties();
  const firstFacultyId = activeFaculties[0]?.id ?? "2lf";
  const showFacultyHeaders = activeFaculties.length > 1;

  const loadData = () => {
    const result: Record<string, SubjectStat> = {};
    for (const f of activeFaculties) {
      for (const s of f.subjects) {
        const key = `${f.id}:${s.id}`;
        const subjectData = getSubjectData(f.id, s.id);
        if (!subjectData) continue;
        const total = getTotalProgress(f.id, s.id);
        const totalQuestions = subjectData.chapters.reduce(
          (sum, ch) => sum + countValidQuestions(getChapterQuestions(f.id, s.id, ch.id)),
          0
        );
        const chapters: ChapterStat[] = subjectData.chapters.map((ch) => {
          const validCount = countValidQuestions(getChapterQuestions(f.id, s.id, ch.id));
          const cp = getChapterProgress(f.id, s.id, ch.id);
          let aggregated = { ...cp };
          if (ch.subchapters) {
            aggregated = { answered: 0, correct: 0, wrongIds: [] };
            for (const sub of ch.subchapters) {
              const scp = getChapterProgress(f.id, s.id, sub.id);
              aggregated.answered += scp.answered;
              aggregated.correct += scp.correct;
              aggregated.wrongIds = [...aggregated.wrongIds, ...scp.wrongIds];
            }
          }
          return {
            id: ch.id,
            name: ch.name,
            facultyId: f.id,
            subject: s.id,
            totalQuestions: validCount,
            progress: aggregated,
            pct: aggregated.answered > 0 ? Math.round((aggregated.correct / aggregated.answered) * 100) : -1,
          };
        });
        result[key] = {
          facultyId: f.id,
          subjectId: s.id,
          subjectName: s.name,
          icon: s.icon || SUBJECT_ICONS[s.id] || "📘",
          total,
          totalQuestions,
          chapters,
        };
      }
    }
    setData(result);
    setTestHistory(getTestHistory().slice(0, 10));
    setStreak(getStreak());
    setTodayCount(getTodayAnswered());
    setLoaded(true);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aggregate totals across all subjects
  const globalAnswered = Object.values(data).reduce((s, d) => s + d.total.answered, 0);
  const globalCorrect = Object.values(data).reduce((s, d) => s + d.total.correct, 0);
  const globalTotal = Object.values(data).reduce((s, d) => s + d.totalQuestions, 0);
  const globalPct = globalAnswered > 0 ? Math.round((globalCorrect / globalAnswered) * 100) : -1;

  // Strengths & weaknesses — all chapters with ≥5 answered
  const allChapters: ChapterStat[] = Object.values(data).flatMap((d) => d.chapters);
  const qualified = allChapters.filter((ch) => ch.progress.answered >= 5 && ch.pct >= 0);
  const sorted = [...qualified].sort((a, b) => b.pct - a.pct);
  const strongest = sorted.slice(0, 3);
  const weakest = [...qualified].sort((a, b) => a.pct - b.pct).slice(0, 3);

  const handleResetSubject = (compositeKey: string) => {
    const stat = data[compositeKey];
    if (stat) resetProgress(stat.facultyId, stat.subjectId);
    setConfirmReset(null);
    loadData();
  };

  const handleResetAll = () => {
    for (const f of activeFaculties) {
      for (const s of f.subjects) {
        resetProgress(f.id, s.id);
      }
    }
    clearTestHistory();
    setConfirmResetAll(false);
    loadData();
  };

  if (!loaded) {
    return (
      <main className="pt-6 pb-24 fade-in">
        <h1 className="text-2xl font-bold text-[var(--color-primary)] dark:text-blue-400 mb-5">Statistiky</h1>
        <p className="text-gray-500">Načítání...</p>
      </main>
    );
  }

  return (
    <main className="pt-6 pb-24 fade-in space-y-5">
      <h1 className="text-2xl font-bold text-[var(--color-primary)] dark:text-blue-400">Statistiky</h1>

      {/* ===== SECTION 1: Hero summary card ===== */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-4 mb-4">
          <DonutChart percentage={globalPct} size={80} strokeWidth={6} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-500 dark:text-gray-400">Celková úspěšnost</p>
            <p className={`text-3xl font-bold ${globalPct >= 0 ? pctTextClass(globalPct) : "text-gray-400"}`}>
              {globalPct >= 0 ? `${globalPct}%` : "—"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 dark:bg-[#0f172a] rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-[var(--color-primary)] dark:text-blue-400">{globalAnswered}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">zodpovězeno<br />z {globalTotal}</p>
          </div>
          <div className="bg-gray-50 dark:bg-[#0f172a] rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-amber-500">🔥 {streak}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">dní<br />v řadě</p>
          </div>
          <div className="bg-gray-50 dark:bg-[#0f172a] rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-emerald-500">{todayCount}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">dnes<br />otázek</p>
          </div>
        </div>
      </div>

      {/* ===== SECTION 2: Test history ===== */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-base font-semibold mb-3">📊 Historie testů</h2>
        {testHistory.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Zatím žádné testy. Zkuste{" "}
            <button onClick={() => router.push("/quick-test")} className="text-[var(--color-primary)] dark:text-blue-400 underline">
              Rychlý test
            </button>{" "}
            nebo{" "}
            <button onClick={() => router.push("/exam-simulation")} className="text-[var(--color-primary)] dark:text-blue-400 underline">
              Simulaci přijímaček
            </button>
            !
          </p>
        ) : (
          <div className="space-y-2">
            {testHistory.map((t, i) => {
              const pct = Math.round((t.correctAnswers / t.totalQuestions) * 100);
              const prev = testHistory[i + 1];
              const prevPct = prev ? Math.round((prev.correctAnswers / prev.totalQuestions) * 100) : null;
              const trend = prevPct !== null ? pct - prevPct : null;

              return (
                <div key={t.id} className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                  <div className="flex-shrink-0 w-10 text-center">
                    <span className="text-xs font-medium text-gray-400">{formatDate(t.date)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
                        {t.type === "quick" ? "Rychlý" : "Simulace"}
                      </span>
                      <span className="text-xs text-gray-400 truncate">
                        {t.subjects.map((s) => subjectName(s)).join(", ")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-sm font-bold ${pctTextClass(pct)}`}>
                      {pct}%
                    </span>
                    {trend !== null && trend !== 0 && (
                      <span className={`text-xs font-medium ${trend > 0 ? "text-[var(--color-correct)]" : "text-[var(--color-wrong)]"}`}>
                        {trend > 0 ? "↑" : "↓"}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{formatTime(t.timeSeconds)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== SECTION 3: Subject cards (expandable), grouped by faculty when >1 active ===== */}
      <div className="space-y-5">
        {activeFaculties.map((f) => (
          <div key={f.id} className="space-y-3">
            {showFacultyHeaders && (
              <h2 className="text-base font-semibold text-gray-600 dark:text-gray-300 px-1">{f.name}</h2>
            )}
            {f.subjects.map((s) => {
              const key = `${f.id}:${s.id}`;
              const d = data[key];
              if (!d) return null;
              const totalPct = d.total.answered > 0 ? Math.round((d.total.correct / d.total.answered) * 100) : -1;
              const isExpanded = expanded === key;

              return (
                <div key={key} className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <button
                    onClick={() => setExpanded(isExpanded ? null : key)}
                    className="w-full flex items-center gap-3 p-4 tap-highlight"
                  >
                    <span className="text-2xl flex-shrink-0">{d.icon}</span>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-semibold text-sm">{d.subjectName}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {d.total.answered}/{d.totalQuestions} otázek zodpovězeno
                      </p>
                    </div>
                    <DonutChart percentage={totalPct} size={48} strokeWidth={4} />
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-50 dark:border-gray-700/50">
                      <div className="space-y-1 mt-3">
                        {d.chapters.map((ch) => {
                          const barWidth = ch.progress.answered > 0
                            ? Math.min(100, Math.round((ch.progress.correct / ch.totalQuestions) * 100))
                            : 0;
                          return (
                            <button
                              key={ch.id}
                              onClick={() => router.push(`/${s.id}/quiz?chapter=${ch.id}`)}
                              className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 tap-highlight transition-colors"
                            >
                              <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{ch.id}.</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-sm truncate text-left">{ch.name}</span>
                                  {ch.pct >= 0 && (
                                    <span className={`text-xs font-semibold flex-shrink-0 ${pctTextClass(ch.pct)}`}>
                                      {ch.pct}%
                                    </span>
                                  )}
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                                  {ch.progress.answered > 0 && (
                                    <div
                                      className={`h-1.5 rounded-full transition-all duration-500 ${pctBgClass(ch.pct)}`}
                                      style={{ width: `${barWidth}%` }}
                                    />
                                  )}
                                </div>
                              </div>
                              <span className="text-xs text-gray-400 flex-shrink-0 w-14 text-right">
                                {ch.progress.answered > 0
                                  ? `${ch.progress.correct}/${ch.progress.answered}`
                                  : "—"}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {d.total.answered > 0 && (
                        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                          {confirmReset === key ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleResetSubject(key)}
                                className="flex-1 bg-[var(--color-wrong)] text-white text-sm font-medium py-2.5 rounded-lg tap-highlight"
                              >
                                Opravdu resetovat?
                              </button>
                              <button
                                onClick={() => setConfirmReset(null)}
                                className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium py-2.5 rounded-lg tap-highlight"
                              >
                                Zrušit
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmReset(key)}
                              className="w-full text-sm text-gray-400 dark:text-gray-500 font-medium py-2 tap-highlight hover:text-[var(--color-wrong)] transition-colors"
                            >
                              Resetovat {d.subjectName}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ===== SECTION 4: Strengths & Weaknesses ===== */}
      {qualified.length >= 1 && (
        <div className="space-y-4">
          {strongest.length > 0 && (
            <div>
              <h2 className="text-base font-semibold mb-2">💪 Nejsilnější kapitoly</h2>
              <div className="space-y-2">
                {strongest.map((ch) => (
                  <div
                    key={`${ch.facultyId}-${ch.subject}-${ch.id}`}
                    className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl px-4 py-3 border border-emerald-100 dark:border-emerald-900/50"
                  >
                    <span className="text-[var(--color-correct)] font-bold text-lg flex-shrink-0">{ch.pct}%</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ch.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{subjectName(ch.subject)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {weakest.length > 0 && (
            <div>
              <h2 className="text-base font-semibold mb-2">📌 Ke zlepšení</h2>
              <div className="space-y-2">
                {weakest.map((ch) => (
                  <div
                    key={`${ch.facultyId}-${ch.subject}-${ch.id}`}
                    className="flex items-center gap-3 bg-red-50 dark:bg-red-950/30 rounded-xl px-4 py-3 border border-red-100 dark:border-red-900/50"
                  >
                    <span className="text-[var(--color-wrong)] font-bold text-lg flex-shrink-0">{ch.pct}%</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ch.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{subjectName(ch.subject)}</p>
                    </div>
                    <button
                      onClick={() => router.push(`/${ch.subject}/quiz?chapter=${ch.id}`)}
                      className="text-xs font-medium text-[var(--color-wrong)] bg-red-100 dark:bg-red-900/40 px-3 py-1.5 rounded-lg tap-highlight flex-shrink-0"
                    >
                      Procvičovat
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {qualified.length === 0 && globalAnswered > 0 && (
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
          <p className="text-sm text-gray-400">
            Zodpovězte alespoň 5 otázek v kapitole pro analýzu silných a slabých stránek.
          </p>
        </div>
      )}

      {/* ===== SECTION 5: Reset all ===== */}
      <div className="pt-2">
        {confirmResetAll ? (
          <div className="bg-red-50 dark:bg-red-950/30 rounded-2xl p-5 border border-red-200 dark:border-red-900/50 space-y-3">
            <p className="text-sm font-medium text-[var(--color-wrong)]">
              Opravdu chcete smazat veškerý progress a historii testů?
            </p>
            <p className="text-xs text-gray-500">Tato akce je nevratná.</p>
            <div className="flex gap-2">
              <button
                onClick={handleResetAll}
                className="flex-1 bg-[var(--color-wrong)] text-white text-sm font-medium py-2.5 rounded-lg tap-highlight"
              >
                Ano, resetovat vše
              </button>
              <button
                onClick={() => setConfirmResetAll(false)}
                className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium py-2.5 rounded-lg tap-highlight"
              >
                Zrušit
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmResetAll(true)}
            className="w-full bg-white dark:bg-[#1e293b] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-sm text-[var(--color-wrong)] font-medium tap-highlight hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
          >
            Resetovat veškerý progress
          </button>
        )}
      </div>
    </main>
  );
}
