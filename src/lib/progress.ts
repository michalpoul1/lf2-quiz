import type { SubjectProgress, ChapterProgress } from "./types";
import { bumpTodayCount } from "./streak";
import {
  FACULTY_KEY,
  getStoreState,
  hydrateFromLocalOnce,
  mutate,
} from "./progressStore";

/**
 * Read/write facade over the progress store. All functions stay synchronous
 * so the existing callsites (ChapterList, QuizRunner, statistics, …) didn't
 * have to change. Under the hood the store persists to either localStorage
 * (logged out) or Supabase (logged in) via a debounced flush.
 */

function ensureHydrated() {
  hydrateFromLocalOnce();
}

export function getSubjectProgress(subject: string): SubjectProgress {
  ensureHydrated();
  const all = getStoreState().data;
  return all[FACULTY_KEY]?.[subject] || {};
}

export function getChapterProgress(
  subject: string,
  chapterId: number | string
): ChapterProgress {
  const sp = getSubjectProgress(subject);
  return sp[String(chapterId)] || { answered: 0, correct: 0, wrongIds: [] };
}

export function getTotalProgress(
  subject: string
): { answered: number; correct: number } {
  const sp = getSubjectProgress(subject);
  let answered = 0;
  let correct = 0;
  for (const ch of Object.values(sp)) {
    answered += ch.answered;
    correct += ch.correct;
  }
  return { answered, correct };
}

export function recordAnswer(
  subject: string,
  chapterId: number | string,
  questionId: number | string,
  isCorrect: boolean,
  /** Optional: seconds spent on this question before clicking Check.
   *  Overwrites any previous time for this question. */
  timeSeconds?: number
) {
  ensureHydrated();
  mutate((all) => {
    if (!all[FACULTY_KEY]) all[FACULTY_KEY] = {};
    const fp = all[FACULTY_KEY];
    if (!fp[subject]) fp[subject] = {};
    const key = String(chapterId);
    if (!fp[subject][key]) {
      fp[subject][key] = { answered: 0, correct: 0, wrongIds: [], correctIds: [] };
    }
    const ch = fp[subject][key];
    if (!ch.correctIds) ch.correctIds = [];
    ch.answered += 1;
    const qidStr = String(questionId);
    if (isCorrect) {
      ch.correct += 1;
      ch.wrongIds = ch.wrongIds.filter((id) => String(id) !== qidStr);
      if (!ch.correctIds.some((id) => String(id) === qidStr)) {
        ch.correctIds.push(questionId);
      }
    } else {
      ch.correctIds = ch.correctIds.filter((id) => String(id) !== qidStr);
      if (!ch.wrongIds.some((id) => String(id) === qidStr)) {
        ch.wrongIds.push(questionId);
      }
    }
    if (typeof timeSeconds === "number" && Number.isFinite(timeSeconds) && timeSeconds >= 0) {
      if (!ch.questionTimes) ch.questionTimes = {};
      ch.questionTimes[qidStr] = Math.round(timeSeconds);
    }
  });
  bumpTodayCount();
}

/**
 * Record the duration of the just-finished run of a chapter. Overwrites any
 * previous value (we don't keep history). Called from the quiz results
 * screen (or on partial-run exit).
 */
export function recordChapterRunTime(
  subject: string,
  chapterId: number | string,
  seconds: number
): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  ensureHydrated();
  mutate((all) => {
    if (!all[FACULTY_KEY]) all[FACULTY_KEY] = {};
    const fp = all[FACULTY_KEY];
    if (!fp[subject]) fp[subject] = {};
    const key = String(chapterId);
    if (!fp[subject][key]) {
      fp[subject][key] = { answered: 0, correct: 0, wrongIds: [], correctIds: [] };
    }
    fp[subject][key].lastRunSeconds = Math.round(seconds);
  });
}

/** Read the last recorded time (seconds) for a specific question, or null
 *  if none. */
export function getQuestionTime(
  subject: string,
  chapterId: number | string,
  questionId: number | string
): number | null {
  const cp = getChapterProgress(subject, chapterId);
  const t = cp.questionTimes?.[String(questionId)];
  return typeof t === "number" ? t : null;
}

/** Read the last completed-run time (seconds) for a chapter, or null if none. */
export function getLastRunTime(
  subject: string,
  chapterId: number | string
): number | null {
  const cp = getChapterProgress(subject, chapterId);
  return typeof cp.lastRunSeconds === "number" ? cp.lastRunSeconds : null;
}

export function getQuestionStatus(
  subject: string,
  chapterId: number | string,
  questionId: number | string
): "correct" | "wrong" | "unanswered" {
  const cp = getChapterProgress(subject, chapterId);
  const qidStr = String(questionId);
  if ((cp.correctIds ?? []).some((id) => String(id) === qidStr)) return "correct";
  if (cp.wrongIds.some((id) => String(id) === qidStr)) return "wrong";
  return "unanswered";
}

export function removeFromWrong(
  subject: string,
  chapterId: number | string,
  questionId: number | string
): void {
  ensureHydrated();
  mutate((all) => {
    const fp = all[FACULTY_KEY];
    if (!fp) return;
    const sp = fp[subject];
    if (!sp) return;
    const cp = sp[String(chapterId)];
    if (!cp) return;
    const qidStr = String(questionId);
    cp.wrongIds = cp.wrongIds.filter((id) => String(id) !== qidStr);
  });
}

export function resetProgress(subject: string) {
  ensureHydrated();
  mutate((all) => {
    if (all[FACULTY_KEY]) {
      delete all[FACULTY_KEY][subject];
      if (Object.keys(all[FACULTY_KEY]).length === 0) delete all[FACULTY_KEY];
    }
  });
}

export function resetAllProgress() {
  ensureHydrated();
  mutate((all) => {
    for (const k of Object.keys(all)) delete all[k];
  });
}
