import { createBlobStore } from "./blobStore";

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

export interface CollectionsData {
  collections: Collection[];
}

export const COLLECTIONS_KEY = "lf2-quiz-collections";

function parseCollections(raw: unknown): CollectionsData {
  if (!raw || typeof raw !== "object") return { collections: [] };
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.collections)) return { collections: [] };
  return { collections: obj.collections as Collection[] };
}

export const collectionsStore = createBlobStore<CollectionsData>({
  storageKey: COLLECTIONS_KEY,
  eventName: "lf2-collections",
  empty: () => ({ collections: [] }),
  parse: parseCollections,
});
