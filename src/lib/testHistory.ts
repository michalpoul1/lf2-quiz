const STORAGE_KEY = "lf2-quiz-test-history";
const STREAK_KEY = "lf2-quiz-streak";

// Records carry facultyId for backwards compatibility with existing stored
// history. Internally we always tag new entries with the 2lf namespace.
const FACULTY = "2lf";

// Streak logic moved to src/lib/streak.ts. Individual answers already fire
// bumpTodayCount() via recordAnswer(); we no longer touch the streak here.

export interface TestRecord {
  id: string;
  type: "quick" | "simulation";
  date: string;
  facultyId: string;
  subjects: string[];
  totalQuestions: number;
  correctAnswers: number;
  timeSeconds: number;
}

function genId(): string {
  return `test_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
}

let historyMigrationDone = false;

export function getTestHistory(): TestRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    let changed = false;
    const migrated: TestRecord[] = data.map((t) => {
      if (!t.facultyId) {
        changed = true;
        return { ...t, facultyId: FACULTY };
      }
      return t;
    });
    if (!historyMigrationDone) {
      historyMigrationDone = true;
      if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    return [];
  }
}

export function saveTestResult(
  type: "quick" | "simulation",
  subjects: string[],
  totalQuestions: number,
  correctAnswers: number,
  timeSeconds: number
): void {
  if (typeof window === "undefined") return;
  const history = getTestHistory();
  history.unshift({
    id: genId(),
    type,
    date: new Date().toISOString(),
    facultyId: FACULTY,
    subjects,
    totalQuestions,
    correctAnswers,
    timeSeconds,
  });
  // Keep last 50 entries
  if (history.length > 50) history.length = 50;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  // Streak is maintained per-answer inside recordAnswer(), not here.
}

export function clearTestHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STREAK_KEY);
}
