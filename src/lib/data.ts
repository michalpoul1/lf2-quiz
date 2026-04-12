import biologyData from "../../data/biology.json";
import physicsData from "../../data/physics.json";
import chemistryData from "../../data/chemistry.json";
import type { SubjectData, Question } from "./types";

const subjectMap: Record<string, SubjectData> = {
  biology: biologyData as unknown as SubjectData,
  physics: physicsData as unknown as SubjectData,
  chemistry: chemistryData as unknown as SubjectData,
};

export function getSubjectData(subject: string): SubjectData {
  return subjectMap[subject];
}

export function getBiologyData(): SubjectData {
  return subjectMap.biology;
}

/** Get all questions for a chapter (flat), handling both questions[] and subchapters[]. */
export function getChapterQuestions(
  subject: string,
  chapterId: number | "all"
): Question[] {
  const data = getSubjectData(subject);
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
