import type { SubjectProgress, ChapterProgress } from "./types";

const STORAGE_KEY = "lf2-quiz-progress";
const LEGACY_SUBJECT_KEYS = new Set(["biology", "chemistry", "physics"]);

// Storage shape stays nested under the 2lf namespace so existing users keep
// their progress. Don't flatten without a migration.
const FACULTY = "2lf";

type FacultyProgress = Record<string, SubjectProgress>;
type AllProgress = Record<string, FacultyProgress>;

let migrationDone = false;

function migrateIfNeeded(raw: unknown): AllProgress {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  // Detect legacy shape: top-level keys are subject names.
  const topKeys = Object.keys(obj);
  const looksLegacy = topKeys.some((k) => LEGACY_SUBJECT_KEYS.has(k));
  if (!looksLegacy) return obj as AllProgress;
  // Move top-level subject entries under the 2lf bucket.
  const migrated: AllProgress = {};
  const legacyFacultyBucket: FacultyProgress = {};
  for (const [k, v] of Object.entries(obj)) {
    if (LEGACY_SUBJECT_KEYS.has(k)) {
      legacyFacultyBucket[k] = v as SubjectProgress;
    } else {
      // Preserve any non-subject top-level entries that might already be faculty-keyed.
      migrated[k] = v as FacultyProgress;
    }
  }
  if (Object.keys(legacyFacultyBucket).length > 0) {
    migrated[FACULTY] = {
      ...(migrated[FACULTY] || {}),
      ...legacyFacultyBucket,
    };
  }
  return migrated;
}

function getAll(): AllProgress {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!migrationDone) {
      const migrated = migrateIfNeeded(parsed);
      migrationDone = true;
      // Persist migration if it changed shape.
      if (JSON.stringify(migrated) !== JSON.stringify(parsed)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      }
      return migrated;
    }
    return parsed;
  } catch {
    return {};
  }
}

function saveAll(data: AllProgress) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getSubjectProgress(subject: string): SubjectProgress {
  const all = getAll();
  return all[FACULTY]?.[subject] || {};
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
  isCorrect: boolean
) {
  const all = getAll();
  if (!all[FACULTY]) all[FACULTY] = {};
  const fp = all[FACULTY];
  if (!fp[subject]) fp[subject] = {};
  const key = String(chapterId);
  if (!fp[subject][key]) {
    fp[subject][key] = { answered: 0, correct: 0, wrongIds: [] };
  }
  const ch = fp[subject][key];
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
  if (all[FACULTY]) {
    delete all[FACULTY][subject];
    if (Object.keys(all[FACULTY]).length === 0) delete all[FACULTY];
  }
  saveAll(all);
}

export function resetAllProgress() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
