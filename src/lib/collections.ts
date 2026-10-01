/**
 * Collections-based bookmark system — public API is unchanged, but reads
 * and writes now go through the in-memory collectionsStore (which flushes
 * to localStorage when logged out, Supabase when logged in).
 */

import {
  collectionsStore,
  type Collection,
  type CollectionQuestion,
  type CollectionsData,
} from "./collectionsStore";

const OLD_BOOKMARKS_KEY = "lf2-quiz-bookmarks";
const FACULTY = "2lf";

export type { Collection, CollectionQuestion };

export const COLLECTION_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#ef4444",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
  "#06b6d4",
];

function ensureHydrated() {
  collectionsStore.hydrateFromLocalOnce();
  migrateOldBookmarks();
}

function readData(): CollectionsData {
  ensureHydrated();
  return collectionsStore.getState().data;
}

function genId(): string {
  return `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function sameQuestion(a: CollectionQuestion, b: CollectionQuestion): boolean {
  return (
    a.facultyId === b.facultyId &&
    a.subject === b.subject &&
    String(a.questionId) === String(b.questionId)
  );
}

export function getCollections(): Collection[] {
  return readData().collections;
}

export function getCollection(id: string): Collection | undefined {
  return getCollections().find((c) => c.id === id);
}

export function createCollection(name: string, color: string): Collection {
  ensureHydrated();
  const collection: Collection = {
    id: genId(),
    name: name.trim() || "Bez názvu",
    color,
    createdAt: new Date().toISOString(),
    questions: [],
  };
  collectionsStore.mutate((d) => {
    d.collections.push(collection);
  });
  return collection;
}

export function renameCollection(id: string, name: string): void {
  ensureHydrated();
  collectionsStore.mutate((d) => {
    const c = d.collections.find((c) => c.id === id);
    if (!c) return;
    c.name = name.trim() || c.name;
  });
}

export function setCollectionColor(id: string, color: string): void {
  ensureHydrated();
  collectionsStore.mutate((d) => {
    const c = d.collections.find((c) => c.id === id);
    if (!c) return;
    c.color = color;
  });
}

export function deleteCollection(id: string): void {
  ensureHydrated();
  collectionsStore.mutate((d) => {
    d.collections = d.collections.filter((c) => c.id !== id);
  });
}

export function pinCollection(id: string): void {
  ensureHydrated();
  collectionsStore.mutate((d) => {
    const c = d.collections.find((c) => c.id === id);
    if (!c) return;
    c.pinned = true;
    c.pinnedAt = new Date().toISOString();
  });
}

export function unpinCollection(id: string): void {
  ensureHydrated();
  collectionsStore.mutate((d) => {
    const c = d.collections.find((c) => c.id === id);
    if (!c) return;
    c.pinned = false;
    c.pinnedAt = undefined;
  });
}

export function setQuestionCollections(
  subject: string,
  questionId: number | string,
  targetCollectionIds: string[]
): void {
  ensureHydrated();
  const target = new Set(targetCollectionIds);
  const q: CollectionQuestion = { facultyId: FACULTY, subject, questionId };
  collectionsStore.mutate((d) => {
    for (const c of d.collections) {
      const has = c.questions.some((cq) => sameQuestion(cq, q));
      if (target.has(c.id) && !has) {
        c.questions.push(q);
      } else if (!target.has(c.id) && has) {
        c.questions = c.questions.filter((cq) => !sameQuestion(cq, q));
      }
    }
  });
}

export function removeQuestionFromCollection(
  collectionId: string,
  subject: string,
  questionId: number | string
): void {
  ensureHydrated();
  collectionsStore.mutate((d) => {
    const c = d.collections.find((c) => c.id === collectionId);
    if (!c) return;
    c.questions = c.questions.filter(
      (cq) => !sameQuestion(cq, { facultyId: FACULTY, subject, questionId })
    );
  });
}

export function getCollectionsContaining(
  subject: string,
  questionId: number | string
): string[] {
  const data = readData();
  const q: CollectionQuestion = { facultyId: FACULTY, subject, questionId };
  return data.collections
    .filter((c) => c.questions.some((cq) => sameQuestion(cq, q)))
    .map((c) => c.id);
}

export function isQuestionSaved(
  subject: string,
  questionId: number | string
): boolean {
  return getCollectionsContaining(subject, questionId).length > 0;
}

export function getAllSavedQuestions(): CollectionQuestion[] {
  const seen = new Set<string>();
  const result: CollectionQuestion[] = [];
  for (const c of readData().collections) {
    for (const q of c.questions) {
      const key = `${q.facultyId}::${q.subject}::${q.questionId}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(q);
      }
    }
  }
  return result;
}

// ─── Legacy bookmarks migration ──────────────────────────────────────────

let legacyMigrationDone = false;

function migrateOldBookmarks(): void {
  if (typeof window === "undefined" || legacyMigrationDone) return;
  legacyMigrationDone = true;
  try {
    const oldRaw = localStorage.getItem(OLD_BOOKMARKS_KEY);
    if (!oldRaw) return;
    const oldData = JSON.parse(oldRaw) as Record<string, (number | string)[]>;
    const flat: CollectionQuestion[] = [];
    for (const [subject, ids] of Object.entries(oldData || {})) {
      if (!Array.isArray(ids)) continue;
      for (const id of ids)
        flat.push({ facultyId: FACULTY, subject, questionId: id });
    }
    if (flat.length === 0) {
      localStorage.removeItem(OLD_BOOKMARKS_KEY);
      return;
    }
    const collection: Collection = {
      id: genId(),
      name: "Neuřazené",
      color: COLLECTION_COLORS[6],
      createdAt: new Date().toISOString(),
      questions: flat,
    };
    collectionsStore.mutate((d) => {
      d.collections.unshift(collection);
    });
    localStorage.removeItem(OLD_BOOKMARKS_KEY);
  } catch {
    /* ignore migration errors */
  }
}
