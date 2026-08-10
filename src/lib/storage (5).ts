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
  targetDate: string | null; // format YYYY-MM-DD, optionnel
  createdAt: number;
}

export type NotionStatus = "non_etudiee" | "a_apprendre" | "en_cours" | "a_revoir" | "maitrisee";

export interface Notion {
  id: string;
  subjectId: string | null;
  chapter: string;
  name: string;
  status: NotionStatus;
  lastReviewedAt: number | null;
  nextReviewAt: string | null; // format YYYY-MM-DD
  note: string;
  source: string;
  createdAt: number;
}

export interface StudySession {
  id: string;
  subjectId: string | null;
  minutes: number;
  date: string; // format YYYY-MM-DD
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
  notions: STORAGE_PREFIX + "notions",
  studySessions: STORAGE_PREFIX + "study-sessions",
  favoriteMethods: STORAGE_PREFIX + "favorite-methods",
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

export function loadNotions(): Notion[] {
  return safeGet<Notion[]>(KEYS.notions, []);
}
export function saveNotions(notions: Notion[]) {
  safeSet(KEYS.notions, notions);
}

export function loadStudySessions(): StudySession[] {
  return safeGet<StudySession[]>(KEYS.studySessions, []);
}
export function saveStudySessions(sessions: StudySession[]) {
  safeSet(KEYS.studySessions, sessions);
}

export function loadFavoriteMethods(): string[] {
  return safeGet<string[]>(KEYS.favoriteMethods, []);
}
export function saveFavoriteMethods(ids: string[]) {
  safeSet(KEYS.favoriteMethods, ids);
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Client API — compte utilisateur + synchronisation D1
// ---------------------------------------------------------------------------
// Toutes les requêtes envoient les cookies (credentials: "include") pour que
// la session côté serveur soit reconnue. En cas d'échec réseau ou de D1 non
// configuré côté Worker, ces fonctions lèvent une erreur que l'appelant doit
// intercepter : l'application doit alors basculer sur le mode local.

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    let message = `Erreur (${response.status})`;
    try {
      const data = await response.json();
      if (data && typeof data.error === "string") message = data.error;
    } catch {
      // corps de réponse non-JSON : on garde le message générique
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export async function apiMe(): Promise<AuthUser | null> {
  try {
    const data = await apiRequest<{ user: AuthUser }>("/api/auth/me");
    return data.user;
  } catch {
    return null;
  }
}

export async function apiRegister(email: string, password: string, name: string): Promise<AuthUser> {
  const data = await apiRequest<{ user: AuthUser }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
  return data.user;
}

export async function apiLogin(email: string, password: string): Promise<AuthUser> {
  const data = await apiRequest<{ user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return data.user;
}

export async function apiLogout(): Promise<void> {
  await apiRequest("/api/auth/logout", { method: "POST" }).catch(() => {});
}

interface RawSubject {
  id: string;
  name: string;
  color: SubjectColor;
  icon: string;
  created_at: number;
}
interface RawHomework {
  id: string;
  subject_id: string | null;
  title: string;
  due_date: string | null;
  status: HomeworkStatus;
  notes: string | null;
  created_at: number;
}
interface RawGoal {
  id: string;
  subject_id: string | null;
  title: string;
  progress: number;
  done: number;
  target_date: string | null;
  created_at: number;
}

export async function apiListSubjects(): Promise<Subject[]> {
  const data = await apiRequest<{ results: RawSubject[] }>("/api/subjects");
  return data.results.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    icon: r.icon,
    createdAt: r.created_at,
  }));
}
export async function apiUpsertSubject(s: Subject): Promise<void> {
  await apiRequest("/api/subjects", { method: "POST", body: JSON.stringify(s) });
}
export async function apiDeleteSubject(id: string): Promise<void> {
  await apiRequest(`/api/subjects?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function apiListHomework(): Promise<Homework[]> {
  const data = await apiRequest<{ results: RawHomework[] }>("/api/homework");
  return data.results.map((r) => ({
    id: r.id,
    title: r.title,
    subjectId: r.subject_id,
    dueDate: r.due_date,
    status: r.status,
    notes: r.notes ?? "",
    createdAt: r.created_at,
  }));
}
export async function apiUpsertHomework(h: Homework): Promise<void> {
  await apiRequest("/api/homework", { method: "POST", body: JSON.stringify(h) });
}
export async function apiDeleteHomework(id: string): Promise<void> {
  await apiRequest(`/api/homework?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function apiListGoals(): Promise<Goal[]> {
  const data = await apiRequest<{ results: RawGoal[] }>("/api/goals");
  return data.results.map((r) => ({
    id: r.id,
    title: r.title,
    subjectId: r.subject_id,
    progress: r.progress,
    done: !!r.done,
    targetDate: r.target_date,
    createdAt: r.created_at,
  }));
}
export async function apiUpsertGoal(g: Goal): Promise<void> {
  await apiRequest("/api/goals", { method: "POST", body: JSON.stringify(g) });
}
export async function apiDeleteGoal(id: string): Promise<void> {
  await apiRequest(`/api/goals?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Assistant IA — historique de conversation (stocké localement uniquement)
// ---------------------------------------------------------------------------

export type AiActionEntity = "subject" | "homework" | "goal" | "notion" | "study_session";
export type AiActionOperation = "create" | "update" | "delete";
export type AiActionStatus = "pending" | "done" | "cancelled" | "error";

export interface AiAction {
  id: string;
  entity: AiActionEntity;
  operation: AiActionOperation;
  args: Record<string, unknown>;
  status: AiActionStatus;
  description: string; // texte lisible généré côté client, ex. "Créer la matière « Physique »"
  resultLabel?: string; // message affiché une fois l'action résolue (succès ou erreur)
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  actions?: AiAction[];
}

const CHAT_KEY = STORAGE_PREFIX + "chat";

export function loadChatHistory(): ChatMessage[] {
  return safeGet<ChatMessage[]>(CHAT_KEY, []);
}

export function saveChatHistory(messages: ChatMessage[]): void {
  safeSet(CHAT_KEY, messages);
}

export interface RawAiAction {
  entity: AiActionEntity;
  operation: AiActionOperation;
  args: Record<string, unknown>;
}

export async function apiChatSend(
  messages: { role: "user" | "assistant"; content: string }[],
  context?: string
): Promise<{ reply: string; actions: RawAiAction[] }> {
  const data = await apiRequest<{ reply: string; actions?: RawAiAction[] }>("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify({ messages, context: context ?? "" }),
  });
  return { reply: data.reply, actions: data.actions ?? [] };
}

// ---------------------------------------------------------------------------
// Notions (Matière → Chapitre → Notion)
// ---------------------------------------------------------------------------

interface RawNotion {
  id: string;
  subject_id: string | null;
  chapter: string | null;
  name: string;
  status: NotionStatus;
  last_reviewed_at: number | null;
  next_review_at: string | null;
  note: string | null;
  source: string | null;
  created_at: number;
}

export async function apiListNotions(): Promise<Notion[]> {
  const data = await apiRequest<{ results: RawNotion[] }>("/api/notions");
  return data.results.map((r) => ({
    id: r.id,
    subjectId: r.subject_id,
    chapter: r.chapter ?? "",
    name: r.name,
    status: r.status,
    lastReviewedAt: r.last_reviewed_at,
    nextReviewAt: r.next_review_at,
    note: r.note ?? "",
    source: r.source ?? "",
    createdAt: r.created_at,
  }));
}
export async function apiUpsertNotion(n: Notion): Promise<void> {
  await apiRequest("/api/notions", { method: "POST", body: JSON.stringify(n) });
}
export async function apiDeleteNotion(id: string): Promise<void> {
  await apiRequest(`/api/notions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Sessions d'étude
// ---------------------------------------------------------------------------

interface RawStudySession {
  id: string;
  subject_id: string | null;
  minutes: number;
  session_date: string;
  created_at: number;
}

export async function apiListStudySessions(): Promise<StudySession[]> {
  const data = await apiRequest<{ results: RawStudySession[] }>("/api/study-sessions");
  return data.results.map((r) => ({
    id: r.id,
    subjectId: r.subject_id,
    minutes: r.minutes,
    date: r.session_date,
    createdAt: r.created_at,
  }));
}
export async function apiUpsertStudySession(s: StudySession): Promise<void> {
  await apiRequest("/api/study-sessions", { method: "POST", body: JSON.stringify(s) });
}
export async function apiDeleteStudySession(id: string): Promise<void> {
  await apiRequest(`/api/study-sessions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
