import biologyData2lf from "../../data/2lf/biology.json";
import physicsData2lf from "../../data/2lf/physics.json";
import chemistryData2lf from "../../data/2lf/chemistry.json";
import explanationsBiology2lf from "../../data/2lf/explanations-biology.json";
import explanationsChemistry2lf from "../../data/2lf/explanations-chemistry.json";
import explanationsPhysics2lf from "../../data/2lf/explanations-physics.json";
import { getSubjectProgress } from "./progress";
import type { SubjectData, Question } from "./types";

// Internal namespace — kept under "2lf" so localStorage shape (which is
// also keyed by facultyId) continues to work for existing users. Don't
// flatten without a migration.
const FACULTY = "2lf";

const subjectMap: Record<string, SubjectData> = {
  [`${FACULTY}:biology`]: biologyData2lf as unknown as SubjectData,
  [`${FACULTY}:chemistry`]: chemistryData2lf as unknown as SubjectData,
  [`${FACULTY}:physics`]: physicsData2lf as unknown as SubjectData,
};

const explanationsMap: Record<string, Record<string, string>> = {
  [`${FACULTY}:biology`]: explanationsBiology2lf as Record<string, string>,
  [`${FACULTY}:chemistry`]: explanationsChemistry2lf as Record<string, string>,
  [`${FACULTY}:physics`]: explanationsPhysics2lf as Record<string, string>,
};

function key(subject: string): string {
  return `${FACULTY}:${subject}`;
}

export function getExplanation(
  subject: string,
  questionId: number | string
): string | null {
  const map = explanationsMap[key(subject)];
  if (!map) return null;
  return map[String(questionId)] || null;
}

export function getSubjectData(subject: string): SubjectData | undefined {
  return subjectMap[key(subject)];
}

/** Get all questions for a chapter (flat), handling both questions[] and subchapters[]. */
export function getChapterQuestions(
  subject: string,
  chapterId: number | "all"
): Question[] {
  const data = getSubjectData(subject);
  if (!data) return [];
  if (chapterId === "all") {
    return data.chapters.flatMap((ch) => getAllQuestionsFromChapter(ch));
  }
  const chapter = data.chapters.find((ch) => ch.id === chapterId);
  return chapter ? getAllQuestionsFromChapter(chapter) : [];
}

/** Get questions from a specific subchapter. */
export function getSubchapterQuestions(
  subject: string,
  chapterId: number,
  subchapterId: string
): Question[] {
  const data = getSubjectData(subject);
  if (!data) return [];
  const chapter = data.chapters.find((ch) => ch.id === chapterId);
  if (!chapter?.subchapters) return [];
  const sub = chapter.subchapters.find((s) => s.id === subchapterId);
  return sub ? sub.questions : [];
}

/** Extract all questions from a chapter, regardless of structure. */
function getAllQuestionsFromChapter(
  ch: { questions?: Question[]; subchapters?: { questions: Question[] }[] }
): Question[] {
  if (ch.questions) return ch.questions;
  if (ch.subchapters) return ch.subchapters.flatMap((s) => s.questions);
  return [];
}

export function countValidQuestions(questions: Question[]): number {
  return questions.filter((q) => q.correct.length > 0).length;
}

export function filterValidQuestions(questions: Question[]): Question[] {
  return questions.filter((q) => q.correct.length > 0);
}

/** A question paired with the actual progress key it should be recorded
 *  under (sub.id for subchapters, String(ch.id) for flat chapters). Used
 *  everywhere we need the REAL chapter/subchapter, not the first-match
 *  guess that findProgressKey would give. */
export interface QuestionWithKey {
  question: Question;
  chapterKey: string;
}

function collectWithKeys(
  ch: { id: number; questions?: Question[]; subchapters?: { id: string; questions: Question[] }[] }
): QuestionWithKey[] {
  const out: QuestionWithKey[] = [];
  if (ch.subchapters && ch.subchapters.length > 0) {
    for (const sub of ch.subchapters) {
      for (const q of sub.questions) {
        if (q.correct.length > 0) out.push({ question: q, chapterKey: sub.id });
      }
    }
  } else if (ch.questions) {
    const key = String(ch.id);
    for (const q of ch.questions) {
      if (q.correct.length > 0) out.push({ question: q, chapterKey: key });
    }
  }
  return out;
}

/** Flat questions for a chapter (or "all" chapters) with each item paired
 *  to its real progress key. filterValidQuestions is applied inline. */
export function getChapterQuestionsWithKeys(
  subject: string,
  chapterId: number | "all"
): QuestionWithKey[] {
  const data = getSubjectData(subject);
  if (!data) return [];
  if (chapterId === "all") return data.chapters.flatMap(collectWithKeys);
  const chapter = data.chapters.find((ch) => ch.id === chapterId);
  return chapter ? collectWithKeys(chapter) : [];
}

/** Questions from a specific subchapter, each paired with its (sub.id) key. */
export function getSubchapterQuestionsWithKeys(
  subject: string,
  chapterId: number,
  subchapterId: string
): QuestionWithKey[] {
  const data = getSubjectData(subject);
  if (!data) return [];
  const chapter = data.chapters.find((ch) => ch.id === chapterId);
  if (!chapter?.subchapters) return [];
  const sub = chapter.subchapters.find((s) => s.id === subchapterId);
  if (!sub) return [];
  return sub.questions
    .filter((q) => q.correct.length > 0)
    .map((q) => ({ question: q, chapterKey: sub.id }));
}

/** Look up the real progress key for a specific question instance in data.
 *  Returns null if the exact question (by object identity OR by the
 *  (chapter, subchapter, id) triple) isn't in the data for `subject`. */
export function lookupChapterKey(
  subject: string,
  chapterId: number,
  subchapterId: string | undefined,
  questionId: number | string
): string | null {
  const data = getSubjectData(subject);
  if (!data) return null;
  const chapter = data.chapters.find((ch) => ch.id === chapterId);
  if (!chapter) return null;
  if (subchapterId && chapter.subchapters) {
    const sub = chapter.subchapters.find((s) => s.id === subchapterId);
    if (sub?.questions.some((q) => String(q.id) === String(questionId))) {
      return sub.id;
    }
    return null;
  }
  if (chapter.questions?.some((q) => String(q.id) === String(questionId))) {
    return String(chapter.id);
  }
  return null;
}

/**
 * Single source of truth for "wrong questions" in a subject. Dedupes IDs
 * across all progress keys (Set-union), then intersects with valid questions
 * present in current data. Used by the wrong-count badge on the subject page,
 * the "Moje chyby" list, and the "Procvičit všechny chybné" quiz — all three
 * must show the same number.
 */
export function getWrongQuestions(subject: string): Question[] {
  const data = getSubjectData(subject);
  if (!data) return [];
  const progress = getSubjectProgress(subject);
  const wrongSet = new Set<string>();
  for (const cp of Object.values(progress)) {
    (cp?.wrongIds ?? []).forEach((id) => wrongSet.add(String(id)));
  }
  const all = filterValidQuestions(getChapterQuestions(subject, "all"));
  return all.filter((q) => wrongSet.has(String(q.id)));
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
