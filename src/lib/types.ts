export interface Option {
  letter: string;
  text: string;
  image?: string;
}

export interface Question {
  id: number | string;
  text: string;
  image?: string;
  options: Option[];
  correct: string[];
}

export interface Subchapter {
  id: string;
  name: string;
  questions: Question[];
}

export interface Chapter {
  id: number;
  name: string;
  subtitle?: string;
  questions?: Question[];
  subchapters?: Subchapter[];
}

export interface SubjectData {
  subject: string;
  totalQuestions: number;
  chapters: Chapter[];
}

export interface ChapterProgress {
  answered: number;
  correct: number;
  wrongIds: (number | string)[];
  /** IDs of questions answered correctly. Missing on legacy records — always
   * read via a nullish coalescing to `[]`. */
  correctIds?: (number | string)[];
  /**
   * Last recorded time (seconds) per question in this chapter — overwritten
   * on every answer, so this is the "latest attempt" not a history. Missing
   * on records written before the timing feature.
   */
  questionTimes?: Record<string, number>;
  /** Duration (seconds) of the most recently completed/left-off quiz run of
   * this chapter. Overwrites previous value. */
  lastRunSeconds?: number;
}

export type SubjectProgress = Record<string, ChapterProgress>;
