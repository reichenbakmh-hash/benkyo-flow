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

export type RadiusStyle = "compact" | "default" | "round";

export interface AppSettings {
  sidebarCollapsed: boolean;
  sidebarBackgroundImage: string | null; // image personnalisée (data URL), en fond de la barre latérale
  appBackgroundImage: string | null; // image personnalisée (data URL), en fond de toute la zone de contenu
  customPrimaryColor: string | null; // couleur principale personnalisée (hex), remplace le thème par défaut
  customAccentColor: string | null; // couleur d'accent personnalisée (hex)
  themePaletteId: string | null; // id d'une ambiance complète (voir fullPalettes) — remplace fond/texte/surfaces
  radiusStyle: RadiusStyle; // arrondi global de l'interface
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
  sidebarBackgroundImage: null,
  appBackgroundImage: null,
  customPrimaryColor: null,
  customAccentColor: null,
  themePaletteId: null,
  radiusStyle: "default",
};

export const defaultUser: UserProfile = {
  name: "",
  loggedIn: false,
};

// Quelques matières de base proposées à un nouvel utilisateur.
// Elles restent entièrement modifiables / supprimables.
export const starterSubjects: Subject[] = [
  { id: "sub-math", name: "Mathématiques", color: "blue", icon: "calculator", createdAt: Date.now() },
  { id: "sub-fr", name: "Français", color: "red", icon: "book-open", createdAt: Date.now() },
  { id: "sub-en", name: "Anglais", color: "purple", icon: "languages", createdAt: Date.now() },
  { id: "sub-hist", name: "Histoire-Géo", color: "orange", icon: "landmark", createdAt: Date.now() },
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

function safeSet<T>(key: string, value: T): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Stockage indisponible (mode privé strict, quota dépassé — typiquement
    // à cause d'une image de fond trop lourde) : l'app continue de
    // fonctionner en mémoire pour la session en cours. On renvoie `false`
    // pour que l'appelant puisse prévenir l'utilisateur si besoin, au lieu
    // de lui laisser croire que l'enregistrement a réussi.
    return false;
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
    // Fusion avec les valeurs par défaut : un utilisateur qui avait déjà des
    // réglages enregistrés avant l'ajout des ambiances/fond global/densité
    // ne doit pas se retrouver avec des champs `undefined`.
    settings: { ...defaultSettings, ...safeGet<Partial<AppSettings>>(KEYS.settings, defaultSettings) },
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

// L'historique doit rester propre à chaque compte sur un même appareil :
// une clé de stockage dédiée par utilisateur, au lieu d'une case unique
// partagée par tout le monde. Le mode invité garde la clé générique.
function historyKeyFor(userId: string | null): string {
  return userId ? `${STORAGE_PREFIX}history:${userId}` : KEYS.history;
}

export function loadHistoryFor(userId: string | null): HistoryEntry[] {
  return safeGet<HistoryEntry[]>(historyKeyFor(userId), []);
}

export function saveHistoryFor(userId: string | null, history: HistoryEntry[]) {
  safeSet(historyKeyFor(userId), history);
}
export function saveSettings(settings: AppSettings): boolean {
  return safeSet(KEYS.settings, settings);
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

// Même principe que pour l'historique : une case de stockage par compte,
// pour ne jamais mélanger les favoris de deux comptes sur un même appareil.
function favoriteMethodsKeyFor(userId: string | null): string {
  return userId ? `${STORAGE_PREFIX}favorite-methods:${userId}` : KEYS.favoriteMethods;
}
export function loadFavoriteMethodsFor(userId: string | null): string[] {
  return safeGet<string[]>(favoriteMethodsKeyFor(userId), []);
}
export function saveFavoriteMethodsFor(userId: string | null, ids: string[]) {
  safeSet(favoriteMethodsKeyFor(userId), ids);
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Couleurs personnalisées — dérive les variantes claire/sombre/rgb utilisées
// par les variables CSS à partir d'une seule couleur choisie par l'utilisateur.
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((c) => clamp(c).toString(16).padStart(2, "0")).join("")}`;
}

// amount > 0 éclaircit (vers le blanc), amount < 0 assombrit (vers le noir).
function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const target = amount > 0 ? 255 : 0;
  const p = Math.abs(amount);
  return rgbToHex(r + (target - r) * p, g + (target - g) * p, b + (target - b) * p);
}

export interface DerivedColorSet {
  base: string;
  light: string;
  dark: string;
  darker: string;
  rgb: string; // "r, g, b"
}

export function deriveColorSet(hex: string): DerivedColorSet {
  const [r, g, b] = hexToRgb(hex);
  return {
    base: hex,
    light: shade(hex, 0.22),
    dark: shade(hex, -0.2),
    darker: shade(hex, -0.38),
    rgb: `${r}, ${g}, ${b}`,
  };
}

export interface ColorPreset {
  id: string;
  label: string;
  primary: string;
  accent: string;
}

export const colorPresets: ColorPreset[] = [
  { id: "default", label: "Bleu nuit / orange", primary: "#1e3a5f", accent: "#f4820c" },
  { id: "forest", label: "Vert forêt", primary: "#1b4332", accent: "#e0a458" },
  { id: "burgundy", label: "Bordeaux", primary: "#6b1f2a", accent: "#d4a017" },
  { id: "ocean", label: "Bleu océan", primary: "#0f3d5c", accent: "#17a2b8" },
  { id: "charcoal", label: "Anthracite", primary: "#292b30", accent: "#e63946" },
];

// ---------------------------------------------------------------------------
// Ambiances complètes ("full palettes") — contrairement aux duos rapides
// ci-dessus (qui ne touchent que primaire/accent et laissent le thème
// clair/sombre gérer le reste), une ambiance redéfinit aussi le fond, les
// surfaces, le texte et les bordures. Chaque entrée ne fournit que les
// couleurs qui la caractérisent vraiment ; `resolvePalette` complète le
// reste (surface, bordure, texte atténué, couleur de texte sur les boutons)
// automatiquement pour rester lisible, quelle que soit la palette.
// ---------------------------------------------------------------------------

export interface FullPalette {
  id: string;
  label: string;
  description: string;
  bg: string;
  surface?: string;
  primary: string;
  accent?: string;
  text: string;
  border?: string;
}

export const fullPalettes: FullPalette[] = [
  {
    id: "dark",
    label: "Dark",
    description: "Puissance et autorité.",
    bg: "#0B0E14",
    surface: "#1A202C",
    primary: "#D4AF37",
    text: "#E2E8F0",
    border: "#2D3748",
  },
  {
    id: "neon",
    label: "Neon",
    description: "Stimulation cognitive, couleurs vives sur fond sombre.",
    bg: "#0D1117",
    primary: "#58A6FF",
    accent: "#F78166",
    text: "#8B949E",
  },
  {
    id: "ethereal-dream",
    label: "Ethereal Dream",
    description: "Aquarelle onirique, douceur absolue.",
    bg: "#FBF4F2",
    surface: "#E8D1E0",
    primary: "#A8D5BA",
    accent: "#F2C4C4",
    text: "#4A4A5A",
  },
  {
    id: "old-soul-library",
    label: "Old Soul Library",
    description: "Nostalgique, mystérieux et feutré.",
    bg: "#F3EDE4",
    surface: "#B7A69E",
    primary: "#2C3E50",
    accent: "#C44545",
    text: "#6F5E53",
  },
  {
    id: "golden-hour",
    label: "Golden Hour",
    description: "Optimiste, solaire et rassembleur.",
    bg: "#FFF8EE",
    primary: "#FF9A76",
    accent: "#FECB6E",
    text: "#2D4059",
  },
  {
    id: "heritage-oak",
    label: "Heritage Oak",
    description: "Intemporel, robuste et professionnel.",
    bg: "#F7F3EE",
    surface: "#DCDDE1",
    primary: "#8B5A2B",
    accent: "#E1B12C",
    text: "#2F3640",
  },
  {
    id: "coastal-grandma",
    label: "Coastal Grandma",
    description: "Confort doux, nostalgique et accueillant.",
    bg: "#FDFBF7",
    surface: "#D4E2D4",
    primary: "#A5C2CA",
    accent: "#E8C3AD",
    text: "#5C6B73",
  },
  {
    id: "urban-jungle",
    label: "Urban Jungle",
    description: "Streetwear, vibrance urbaine et matières brutes.",
    bg: "#1A1A1A",
    surface: "#2B2D42",
    primary: "#FCA311",
    accent: "#D90429",
    text: "#F5F5F5",
  },
  {
    id: "macaron",
    label: "Macaron",
    description: "Sensoriel et artistique, couleurs vives mais douces.",
    bg: "#F8EDEB",
    surface: "#FCD5CE",
    primary: "#219EBC",
    accent: "#FFB5A7",
    text: "#4A3B3D",
  },
  {
    id: "neon-rave",
    label: "Neon Rave",
    description: "Maximalisme, énergie pure et fun.",
    bg: "#120A2B",
    primary: "#FF006E",
    accent: "#00F5D4",
    text: "#FFFFFF",
  },
  {
    id: "monochrome",
    label: "Monochrome",
    description: "Épuré, neutre, sans distraction.",
    bg: "#FFFFFF",
    surface: "#F5F5F5",
    border: "#E0E0E0",
    primary: "#424242",
    accent: "#9E9E9E",
    text: "#212121",
  },
  {
    id: "sepia",
    label: "Sepia",
    description: "Réduit la lumière bleue, ambiance nostalgique.",
    bg: "#FBF3E8",
    surface: "#EAD7C3",
    primary: "#C4A484",
    text: "#5C4033",
  },
  {
    id: "strawberry-milk",
    label: "Strawberry Milk",
    description: "Douceur réconfortante et un peu de gourmandise.",
    bg: "#FFF0F5",
    surface: "#FFB6C1",
    primary: "#FF69B4",
    accent: "#FF85A2",
    text: "#5D4037",
    border: "#FCE4EC",
  },
  {
    id: "cherry-blossom-rain",
    label: "Cherry Blossom Rain",
    description: "Pluie de Sakura, mélancolie poétique et nature.",
    bg: "#FDF6F0",
    surface: "#FADADD",
    primary: "#F4A2A2",
    accent: "#B5B8C3",
    text: "#3E3A45",
    border: "#E8A2B0",
  },
];

// Luminance relative (WCAG) — sert à décider si une couleur est "sombre" et
// quelle couleur de texte (noir ou blanc) reste lisible par-dessus.
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const chan = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

export function isDarkColor(hex: string): boolean {
  return relativeLuminance(hex) < 0.4;
}

// Renvoie une couleur de texte (noir ou blanc profond) lisible par-dessus `hex`.
export function getContrastText(hex: string): string {
  return relativeLuminance(hex) > 0.45 ? "#14121f" : "#ffffff";
}

export interface ResolvedPalette {
  bg: string;
  bgRgb: string;
  bgElevated: string;
  card: string;
  border: string;
  text: string;
  textMuted: string;
  textOnPrimary: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryDarker: string;
  primaryRgb: string;
  accent: string;
  accentDark: string;
  accentRgb: string;
}

// Complète une ambiance partiellement définie (bg/primaire/texte minimum)
// en un jeu complet de couleurs prêtes à poser sur les variables CSS.
export function resolvePalette(p: FullPalette): ResolvedPalette {
  const dark = isDarkColor(p.bg);
  const surface = p.surface ?? shade(p.bg, dark ? 0.08 : -0.02);
  const border = p.border ?? shade(surface, dark ? 0.18 : -0.14);
  const textMuted = shade(p.text, dark ? -0.28 : 0.32);
  const accentBase = p.accent ?? p.primary;
  const primarySet = deriveColorSet(p.primary);
  const accentSet = deriveColorSet(accentBase);
  const [br, bg2, bb] = hexToRgb(p.bg);
  return {
    bg: p.bg,
    bgRgb: `${br}, ${bg2}, ${bb}`,
    bgElevated: dark ? shade(p.bg, 0.05) : "#ffffff",
    card: surface,
    border,
    text: p.text,
    textMuted,
    textOnPrimary: getContrastText(p.primary),
    primary: primarySet.base,
    primaryLight: primarySet.light,
    primaryDark: primarySet.dark,
    primaryDarker: primarySet.darker,
    primaryRgb: primarySet.rgb,
    accent: accentSet.base,
    accentDark: accentSet.dark,
    accentRgb: accentSet.rgb,
  };
}

// ---------------------------------------------------------------------------
// Compression d'image côté client — évite qu'une photo de plusieurs Mo
// (fond de menu ou fond d'application) ne sature le quota localStorage
// (généralement 5-10 Mo par origine, partagé avec toutes les autres données
// de l'app). On redimensionne et on ré-encode en JPEG avant stockage.
// ---------------------------------------------------------------------------
export function compressImageFile(file: File, maxWidth = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image invalide ou illisible."));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Compression d'image indisponible sur cet appareil."));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
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

// Même principe : une conversation par compte sur un même appareil.
function chatKeyFor(userId: string | null): string {
  return userId ? `${STORAGE_PREFIX}chat:${userId}` : CHAT_KEY;
}
export function loadChatHistoryFor(userId: string | null): ChatMessage[] {
  return safeGet<ChatMessage[]>(chatKeyFor(userId), []);
}
export function saveChatHistoryFor(userId: string | null, messages: ChatMessage[]): void {
  safeSet(chatKeyFor(userId), messages);
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
