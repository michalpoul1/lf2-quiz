import { getSubjectData, filterValidQuestions, getChapterQuestions } from "./data";
import { getSubjectProgress } from "./progress";

interface OrphanKey {
  key: string;
  wrongIds: (string | number)[];
  wrongIdsCount: number;
  idsPresentInDataElsewhere: (string | number)[];
  idsMissingFromDataEntirely: (string | number)[];
}

interface SubjectDiagnostics {
  subject: string;
  progressKeys: string[];
  validDataKeys: string[];
  orphanKeys: OrphanKey[];
  totalOrphanIds: number;
  movedIds: number;
  deadIds: number;
}

/**
 * Read-only diagnostic — surfaces which keys in `progress[subject]` don't
 * correspond to any current chapter/subchapter, how many wrong ids sit under
 * them, and whether those ids point at questions that still exist in current
 * data (under a different key = "moved") or are truly gone ("dead").
 *
 * Does NOT modify storage.
 */
export function diagnoseWrongIds(subject: string): SubjectDiagnostics {
  const data = getSubjectData(subject);
  const progress = getSubjectProgress(subject);

  const validDataKeys = new Set<string>();
  if (data) {
    for (const ch of data.chapters) {
      if (ch.subchapters && ch.subchapters.length > 0) {
        for (const sub of ch.subchapters) validDataKeys.add(String(sub.id));
      }
      // Chapter id can also legitimately be a progress key for flat chapters.
      validDataKeys.add(String(ch.id));
    }
  }

  // Build a set of IDs that exist somewhere in current data.
  const allDataIds = new Set<string>();
  if (data) {
    for (const q of filterValidQuestions(getChapterQuestions(subject, "all"))) {
      allDataIds.add(String(q.id));
    }
  }

  const orphanKeys: OrphanKey[] = [];
  let totalOrphanIds = 0;
  let movedIds = 0;
  let deadIds = 0;

  for (const [key, cp] of Object.entries(progress)) {
    if (validDataKeys.has(key)) continue;
    const wrongIds = (cp?.wrongIds ?? []) as (string | number)[];
    const presentElsewhere: (string | number)[] = [];
    const missing: (string | number)[] = [];
    for (const id of wrongIds) {
      if (allDataIds.has(String(id))) presentElsewhere.push(id);
      else missing.push(id);
    }
    orphanKeys.push({
      key,
      wrongIds,
      wrongIdsCount: wrongIds.length,
      idsPresentInDataElsewhere: presentElsewhere,
      idsMissingFromDataEntirely: missing,
    });
    totalOrphanIds += wrongIds.length;
    movedIds += presentElsewhere.length;
    deadIds += missing.length;
  }

  return {
    subject,
    progressKeys: Object.keys(progress),
    validDataKeys: [...validDataKeys].sort(),
    orphanKeys,
    totalOrphanIds,
    movedIds,
    deadIds,
  };
}

/**
 * Console dump for all three subjects. Call from any client component
 * effect once and inspect via DevTools. Intentionally verbose — the goal
 * is to see what would be lost before we ever delete anything.
 */
export function dumpWrongIdsDiagnostics() {
  if (typeof window === "undefined") return;
  for (const subject of ["biology", "chemistry", "physics"]) {
    const d = diagnoseWrongIds(subject);
    // eslint-disable-next-line no-console
    console.group(`[wrongIds diagnostics] ${subject}`);
    // eslint-disable-next-line no-console
    console.log("progressKeys:", d.progressKeys);
    // eslint-disable-next-line no-console
    console.log("validDataKeys:", d.validDataKeys);
    // eslint-disable-next-line no-console
    console.log(
      `orphan keys: ${d.orphanKeys.length} · totalOrphanIds: ${d.totalOrphanIds} · movedIds (still in data elsewhere): ${d.movedIds} · deadIds (gone): ${d.deadIds}`
    );
    for (const o of d.orphanKeys) {
      // eslint-disable-next-line no-console
      console.log(
        `  key="${o.key}" ids=${o.wrongIdsCount} moved=${o.idsPresentInDataElsewhere.length} dead=${o.idsMissingFromDataEntirely.length}`,
        { moved: o.idsPresentInDataElsewhere, dead: o.idsMissingFromDataEntirely }
      );
    }
    // eslint-disable-next-line no-console
    console.groupEnd();
  }
}
