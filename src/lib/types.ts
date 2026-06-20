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
}

export type SubjectProgress = Record<string, ChapterProgress>;
