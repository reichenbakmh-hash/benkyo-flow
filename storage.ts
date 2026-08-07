// ---------------------------------------------------------------------------
// Benkyo Flow — Couche de persistance
// ---------------------------------------------------------------------------
// V1 : la source de vérité est localStorage (fiable, synchrone, hors-ligne).
// Chaque fonction est défensive : si localStorage est indisponible (mode
// privé strict, quota dépassé, etc.), l'application continue de fonctionner
// en mémoire au lieu d'afficher un écran blanc.
// ---------------------------------------------------------------------------

export type ThemeMode = "light" | "dark" | "system";

export type SubjectColor =
  | "blue"
  | "green"
  | "orange"
  | "purple"
  | "red"
  | "teal"
  | "pink"
  | "yellow";

export interface Subject {
  id: string;
  name: string;
  color: SubjectColor;
  icon: string; // emoji, pour rester simple et sans dépendance d'icônes
  createdAt: number;
}

export type HomeworkStatus = "todo" | "in_progress" | "done";

export interface Homework {
  id: string;
  title: string;
  subjectId: string | null;
  dueDate: string | null; // format YYYY-MM-DD
  status: HomeworkStatus;
  notes: string;
  createdAt: number;
}

export interface Goal {
  id: string;
  title: string;
  subjectId: string | null;
  progress: number; // 0 à 100
  done: boolean;
  createdAt: number;
}

export interface HistoryEntry {
  id: string;
  label: string;
  date: number;
}

export interface UserProfile {
  name: string;
  loggedIn: boolean;
}

export interface AppSettings {
  sidebarCollapsed: boolean;
}

export interface AppData {
  user: UserProfile;
  subjects: Subject[];
  homework: Homework[];
  goals: Goal[];
  history: HistoryEntry[];
  settings: AppSettings;
  theme: ThemeMode;
}

const STORAGE_PREFIX = "benkyo-flow:";
const KEYS = {
  user: STORAGE_PREFIX + "user",
  subjects: STORAGE_PREFIX + "subjects",
  homework: STORAGE_PREFIX + "homework",
  goals: STORAGE_PREFIX + "goals",
  history: STORAGE_PREFIX + "history",
  settings: STORAGE_PREFIX + "settings",
  theme: STORAGE_PREFIX + "theme",
} as const;

export const defaultSettings: AppSettings = {
  sidebarCollapsed: false,
};

export const defaultUser: UserProfile = {
  name: "",
  loggedIn: false,
};

// Quelques matières de base proposées à un nouvel utilisateur.
// Elles restent entièrement modifiables / supprimables.
export const starterSubjects: Subject[] = [
  { id: "sub-math", name: "Mathématiques", color: "blue", icon: "📐", createdAt: Date.now() },
  { id: "sub-fr", name: "Français", color: "red", icon: "📚", createdAt: Date.now() },
  { id: "sub-en", name: "Anglais", color: "purple", icon: "🇬🇧", createdAt: Date.now() },
  { id: "sub-hist", name: "Histoire-Géo", color: "orange", icon: "🗺️", createdAt: Date.now() },
];

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Stockage indisponible : on ignore silencieusement, l'app continue
    // de fonctionner en mémoire pour la session en cours.
  }
}

export function loadAppData(): AppData {
  const subjects = safeGet<Subject[]>(KEYS.subjects, starterSubjects);
  return {
    user: safeGet<UserProfile>(KEYS.user, defaultUser),
    subjects,
    homework: safeGet<Homework[]>(KEYS.homework, []),
    goals: safeGet<Goal[]>(KEYS.goals, []),
    history: safeGet<HistoryEntry[]>(KEYS.history, []),
    settings: safeGet<AppSettings>(KEYS.settings, defaultSettings),
    theme: safeGet<ThemeMode>(KEYS.theme, "system"),
  };
}

export function saveUser(user: UserProfile) {
  safeSet(KEYS.user, user);
}
export function saveSubjects(subjects: Subject[]) {
  safeSet(KEYS.subjects, subjects);
}
export function saveHomework(homework: Homework[]) {
  safeSet(KEYS.homework, homework);
}
export function saveGoals(goals: Goal[]) {
  safeSet(KEYS.goals, goals);
}
export function saveHistory(history: HistoryEntry[]) {
  safeSet(KEYS.history, history);
}
export function saveSettings(settings: AppSettings) {
  safeSet(KEYS.settings, settings);
}
export function saveTheme(theme: ThemeMode) {
  safeSet(KEYS.theme, theme);
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
