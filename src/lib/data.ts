import biologyData2lf from "../../data/2lf/biology.json";
import physicsData2lf from "../../data/2lf/physics.json";
import chemistryData2lf from "../../data/2lf/chemistry.json";
import explanationsBiology2lf from "../../data/2lf/explanations-biology.json";
import explanationsChemistry2lf from "../../data/2lf/explanations-chemistry.json";
import explanationsPhysics2lf from "../../data/2lf/explanations-physics.json";
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

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
