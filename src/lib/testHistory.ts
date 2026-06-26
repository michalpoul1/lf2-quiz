const STORAGE_KEY = "lf2-quiz-test-history";
const STREAK_KEY = "lf2-quiz-streak";

// Records carry facultyId for backwards compatibility with existing stored
// history. Internally we always tag new entries with the 2lf namespace.
const FACULTY = "2lf";

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

interface StreakData {
  current: number;
  lastDate: string; // YYYY-MM-DD
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
  updateStreak();
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getStreakData(): StreakData {
  if (typeof window === "undefined") return { current: 0, lastDate: "" };
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return { current: 0, lastDate: "" };
    return JSON.parse(raw);
  } catch {
    return { current: 0, lastDate: "" };
  }
}

function updateStreak(): void {
  if (typeof window === "undefined") return;
  const data = getStreakData();
  const today = todayStr();
  if (data.lastDate === today) return; // Already counted today
  if (data.lastDate === yesterdayStr()) {
    data.current += 1;
  } else {
    data.current = 1;
  }
  data.lastDate = today;
  localStorage.setItem(STREAK_KEY, JSON.stringify(data));
}

export function getStreak(): number {
  const data = getStreakData();
  const today = todayStr();
  const yesterday = yesterdayStr();
  if (data.lastDate === today || data.lastDate === yesterday) {
    return data.current;
  }
  return 0; // Streak broken
}

export function getTodayAnswered(): number {
  const history = getTestHistory();
  const today = todayStr();
  let count = 0;
  for (const t of history) {
    if (t.date.startsWith(today)) {
      count += t.totalQuestions;
    }
  }
  return count;
}

export function clearTestHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STREAK_KEY);
}
