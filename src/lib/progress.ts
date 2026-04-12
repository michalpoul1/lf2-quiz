import type { SubjectProgress, ChapterProgress } from "./types";

const STORAGE_KEY = "lf2-quiz-progress";

function getAll(): Record<string, SubjectProgress> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, SubjectProgress>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getSubjectProgress(subject: string): SubjectProgress {
  return getAll()[subject] || {};
}

export function getChapterProgress(
  subject: string,
  chapterId: number | string
): ChapterProgress {
  const sp = getSubjectProgress(subject);
  return sp[String(chapterId)] || { answered: 0, correct: 0, wrongIds: [] };
}

export function getTotalProgress(subject: string): {
  answered: number;
  correct: number;
} {
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
  isCorrect: boolean
) {
  const all = getAll();
  if (!all[subject]) all[subject] = {};
  const key = String(chapterId);
  if (!all[subject][key]) {
    all[subject][key] = { answered: 0, correct: 0, wrongIds: [] };
  }
  const ch = all[subject][key];
  ch.answered += 1;
  if (isCorrect) {
    ch.correct += 1;
    ch.wrongIds = ch.wrongIds.filter((id) => String(id) !== String(questionId));
  } else {
    if (!ch.wrongIds.some((id) => String(id) === String(questionId))) {
      ch.wrongIds.push(questionId);
    }
  }
  saveAll(all);
}

export function resetProgress(subject: string) {
  const all = getAll();
  delete all[subject];
  saveAll(all);
}
