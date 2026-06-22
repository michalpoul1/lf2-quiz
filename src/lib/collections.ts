/**
 * Collections-based bookmark system.
 *
 * Replaces the old "lf2-quiz-bookmarks" flat list with named, colored
 * collections. On first read, any old bookmarks are migrated into a
 * collection named "Neuřazené". Entries are tagged with facultyId;
 * legacy entries without one are migrated to "2lf".
 */

const STORAGE_KEY = "lf2-quiz-collections";
const OLD_BOOKMARKS_KEY = "lf2-quiz-bookmarks";
const DEFAULT_FACULTY = "2lf";

export interface CollectionQuestion {
  facultyId: string;
  subject: string;
  questionId: number | string;
}

export interface Collection {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  questions: CollectionQuestion[];
  pinned?: boolean;
  pinnedAt?: string;
}

interface CollectionsData {
  collections: Collection[];
}

export const COLLECTION_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#ef4444", // red
  "#f59e0b", // orange
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#6b7280", // gray
  "#06b6d4", // teal
];

function emptyData(): CollectionsData {
  return { collections: [] };
}

let facultyMigrationDone = false;

function normalizeFacultyIds(data: CollectionsData): {
  data: CollectionsData;
  changed: boolean;
} {
  let changed = false;
  for (const c of data.collections) {
    for (const q of c.questions) {
      if (!q.facultyId) {
        q.facultyId = DEFAULT_FACULTY;
        changed = true;
      }
    }
  }
  return { data, changed };
}

function readRaw(): CollectionsData {
  if (typeof window === "undefined") return emptyData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.collections)) return emptyData();
    const data = parsed as CollectionsData;
    if (!facultyMigrationDone) {
      const { changed } = normalizeFacultyIds(data);
      facultyMigrationDone = true;
      if (changed) writeRaw(data);
    }
    return data;
  } catch {
    return emptyData();
  }
}

function writeRaw(data: CollectionsData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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

/**
 * Read all collections, running migration from old bookmarks key if needed.
 */
export function getCollections(): Collection[] {
  if (typeof window === "undefined") return [];
  migrateOldBookmarks();
  return readRaw().collections;
}

export function getCollection(id: string): Collection | undefined {
  return getCollections().find((c) => c.id === id);
}

export function createCollection(name: string, color: string): Collection {
  const data = readRaw();
  const collection: Collection = {
    id: genId(),
    name: name.trim() || "Bez názvu",
    color,
    createdAt: new Date().toISOString(),
    questions: [],
  };
  data.collections.push(collection);
  writeRaw(data);
  return collection;
}

export function renameCollection(id: string, name: string): void {
  const data = readRaw();
  const c = data.collections.find((c) => c.id === id);
  if (!c) return;
  c.name = name.trim() || c.name;
  writeRaw(data);
}

export function setCollectionColor(id: string, color: string): void {
  const data = readRaw();
  const c = data.collections.find((c) => c.id === id);
  if (!c) return;
  c.color = color;
  writeRaw(data);
}

export function deleteCollection(id: string): void {
  const data = readRaw();
  data.collections = data.collections.filter((c) => c.id !== id);
  writeRaw(data);
}

export function pinCollection(id: string): void {
  const data = readRaw();
  const c = data.collections.find((c) => c.id === id);
  if (!c) return;
  c.pinned = true;
  c.pinnedAt = new Date().toISOString();
  writeRaw(data);
}

export function unpinCollection(id: string): void {
  const data = readRaw();
  const c = data.collections.find((c) => c.id === id);
  if (!c) return;
  c.pinned = false;
  c.pinnedAt = undefined;
  writeRaw(data);
}

/**
 * Set the membership of a question across all collections at once.
 * `targetCollectionIds` is the desired full set the question should be in.
 */
export function setQuestionCollections(
  facultyId: string,
  subject: string,
  questionId: number | string,
  targetCollectionIds: string[]
): void {
  const data = readRaw();
  const target = new Set(targetCollectionIds);
  const q: CollectionQuestion = { facultyId, subject, questionId };
  for (const c of data.collections) {
    const has = c.questions.some((cq) => sameQuestion(cq, q));
    if (target.has(c.id) && !has) {
      c.questions.push(q);
    } else if (!target.has(c.id) && has) {
      c.questions = c.questions.filter((cq) => !sameQuestion(cq, q));
    }
  }
  writeRaw(data);
}

export function removeQuestionFromCollection(
  collectionId: string,
  facultyId: string,
  subject: string,
  questionId: number | string
): void {
  const data = readRaw();
  const c = data.collections.find((c) => c.id === collectionId);
  if (!c) return;
  c.questions = c.questions.filter(
    (cq) => !sameQuestion(cq, { facultyId, subject, questionId })
  );
  writeRaw(data);
}

export function getCollectionsContaining(
  facultyId: string,
  subject: string,
  questionId: number | string
): string[] {
  const data = readRaw();
  const q: CollectionQuestion = { facultyId, subject, questionId };
  return data.collections
    .filter((c) => c.questions.some((cq) => sameQuestion(cq, q)))
    .map((c) => c.id);
}

/**
 * Returns true if the question is in at least one collection (used to
 * decide whether to display a filled-in bookmark icon).
 */
export function isQuestionSaved(
  facultyId: string,
  subject: string,
  questionId: number | string
): boolean {
  return getCollectionsContaining(facultyId, subject, questionId).length > 0;
}

/**
 * Returns the unique union of questions across all collections.
 */
export function getAllSavedQuestions(): CollectionQuestion[] {
  const seen = new Set<string>();
  const result: CollectionQuestion[] = [];
  for (const c of readRaw().collections) {
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

let migrationDone = false;

/**
 * One-shot migration from the legacy `lf2-quiz-bookmarks` key into a
 * single collection named "Neuřazené". Removes the old key afterward.
 */
function migrateOldBookmarks(): void {
  if (typeof window === "undefined" || migrationDone) return;
  migrationDone = true;
  try {
    const oldRaw = localStorage.getItem(OLD_BOOKMARKS_KEY);
    if (!oldRaw) return;
    const oldData = JSON.parse(oldRaw) as Record<string, (number | string)[]>;
    const flat: CollectionQuestion[] = [];
    for (const [subject, ids] of Object.entries(oldData || {})) {
      if (!Array.isArray(ids)) continue;
      for (const id of ids)
        flat.push({ facultyId: DEFAULT_FACULTY, subject, questionId: id });
    }
    if (flat.length === 0) {
      localStorage.removeItem(OLD_BOOKMARKS_KEY);
      return;
    }
    const data = readRaw();
    const collection: Collection = {
      id: genId(),
      name: "Neuřazené",
      color: COLLECTION_COLORS[6], // gray
      createdAt: new Date().toISOString(),
      questions: flat,
    };
    data.collections.unshift(collection);
    writeRaw(data);
    localStorage.removeItem(OLD_BOOKMARKS_KEY);
  } catch {
    // ignore migration errors
  }
}
