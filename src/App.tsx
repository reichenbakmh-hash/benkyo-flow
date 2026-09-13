import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, FormEvent, CSSProperties, ChangeEvent } from "react";
import CustomSelect from "./components/CustomSelect";
import {
  loadAppData,
  saveUser,
  saveSubjects,
  saveSubjectsFor,
  loadSubjectsFor,
  saveHomework,
  saveHomeworkFor,
  loadHomeworkFor,
  saveGoals,
  saveGoalsFor,
  loadGoalsFor,
  loadHistoryFor,
  saveHistoryFor,
  loadSettingsFor,
  saveSettingsFor,
  loadThemeFor,
  saveThemeFor,
  rememberLastUserId,
  loadPendingSyncFor,
  savePendingSyncFor,
  makeId,
  starterSubjects,
  apiMe,
  apiRegister,
  apiLogin,
  apiLogout,
  apiResetPassword,
  apiAdminGenerateCode,
  apiAdminStats,
  apiListSubjects,
  apiUpsertSubject,
  apiDeleteSubject,
  apiListHomework,
  apiUpsertHomework,
  apiDeleteHomework,
  apiListGoals,
  apiUpsertGoal,
  apiDeleteGoal,
  loadChatHistoryFor,
  saveChatHistoryFor,
  apiChatSend,
  loadNotions,
  saveNotions,
  saveNotionsFor,
  loadNotionsFor,
  apiListNotions,
  apiUpsertNotion,
  apiDeleteNotion,
  loadStudySessions,
  saveStudySessions,
  saveStudySessionsFor,
  loadStudySessionsFor,
  apiListStudySessions,
  apiUpsertStudySession,
  apiDeleteStudySession,
  loadEvents,
  saveEvents,
  saveEventsFor,
  loadEventsFor,
  apiListEvents,
  apiUpsertEvent,
  apiDeleteEvent,
  loadFavoriteMethodsFor,
  saveFavoriteMethodsFor,
  deriveColorSet,
  colorPresets,
  fullPalettes,
  resolvePalette,
  isDarkColor,
  compressImageFile,
} from "./lib/storage";
import type {
  ThemeMode,
  Subject,
  SubjectColor,
  Homework,
  HomeworkSubtask,
  HomeworkRecurrence,
  HomeworkStatus,
  Goal,
  HistoryEntry,
  UserProfile,
  AppSettings,
  AuthUser,
  ChatMessage,
  Notion,
  NotionStatus,
  StudySession,
  CalendarEvent,
  CalendarEventType,
  FullPalette,
  RadiusStyle,
  AiAction,
  AiActionEntity,
  AiActionOperation,
  RawAiAction,
  PendingSyncOp,
  AdminStats,
  AdminUserStats,
} from "./lib/storage";
import { STUDY_METHODS, METHOD_CATEGORIES } from "./lib/methods";
import type { StudyMethod, MethodCategory, MethodDifficulty } from "./lib/methods";
import { reviewNotion, isNotionDueToday, todayISODate } from "./lib/spacedRepetition";
import type { ReviewOutcome } from "./lib/spacedRepetition";
import { daysUntil, isWithinDays, isoDateDaysAgo, computeStudyStreak, nextRecurrenceDate } from "./lib/dateUtils";
import {
  checkDueReminders,
  persistDueSnapshotForServiceWorker,
  registerPeriodicNotificationSync,
  requestNotificationPermission,
  getNotificationPermission,
  pruneOldNotifiedMarks,
} from "./lib/notifications";
import PomodoroTimer from "./components/PomodoroTimer";
import type { PomodoroSettings, PomodoroPreset } from "./lib/pomodoro";
import SharePlanningButton from "./components/SharePlanningButton";
import {
  Home,
  BookOpen,
  ClipboardList,
  ListChecks,
  Target,
  Puzzle,
  Brain,
  CalendarDays,
  CalendarRange,
  BarChart3,
  History as HistoryIcon,
  MessageCircle,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Monitor,
  Download,
  Upload,
  Cloud,
  CloudOff,
  HardDrive,
  LogOut,
  Menu as MenuIcon,
  X,
  Plus,
  Pencil,
  Trash2,
  Star,
  Send,
  Bot,
  Wand2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Repeat,
  FolderKanban,
  GraduationCap,
  PenLine,
  Sparkles,
  Flame,
  Calculator,
  FlaskConical,
  Globe,
  Palette,
  Music2,
  Code2,
  Languages,
  Landmark,
  Dumbbell,
  Leaf,
  Scale,
  Ruler,
  Atom,
  Trophy,
  User,
  Sprout,
  ChevronDown,
  Check,
  Sigma,
  Microscope,
  Dna,
  Rocket,
  Gavel,
  Camera,
  Film,
  Utensils,
  Cpu,
  HeartPulse,
  Mountain,
  Coins,
  PenTool,
  Guitar,
  Users,
  Compass,
  Feather,
  ScrollText,
  Building2,
  Hammer,
  ExternalLink,
  Search,
  ChevronRight,
  ChevronLeft,
  Timer,
  Bell,
  BellOff,
  RefreshCcw,
  WifiOff,
  Smartphone,
} from "lucide-react";
import { SiWhatsapp, SiGmail } from "react-icons/si";
import type { LucideIcon } from "lucide-react";

// ===========================================================================
// Constantes & petites aides
// ===========================================================================

type SectionId =
  | "home"
  | "subjects"
  | "homework"
  | "goals"
  | "notions"
  | "methods"
  | "session"
  | "planning"
  | "calendar"
  | "progress"
  | "history"
  | "assistant"
  | "settings"
  | "about";

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Accueil", icon: Home },
  { id: "subjects", label: "Matières", icon: BookOpen },
  { id: "homework", label: "Devoirs", icon: ClipboardList },
  { id: "goals", label: "Objectifs", icon: Target },
  { id: "notions", label: "Notions", icon: Puzzle },
  { id: "methods", label: "Méthodes", icon: Brain },
  { id: "session", label: "Session", icon: Timer },
  { id: "planning", label: "Planning", icon: CalendarDays },
  { id: "calendar", label: "Calendrier", icon: CalendarRange },
  { id: "progress", label: "Progression", icon: BarChart3 },
  { id: "history", label: "Historique", icon: HistoryIcon },
  { id: "assistant", label: "Benkyō IA", icon: MessageCircle },
  { id: "settings", label: "Paramètres", icon: SettingsIcon },
  { id: "about", label: "À propos", icon: Compass },
];

const SUBJECT_COLORS: SubjectColor[] = [
  "teal",
  "blue",
  "green",
  "orange",
  "purple",
  "red",
  "pink",
  "yellow",
];

const STATUS_LABEL: Record<HomeworkStatus, string> = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminé",
};

// --- Import JSON : normalisation défensive -------------------------------
// Le fichier importé vient potentiellement d'un autre appareil, d'une
// version antérieure de l'app, ou a été modifié à la main : on ne fait
// confiance à aucun champ. Même logique défensive que côté Worker pour les
// upserts (String(...), Number(...), valeurs par défaut) plutôt que de
// caster aveuglément le JSON parsé vers nos types.
const HOMEWORK_STATUSES: HomeworkStatus[] = ["todo", "in_progress", "done"];

function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return err instanceof TypeError;
}

function executeSyncOp(op: PendingSyncOp): Promise<unknown> {
  if (op.action === "delete") {
    if (op.kind === "subject") return apiDeleteSubject(op.id);
    if (op.kind === "homework") return apiDeleteHomework(op.id);
    if (op.kind === "goal") return apiDeleteGoal(op.id);
    if (op.kind === "notion") return apiDeleteNotion(op.id);
    if (op.kind === "event") return apiDeleteEvent(op.id);
    return apiDeleteStudySession(op.id);
  }
  if (op.kind === "subject") return apiUpsertSubject(op.payload as Subject);
  if (op.kind === "homework") return apiUpsertHomework(op.payload as Homework);
  if (op.kind === "goal") return apiUpsertGoal(op.payload as Goal);
  if (op.kind === "notion") return apiUpsertNotion(op.payload as Notion);
  if (op.kind === "event") return apiUpsertEvent(op.payload as CalendarEvent);
  return apiUpsertStudySession(op.payload as StudySession);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

// Ne garde que les entrées qui ressemblent à un objet avec un id — tout le
// reste est silencieusement ignoré plutôt que de faire échouer l'import
// entier pour un seul élément corrompu.
function importableItems(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is Record<string, unknown> => isRecord(item) && typeof item.id === "string");
}

function normalizeImportedSubject(raw: Record<string, unknown>): Subject {
  return {
    id: String(raw.id),
    name: String(raw.name ?? "Matière importée"),
    color: SUBJECT_COLORS.includes(raw.color as SubjectColor) ? (raw.color as SubjectColor) : "teal",
    icon: typeof raw.icon === "string" && SUBJECT_ICON_KEYS.includes(raw.icon) ? raw.icon : DEFAULT_SUBJECT_ICON_KEY,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
  };
}

function normalizeImportedSubtasks(raw: unknown): HomeworkSubtask[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object" && typeof s.id === "string")
    .map((s) => ({ id: String(s.id), title: String(s.title ?? ""), done: !!s.done }));
}

const HOMEWORK_RECURRENCE_FREQUENCIES: HomeworkRecurrence["frequency"][] = ["daily", "weekly", "monthly"];

function normalizeImportedRecurrence(raw: unknown): HomeworkRecurrence | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!HOMEWORK_RECURRENCE_FREQUENCIES.includes(r.frequency as HomeworkRecurrence["frequency"])) return null;
  const interval = Number(r.interval);
  if (!Number.isFinite(interval) || interval <= 0) return null;
  return { frequency: r.frequency as HomeworkRecurrence["frequency"], interval: Math.floor(interval) };
}

function normalizeImportedHomework(raw: Record<string, unknown>): Homework {
  return {
    id: String(raw.id),
    title: String(raw.title ?? "Devoir importé"),
    subjectId: typeof raw.subjectId === "string" ? raw.subjectId : null,
    dueDate: typeof raw.dueDate === "string" ? raw.dueDate : null,
    status: HOMEWORK_STATUSES.includes(raw.status as HomeworkStatus) ? (raw.status as HomeworkStatus) : "todo",
    notes: String(raw.notes ?? ""),
    subtasks: normalizeImportedSubtasks(raw.subtasks),
    recurrence: normalizeImportedRecurrence(raw.recurrence),
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
  };
}

function normalizeImportedGoal(raw: Record<string, unknown>): Goal {
  const progress = Number(raw.progress);
  return {
    id: String(raw.id),
    title: String(raw.title ?? "Objectif importé"),
    subjectId: typeof raw.subjectId === "string" ? raw.subjectId : null,
    progress: Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0,
    done: !!raw.done,
    targetDate: typeof raw.targetDate === "string" ? raw.targetDate : null,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
  };
}

function normalizeImportedNotion(raw: Record<string, unknown>): Notion {
  const validStatuses = Object.keys(NOTION_STATUS_LABEL);
  return {
    id: String(raw.id),
    subjectId: typeof raw.subjectId === "string" ? raw.subjectId : null,
    chapter: String(raw.chapter ?? ""),
    name: String(raw.name ?? "Notion importée"),
    status: validStatuses.includes(raw.status as string) ? (raw.status as NotionStatus) : "non_etudiee",
    lastReviewedAt: typeof raw.lastReviewedAt === "number" ? raw.lastReviewedAt : null,
    nextReviewAt: typeof raw.nextReviewAt === "string" ? raw.nextReviewAt : null,
    note: String(raw.note ?? ""),
    source: String(raw.source ?? ""),
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
  };
}

function normalizeImportedStudySession(raw: Record<string, unknown>): StudySession {
  const minutes = Number(raw.minutes);
  return {
    id: String(raw.id),
    subjectId: typeof raw.subjectId === "string" ? raw.subjectId : null,
    minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : 0,
    date: typeof raw.date === "string" ? raw.date : isoDateDaysAgo(0),
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
  };
}

function normalizeImportedEvent(raw: Record<string, unknown>): CalendarEvent {
  return {
    id: String(raw.id),
    subjectId: typeof raw.subjectId === "string" ? raw.subjectId : null,
    title: String(raw.title ?? "Événement importé"),
    date: typeof raw.date === "string" ? raw.date : isoDateDaysAgo(0),
    type: raw.type === "exam" ? "exam" : "other",
    notes: String(raw.notes ?? ""),
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
  };
}

// Fusion par id : un item importé remplace l'existant de même id, un id
// inconnu est ajouté. Jamais de remplacement total de la liste — voir le
// commentaire sur requestImportData dans App().
function upsertById<T extends { id: string }>(prev: T[], incoming: T[]): T[] {
  const byId = new Map(prev.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()];
}

function formatDateFR(iso: string | null): string {
  if (!iso) return "Sans échéance";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "Sans échéance";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatRecurrenceLabel(r: HomeworkRecurrence): string {
  if (r.frequency === "daily") {
    return r.interval === 1 ? "Tous les jours" : `Tous les ${r.interval} jours`;
  }
  if (r.frequency === "weekly") {
    return r.interval === 1 ? "Toutes les semaines" : `Toutes les ${r.interval} semaines`;
  }
  return r.interval === 1 ? "Tous les mois" : `Tous les ${r.interval} mois`;
}

const NOTION_STATUS_LABEL: Record<NotionStatus, string> = {
  non_etudiee: "Non étudiée",
  a_apprendre: "À apprendre",
  en_cours: "En cours",
  a_revoir: "À revoir",
  maitrisee: "Maîtrisée",
};

const NOTION_STATUS_ICON: Record<NotionStatus, LucideIcon> = {
  non_etudiee: Sparkles,
  a_apprendre: BookOpen,
  en_cours: Repeat,
  a_revoir: Clock,
  maitrisee: Trophy,
};

// Registre d'icônes pour les matières : l'utilisateur choisit un pictogramme
// parmi un jeu fixe (clé stable, ex. "calculator") plutôt qu'un emoji libre.
// Repli propre sur BookOpen si la clé est inconnue — notamment pour les
// matières créées avant ce changement, dont l'icône était un emoji.
const SUBJECT_ICONS: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  calculator: Calculator,
  sigma: Sigma,
  flask: FlaskConical,
  atom: Atom,
  microscope: Microscope,
  dna: Dna,
  globe: Globe,
  languages: Languages,
  landmark: Landmark,
  scroll: ScrollText,
  gavel: Gavel,
  building: Building2,
  coins: Coins,
  palette: Palette,
  music: Music2,
  guitar: Guitar,
  camera: Camera,
  film: Film,
  code: Code2,
  cpu: Cpu,
  ruler: Ruler,
  compass: Compass,
  rocket: Rocket,
  dumbbell: Dumbbell,
  "heart-pulse": HeartPulse,
  leaf: Leaf,
  scale: Scale,
  brain: Brain,
  users: Users,
  feather: Feather,
  "pen-tool": PenTool,
  utensils: Utensils,
  hammer: Hammer,
  mountain: Mountain,
};
const SUBJECT_ICON_KEYS = Object.keys(SUBJECT_ICONS);
const DEFAULT_SUBJECT_ICON_KEY = "book-open";

function SubjectIcon({ iconKey, size = 17 }: { iconKey: string; size?: number }) {
  const Icon = SUBJECT_ICONS[iconKey] ?? BookOpen;
  return <Icon size={size} strokeWidth={2.2} />;
}

// Icônes des catégories de méthodes (methods.ts ne stocke qu'une clé texte,
// framework-agnostique — le mapping vers un composant vit ici).
const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  brain: Brain,
  lightbulb: Wand2,
  "folder-kanban": FolderKanban,
  repeat: Repeat,
  target: Target,
  "graduation-cap": GraduationCap,
  "pen-line": PenLine,
};
function CategoryIcon({ iconKey, size = 17 }: { iconKey: string; size?: number }) {
  const Icon = CATEGORY_ICON_MAP[iconKey] ?? Sparkles;
  return <Icon size={size} strokeWidth={2.2} />;
}

function subjectById(subjects: Subject[], id: string | null): Subject | undefined {
  if (!id) return undefined;
  return subjects.find((s) => s.id === id);
}

// Recherche tolérante par nom (utilisée pour résoudre les actions proposées
// par l'IA, qui ne connaît que des noms lisibles, jamais d'identifiants).
// Essaie d'abord une correspondance exacte, puis une correspondance partielle.
function findByName<T>(items: T[], getName: (item: T) => string, query: unknown): T | undefined {
  if (typeof query !== "string" || !query.trim()) return undefined;
  const q = query.trim().toLowerCase();
  return (
    items.find((item) => getName(item).toLowerCase() === q) ||
    items.find((item) => getName(item).toLowerCase().includes(q))
  );
}

// ===========================================================================
// Petits composants réutilisables
// ===========================================================================

// Micro-interaction "count-up" inspirée du système d'origine : les valeurs
// numériques des cartes d'accueil s'animent depuis 0 plutôt que de
// s'afficher statiquement. Respecte prefers-reduced-motion.
function useCountUp(target: number, durationMs = 900): number {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      setDisplay(Math.round(target * easeOutCubic(progress)));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return display;
}

function InfoCard({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: LucideIcon;
  tone: "primary" | "accent" | "success" | "info";
  label: string;
  value: string | number;
}) {
  const animated = useCountUp(typeof value === "number" ? value : 0);
  return (
    <div className="bf-card">
      <div className={`bf-card__icon tone-${tone}`}>
        <Icon size={19} strokeWidth={2.2} />
      </div>
      <div className="bf-card__info">
        <h3>{label}</h3>
        <p>{typeof value === "number" ? animated : value}</p>
      </div>
    </div>
  );
}

// Etat vide illustré (icône colorée + titre + indice), pour remplacer un
// simple texte gris sur les listes principales — plus chaleureux, et
// l'occasion de varier les couleurs (chaque section a sa propre teinte).
function EmptyState({
  icon: Icon,
  tone,
  title,
  hint,
}: {
  icon: LucideIcon;
  tone: "primary" | "accent" | "cyan" | "magenta";
  title: string;
  hint?: string;
}) {
  return (
    <div className="bf-empty-state">
      <div className={`bf-empty-state__icon tone-${tone}`}>
        <Icon size={26} strokeWidth={1.8} />
      </div>
      <p className="bf-empty-state__title">{title}</p>
      {hint && <p className="bf-empty-state__hint">{hint}</p>}
    </div>
  );
}

// Indicateur de chargement pour les listes principales : évite d'afficher
// un état "vide" trompeur pendant la première récupération des données
// depuis D1 (avant, une liste réellement vide et une liste pas encore
// chargée rendaient exactement le même message).
function LoadingState({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="bf-empty-state" role="status" aria-live="polite">
      <div className="bf-empty-state__icon tone-primary bf-spin">
        <RefreshCcw size={22} strokeWidth={1.8} />
      </div>
      <p className="bf-empty-state__title">{label}</p>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  // Accessibilité : fermeture au clavier (Echap) et focus posé sur le
  // premier champ dès l'ouverture, pour les personnes qui naviguent sans
  // souris. Le titre est id-é pour être annoncé par les lecteurs d'écran
  // via aria-labelledby.
  const titleId = useRef(`bf-modal-title-${Math.random().toString(36).slice(2)}`).current;
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const focusable = modalRef.current?.querySelector<HTMLElement>(
      "input, textarea, select, button, [href], [tabindex]:not([tabindex='-1'])"
    );
    focusable?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="bf-modal-backdrop" onClick={onClose}>
      <div
        className="bf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// Confirmation avant suppression, pour toutes les suppressions déclenchées
// depuis les listes (matière, devoir, objectif, notion). Le bouton
// "Annuler" est le premier élément focusable du Modal, donc reçoit le
// focus par défaut : une touche Entrée accidentelle annule plutôt que de
// confirmer une action destructrice.
function ConfirmDialog({
  title,
  message,
  confirmLabel = "Supprimer",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="bf-confirm-dialog__message">{message}</p>
      <div className="bf-modal__actions">
        <button type="button" className="bf-btn ghost" onClick={onCancel}>
          Annuler
        </button>
        <button type="button" className="bf-btn danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// Liens "Me contacter" : affichés dans Paramètres. Icônes de marque réelles
// (react-icons/si) sur un badge aux couleurs du thème — juste l'icône,
// aucun numéro ni identifiant affiché à l'écran.
const CONTACT_LINKS = [
  { label: "WhatsApp", href: "https://wa.me/261383089721", icon: SiWhatsapp, tone: "whatsapp" as const },
  { label: "Gmail", href: "mailto:gracydanielrr@gmail.com", icon: SiGmail, tone: "gmail" as const },
];

function ContactLinks() {
  return (
    <div className="bf-contact__list">
      {CONTACT_LINKS.map((c) => (
        <a
          key={c.label}
          href={c.href}
          target="_blank"
          rel="noopener noreferrer"
          className="bf-contact__link"
          aria-label={c.label}
          title={c.label}
        >
          <span className={`bf-contact__icon tone-${c.tone}`}>
            <c.icon size={19} />
          </span>
          <span className="bf-contact__label">{c.label}</span>
          <ExternalLink size={14} className="bf-contact__external" />
        </a>
      ))}
    </div>
  );
}

// ===========================================================================
// Recherche globale (raccourci clavier "/")
// ===========================================================================

function SearchResultRow({ icon, title, onClick }: { icon: ReactNode; title: string; onClick: () => void }) {
  return (
    <button type="button" className="bf-search__result" onClick={onClick}>
      <span className="bf-search__result-icon">{icon}</span>
      <span className="bf-search__result-title">{title}</span>
      <ChevronRight size={14} className="bf-search__result-arrow" />
    </button>
  );
}

function SearchGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bf-search__group">
      <div className="bf-search__group-label">{label}</div>
      {children}
    </div>
  );
}

function GlobalSearchModal({
  subjects,
  homework,
  goals,
  notions,
  onNavigate,
  onClose,
}: {
  subjects: Subject[];
  homework: Homework[];
  goals: Goal[];
  notions: Notion[];
  onNavigate: (section: SectionId) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const results =
    q.length === 0
      ? null
      : {
          subjects: subjects.filter((s) => s.name.toLowerCase().includes(q)),
          homework: homework.filter((h) => h.title.toLowerCase().includes(q)),
          goals: goals.filter((g) => g.title.toLowerCase().includes(q)),
          notions: notions.filter((n) => n.name.toLowerCase().includes(q)),
          methods: STUDY_METHODS.filter((m) => m.name.toLowerCase().includes(q)),
        };

  const totalCount = results
    ? results.subjects.length + results.homework.length + results.goals.length + results.notions.length + results.methods.length
    : 0;

  return (
    <div className="bf-modal-backdrop" onClick={onClose}>
      <div className="bf-modal bf-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bf-search__input-row">
          <Search size={17} className="bf-search__icon" />
          <input
            type="text"
            autoFocus
            placeholder="Rechercher une matière, un devoir, un objectif, une notion, une méthode…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bf-search__input"
          />
          <button type="button" className="bf-search__close" onClick={onClose} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        <div className="bf-search__results">
          {!results ? (
            <div className="bf-empty">Commence à taper pour chercher dans toute l'application.</div>
          ) : totalCount === 0 ? (
            <div className="bf-empty">Aucun résultat pour « {query} ».</div>
          ) : (
            <>
              {results.subjects.length > 0 && (
                <SearchGroup label="Matières">
                  {results.subjects.map((s) => (
                    <SearchResultRow
                      key={s.id}
                      icon={<SubjectIcon iconKey={s.icon} size={16} />}
                      title={s.name}
                      onClick={() => onNavigate("subjects")}
                    />
                  ))}
                </SearchGroup>
              )}
              {results.homework.length > 0 && (
                <SearchGroup label="Devoirs">
                  {results.homework.map((h) => (
                    <SearchResultRow
                      key={h.id}
                      icon={<ClipboardList size={16} />}
                      title={h.title}
                      onClick={() => onNavigate("homework")}
                    />
                  ))}
                </SearchGroup>
              )}
              {results.goals.length > 0 && (
                <SearchGroup label="Objectifs">
                  {results.goals.map((g) => (
                    <SearchResultRow
                      key={g.id}
                      icon={<Target size={16} />}
                      title={g.title}
                      onClick={() => onNavigate("goals")}
                    />
                  ))}
                </SearchGroup>
              )}
              {results.notions.length > 0 && (
                <SearchGroup label="Notions">
                  {results.notions.map((n) => (
                    <SearchResultRow
                      key={n.id}
                      icon={<Puzzle size={16} />}
                      title={n.name}
                      onClick={() => onNavigate("notions")}
                    />
                  ))}
                </SearchGroup>
              )}
              {results.methods.length > 0 && (
                <SearchGroup label="Méthodes">
                  {results.methods.map((m) => (
                    <SearchResultRow
                      key={m.id}
                      icon={<Brain size={16} />}
                      title={m.name}
                      onClick={() => onNavigate("methods")}
                    />
                  ))}
                </SearchGroup>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// (Menu déroulant stylé "maison" : voir components/CustomSelect.tsx — extrait
// dans son propre fichier pour pouvoir être réutilisé par PomodoroTimer.tsx
// sans créer d'import circulaire avec ce fichier.)

// ===========================================================================
// Application principale
// ===========================================================================

type AuthMode = "checking" | "guest" | "account";

export default function App() {
  const initial = useMemo(() => loadAppData(), []);

  // --- Réinitialisation de mot de passe : lien reçu par email ---------------
  // Le token vit dans l'URL (?reset_token=...) ; on le lit une seule fois au
  // montage, puis on nettoie l'URL pour ne pas le laisser traîner dans
  // l'historique du navigateur une fois l'écran affiché.
  const [resetToken, setResetToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("reset_token");
  });

  // --- Page admin (génération de code de récupération) ----------------------
  // Cachée derrière ?admin=1, protégée par le mot de passe admin (secret
  // ADMIN_ACCESS_CODE côté serveur) — pas un lien de navigation visible.
  const [adminPanel] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("admin") === "1";
  });

  // --- Authentification : compte cloud (D1) ou mode local (invité) ----------
  const [authMode, setAuthMode] = useState<AuthMode>("checking");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [cloudAvailable, setCloudAvailable] = useState(true);
  // Vrai pendant la récupération initiale des données depuis D1 après
  // connexion à un compte, pour distinguer "en cours de chargement" de
  // "réellement vide" dans les listes (voir LoadingState).
  const [dataLoading, setDataLoading] = useState(false);

  const [user, setUser] = useState<UserProfile>(initial.user); // profil local (mode invité)
  const [theme, setTheme] = useState<ThemeMode>(initial.theme);
  const [settings, setSettings] = useState<AppSettings>(initial.settings);
  const [section, setSection] = useState<SectionId>("home");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);

  const [subjects, setSubjects] = useState<Subject[]>(initial.subjects);
  const [homework, setHomework] = useState<Homework[]>(initial.homework);
  const [goals, setGoals] = useState<Goal[]>(initial.goals);
  const [history, setHistory] = useState<HistoryEntry[]>(initial.history);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => loadChatHistoryFor(null));
  const [notions, setNotions] = useState<Notion[]>(() => loadNotions());
  const [studySessions, setStudySessions] = useState<StudySession[]>(() => loadStudySessions());
  const [events, setEvents] = useState<CalendarEvent[]>(() => loadEvents());
  const [favoriteMethodIds, setFavoriteMethodIds] = useState<string[]>(() => loadFavoriteMethodsFor(null));
  const [toasts, setToasts] = useState<{ id: string; message: string; tone: "success" | "info" | "danger" }[]>([]);

  const [subjectModal, setSubjectModal] = useState<Subject | "new" | null>(null);
  const [homeworkModal, setHomeworkModal] = useState<Homework | "new" | null>(null);
  const [goalModal, setGoalModal] = useState<Goal | "new" | null>(null);
  const [notionModal, setNotionModal] = useState<Notion | "new" | null>(null);
  const [eventModal, setEventModal] = useState<CalendarEvent | "new" | null>(null);
  const [calendarPrefillDate, setCalendarPrefillDate] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    kind: "subject" | "homework" | "goal" | "notion" | "event";
    id: string;
    title: string;
    message: string;
  } | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    subjects: Subject[];
    homework: Homework[];
    goals: Goal[];
    notions: Notion[];
    studySessions: StudySession[];
    events: CalendarEvent[];
    summary: string;
  } | null>(null);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [pendingSync, setPendingSync] = useState<PendingSyncOp[]>([]);
  const pendingSyncRef = useRef<PendingSyncOp[]>([]);

  // --- Installation PWA -------------------------------------------------------
  const [installAvailable, setInstallAvailable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const isIOS = useMemo(
    () => /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !("MSStream" in window),
    []
  );

  // Raccourci clavier "/" pour ouvrir la recherche globale, sauf si
  // l'utilisateur est déjà en train de taper dans un champ.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      e.preventDefault();
      setSearchOpen(true);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    function handleAvailable() {
      setInstallAvailable(true);
    }
    function handleInstalled() {
      setInstallAvailable(false);
    }
    window.addEventListener("bf:install-available", handleAvailable);
    window.addEventListener("bf:install-installed", handleInstalled);

    // L'évènement a pu être capturé avant même le montage de ce composant.
    if (window.__bfGetInstallPrompt?.()) setInstallAvailable(true);

    const standaloneQuery = window.matchMedia && window.matchMedia("(display-mode: standalone)");
    const updateStandalone = () => {
      const iosStandalone = (window.navigator as any).standalone === true;
      setIsStandalone(!!standaloneQuery?.matches || iosStandalone);
    };
    updateStandalone();
    standaloneQuery?.addEventListener?.("change", updateStandalone);

    return () => {
      window.removeEventListener("bf:install-available", handleAvailable);
      window.removeEventListener("bf:install-installed", handleInstalled);
      standaloneQuery?.removeEventListener?.("change", updateStandalone);
    };
  }, []);

  async function handleInstallClick() {
    const promptEvent = window.__bfGetInstallPrompt?.();
    if (!promptEvent) return;
    promptEvent.prompt();
    await promptEvent.userChoice.catch(() => {});
    window.__bfClearInstallPrompt?.();
    setInstallAvailable(false);
  }

  // Le site vitrine amène ici avec ?install=1 quand la personne a tapé sur
  // "Installer l'application" chez lui. On ne peut déclencher l'invite native
  // que depuis cette origine (jamais depuis le site vitrine, sur un autre
  // domaine) : dès que l'évènement beforeinstallprompt est disponible, on
  // l'ouvre nous-mêmes, sans exiger un second tap.
  const autoInstallRequestedRef = useRef(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("install") === "1"
  );

  useEffect(() => {
    if (!autoInstallRequestedRef.current || isStandalone || !installAvailable) return;
    autoInstallRequestedRef.current = false;
    handleInstallClick();
    const url = new URL(window.location.href);
    url.searchParams.delete("install");
    window.history.replaceState({}, "", url.toString());
  }, [installAvailable, isStandalone]);

  // Ambiance complète sélectionnée (si aucune, on reste sur thème clair/sombre classique)
  const activePalette = settings.themePaletteId
    ? fullPalettes.find((p) => p.id === settings.themePaletteId) ?? null
    : null;

  // --- Application du thème sur <html data-theme="..."> --------------------
  // Une ambiance complète impose son propre climat (clair ou sombre selon
  // son fond) et prend le pas sur le sélecteur jour/nuit/système, sans pour
  // autant écraser le choix de thème enregistré par l'utilisateur.
  useEffect(() => {
    const apply = () => {
      const prefersDark =
        window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      const isDark = activePalette
        ? isDarkColor(activePalette.bg)
        : theme === "dark" || (theme === "system" && prefersDark);
      document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    };
    apply();
    if (!activePalette && theme === "system" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme, activePalette]);

  // --- Couleurs personnalisées : ambiance complète ou duo primaire/accent ---
  useEffect(() => {
    const root = document.documentElement.style;
    const fullVarProps = [
      "--bf-bg",
      "--bf-bg-rgb",
      "--bf-bg-elevated",
      "--bf-card",
      "--bf-border",
      "--bf-text",
      "--bf-text-muted",
      "--bf-text-on-primary",
    ];

    if (activePalette) {
      const c = resolvePalette(activePalette);
      root.setProperty("--bf-bg", c.bg);
      root.setProperty("--bf-bg-rgb", c.bgRgb);
      root.setProperty("--bf-bg-elevated", c.bgElevated);
      root.setProperty("--bf-card", c.card);
      root.setProperty("--bf-border", c.border);
      root.setProperty("--bf-text", c.text);
      root.setProperty("--bf-text-muted", c.textMuted);
      root.setProperty("--bf-text-on-primary", c.textOnPrimary);
      root.setProperty("--bf-primary", c.primary);
      root.setProperty("--bf-primary-light", c.primaryLight);
      root.setProperty("--bf-primary-dark", c.primaryDark);
      root.setProperty("--bf-primary-darker", c.primaryDarker);
      root.setProperty("--bf-primary-rgb", c.primaryRgb);
      root.setProperty("--bf-accent", c.accent);
      root.setProperty("--bf-accent-dark", c.accentDark);
      root.setProperty("--bf-accent-rgb", c.accentRgb);
      return;
    }

    fullVarProps.forEach((prop) => root.removeProperty(prop));

    if (settings.customPrimaryColor) {
      const c = deriveColorSet(settings.customPrimaryColor);
      root.setProperty("--bf-primary", c.base);
      root.setProperty("--bf-primary-light", c.light);
      root.setProperty("--bf-primary-dark", c.dark);
      root.setProperty("--bf-primary-darker", c.darker);
      root.setProperty("--bf-primary-rgb", c.rgb);
    } else {
      root.removeProperty("--bf-primary");
      root.removeProperty("--bf-primary-light");
      root.removeProperty("--bf-primary-dark");
      root.removeProperty("--bf-primary-darker");
      root.removeProperty("--bf-primary-rgb");
    }
    if (settings.customAccentColor) {
      const c = deriveColorSet(settings.customAccentColor);
      root.setProperty("--bf-accent", c.base);
      root.setProperty("--bf-accent-dark", c.dark);
      root.setProperty("--bf-accent-rgb", c.rgb);
    } else {
      root.removeProperty("--bf-accent");
      root.removeProperty("--bf-accent-dark");
      root.removeProperty("--bf-accent-rgb");
    }
  }, [activePalette, settings.customPrimaryColor, settings.customAccentColor]);

  // --- Densité / arrondi global de l'interface ------------------------------
  useEffect(() => {
    const root = document.documentElement.style;
    const radiusScales: Record<RadiusStyle, [string, string, string]> = {
      compact: ["8px", "12px", "18px"],
      default: ["10px", "18px", "26px"],
      round: ["14px", "26px", "36px"],
    };
    const [sm, md, lg] = radiusScales[settings.radiusStyle] ?? radiusScales.default;
    root.setProperty("--bf-radius-sm", sm);
    root.setProperty("--bf-radius", md);
    root.setProperty("--bf-radius-lg", lg);
  }, [settings.radiusStyle]);

  // --- Persistance locale : sert de cache et de mode de secours -------------
  useEffect(() => saveUser(user), [user]);
  useEffect(() => {
    saveThemeFor(authMode === "account" ? authUser?.id ?? null : null, theme);
  }, [theme, authMode, authUser?.id]);
  useEffect(() => {
    const ok = saveSettingsFor(authMode === "account" ? authUser?.id ?? null : null, settings);
    if (!ok) {
      showToast(
        "Certains réglages (souvent une image de fond trop lourde) n'ont pas pu être enregistrés sur cet appareil. Essaie une image plus légère ou libère de l'espace de stockage.",
        "danger"
      );
    }
  }, [settings, authMode, authUser?.id]);
  useEffect(() => saveSubjectsFor(authMode === "account" ? authUser?.id ?? null : null, subjects), [
    subjects,
    authMode,
    authUser?.id,
  ]);
  useEffect(() => saveHomeworkFor(authMode === "account" ? authUser?.id ?? null : null, homework), [
    homework,
    authMode,
    authUser?.id,
  ]);
  useEffect(() => saveGoalsFor(authMode === "account" ? authUser?.id ?? null : null, goals), [
    goals,
    authMode,
    authUser?.id,
  ]);
  useEffect(() => {
    saveHistoryFor(authMode === "account" ? authUser?.id ?? null : null, history);
  }, [history, authMode, authUser?.id]);
  useEffect(() => {
    saveChatHistoryFor(authMode === "account" ? authUser?.id ?? null : null, chatMessages);
  }, [chatMessages, authMode, authUser?.id]);
  useEffect(() => saveNotionsFor(authMode === "account" ? authUser?.id ?? null : null, notions), [
    notions,
    authMode,
    authUser?.id,
  ]);
  useEffect(() => saveStudySessionsFor(authMode === "account" ? authUser?.id ?? null : null, studySessions), [
    studySessions,
    authMode,
    authUser?.id,
  ]);
  useEffect(() => saveEventsFor(authMode === "account" ? authUser?.id ?? null : null, events), [
    events,
    authMode,
    authUser?.id,
  ]);
  useEffect(() => {
    saveFavoriteMethodsFor(authMode === "account" ? authUser?.id ?? null : null, favoriteMethodIds);
  }, [favoriteMethodIds, authMode, authUser?.id]);

  // --- Notifications locales --------------------------------------------------
  // Nettoyage des marques de déduplication trop anciennes, une fois au montage.
  useEffect(() => {
    pruneOldNotifiedMarks();
  }, []);

  // Vérifie les devoirs/notions du jour et de demain : au montage, quand
  // l'onglet redevient visible, puis toutes les 10 minutes tant que l'app
  // reste ouverte. Ne fait rien tant que l'utilisateur n'a pas activé les
  // notifications dans les réglages ET accordé la permission au navigateur.
  useEffect(() => {
    if (!settings.notificationsEnabled) return;
    const run = () => {
      checkDueReminders(homework, notions).catch(() => {});
    };
    run();
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(run, 10 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, [settings.notificationsEnabled, homework, notions]);

  // Dépose un instantané des échéances pour le service worker (rappels
  // best-effort même app fermée, voir lib/notifications.ts) et tente
  // d'enregistrer une synchronisation périodique dès que l'utilisateur a
  // activé les notifications.
  useEffect(() => {
    if (!settings.notificationsEnabled) return;
    persistDueSnapshotForServiceWorker(homework, notions).catch(() => {});
  }, [settings.notificationsEnabled, homework, notions]);

  useEffect(() => {
    if (!settings.notificationsEnabled) return;
    registerPeriodicNotificationSync().catch(() => {});
  }, [settings.notificationsEnabled]);

  // --- Vérifie si une session compte existe déjà (cookie) au chargement -----
  useEffect(() => {
    let cancelled = false;
    apiMe()
      .then((u) => {
        if (cancelled) return;
        if (u) {
          setAuthUser(u);
          setAuthMode("account");
        } else {
          setAuthMode("guest");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCloudAvailable(false);
          setAuthMode("guest");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Charge les données depuis D1 une fois connecté par compte ------------
  useEffect(() => {
    if (authMode !== "account") return;
    // L'historique, le chat, les favoris et les réglages d'apparence restent
    // locaux (pas de synchro D1), mais doivent être propres à CE compte sur
    // CET appareil — jamais ceux du compte précédent ni du mode invité.
    setHistory(loadHistoryFor(authUser?.id ?? null));
    setChatMessages(loadChatHistoryFor(authUser?.id ?? null));
    setFavoriteMethodIds(loadFavoriteMethodsFor(authUser?.id ?? null));
    setSettings(loadSettingsFor(authUser?.id ?? null));
    setTheme(loadThemeFor(authUser?.id ?? null));
    let cancelled = false;
    setDataLoading(true);
    (async () => {
      try {
        const [s, h, g, n, ss, ev] = await Promise.all([
          apiListSubjects(),
          apiListHomework(),
          apiListGoals(),
          apiListNotions(),
          apiListStudySessions(),
          apiListEvents(),
        ]);
        if (cancelled) return;
        // Les matières de démarrage ne sont semées qu'une seule fois, juste
        // après une inscription — jamais simplement parce qu'une lecture
        // revient vide. Une liste vide peut être légitime (l'utilisateur a
        // tout supprimé) ou due à un aléa réseau passager : dans les deux
        // cas, écraser silencieusement les vraies données serait pire que
        // de laisser la liste vide telle quelle.
        if (s.length === 0 && justRegistered) {
          for (const sub of starterSubjects) {
            await apiUpsertSubject(sub).catch(() => {});
          }
          setSubjects(starterSubjects);
        } else {
          setSubjects(s);
        }
        setJustRegistered(false);
        setHomework(h);
        setGoals(g);
        setNotions(n);
        setStudySessions(ss);
        setEvents(ev);
        setCloudAvailable(true);
      } catch (err) {
        if (!cancelled) handleCloudError(err);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authMode, authUser?.id]);

  // --- Anti-flash de thème (voir index.html) --------------------------------
  // Mémorise l'identifiant du dernier compte connecté sur cet appareil (ou
  // l'efface en mode invité/déconnexion) pour que le script anti-flash sache,
  // dès le prochain chargement et avant même que React ne monte, sous quelle
  // clé aller chercher le thème réellement choisi par ce compte.
  useEffect(() => {
    if (authMode === "account" && authUser?.id) {
      rememberLastUserId(authUser.id);
    } else if (authMode === "guest") {
      rememberLastUserId(null);
      pendingSyncRef.current = [];
      setPendingSync([]);
    }
  }, [authMode, authUser?.id]);

  useEffect(() => {
    if (authMode === "account" && authUser?.id) {
      const stored = loadPendingSyncFor(authUser.id);
      if (stored.length > 0) {
        pendingSyncRef.current = stored;
        setPendingSync(stored);
        if (navigator.onLine) stored.forEach(flushSyncOp);
      }
    }
  }, [authMode, authUser?.id]);

  useEffect(() => {
    function goOnline() {
      setIsOnline(true);
      pendingSyncRef.current.forEach(flushSyncOp);
    }
    function goOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [authMode, authUser?.id]);

  function updatePendingSync(updater: (prev: PendingSyncOp[]) => PendingSyncOp[]) {
    const next = updater(pendingSyncRef.current);
    pendingSyncRef.current = next;
    setPendingSync(next);
    if (authMode === "account" && authUser?.id) {
      savePendingSyncFor(authUser.id, next);
    }
  }

  function flushSyncOp(op: PendingSyncOp) {
    executeSyncOp(op)
      .then(() => updatePendingSync((prev) => prev.filter((p) => p.key !== op.key)))
      .catch((err) => {
        if (!isNetworkError(err)) {
          updatePendingSync((prev) => prev.filter((p) => p.key !== op.key));
          handleCloudError(err);
        }
      });
  }

  function runSync(kind: PendingSyncOp["kind"], action: PendingSyncOp["action"], id: string, label: string, payload?: unknown) {
    const key = `${kind}:${id}`;
    const op: PendingSyncOp = { key, kind, action, id, label, payload };
    executeSyncOp(op)
      .then(() => updatePendingSync((prev) => prev.filter((p) => p.key !== key)))
      .catch((err) => {
        if (isNetworkError(err)) {
          updatePendingSync((prev) => [...prev.filter((p) => p.key !== key), op]);
        } else {
          handleCloudError(err);
        }
      });
  }

  function logEvent(label: string) {
    setHistory((prev) => [{ id: makeId("hist"), label, date: Date.now() }, ...prev].slice(0, 100));
    const tone: "success" | "info" = label.startsWith("Bienvenue") || label.includes("réinitialisées") ? "info" : "success";
    showToast(label, tone);
  }

  function showToast(message: string, tone: "success" | "info" | "danger" = "success") {
    const id = makeId("toast");
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }

  // Rend visible immédiatement tout échec de sauvegarde vers D1 — jusqu'ici
  // uniquement signalé par un petit badge discret dans la barre du haut,
  // trop facile à manquer pour se rendre compte qu'une donnée n'a pas été
  // réellement enregistrée.
  function handleCloudError(err: unknown) {
    setCloudAvailable(false);
    const detail = err instanceof Error ? err.message : String(err);
    showToast(`Sauvegarde cloud échouée : ${detail}`, "danger");
  }

  // --- Fonctions de mutation : mettent à jour l'état local ET, si un compte
  //     est actif, synchronisent avec D1 en tâche de fond (best-effort). -----

  function persistSubject(s: Subject) {
    setSubjects((prev) => {
      const exists = prev.some((p) => p.id === s.id);
      return exists ? prev.map((p) => (p.id === s.id ? s : p)) : [...prev, s];
    });
    logEvent(`Matière enregistrée : ${s.name}`);
    if (authMode === "account") runSync("subject", "upsert", s.id, s.name, s);
  }

  function removeSubject(id: string) {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
    setHomework((prev) => prev.map((h) => (h.subjectId === id ? { ...h, subjectId: null } : h)));
    setGoals((prev) => prev.map((g) => (g.subjectId === id ? { ...g, subjectId: null } : g)));
    logEvent("Matière supprimée");
    if (authMode === "account") runSync("subject", "delete", id, "suppression");
  }
  function persistHomework(h: Homework) {
    setHomework((prev) => {
      const exists = prev.some((p) => p.id === h.id);
      return exists ? prev.map((p) => (p.id === h.id ? h : p)) : [h, ...prev];
    });
    logEvent(`Devoir enregistré : ${h.title}`);
    if (authMode === "account") runSync("homework", "upsert", h.id, h.title, h);
  }

  function removeHomework(id: string) {
    setHomework((prev) => prev.filter((h) => h.id !== id));
    logEvent("Devoir supprimé");
    if (authMode === "account") runSync("homework", "delete", id, "suppression");
  }

  function spawnNextRecurrence(current: Homework): Homework | null {
    if (!current.recurrence || !current.dueDate) return null;
    const nextDue = nextRecurrenceDate(current.dueDate, current.recurrence);
    if (!nextDue) return null;
    return {
      id: makeId("hw"),
      title: current.title,
      subjectId: current.subjectId,
      dueDate: nextDue,
      status: "todo",
      notes: current.notes,
      subtasks: current.subtasks.map((s) => ({ ...s, id: makeId("subtask"), done: false })),
      recurrence: current.recurrence,
      createdAt: Date.now(),
    };
  }

  function cycleHomeworkStatus(id: string) {
    setHomework((prev) => {
      const current = prev.find((h) => h.id === id);
      if (!current) return prev;
      const next: HomeworkStatus =
        current.status === "todo" ? "in_progress" : current.status === "in_progress" ? "done" : "todo";
      const updated: Homework = { ...current, status: next };
      if (next === "done") logEvent(`Devoir terminé : ${current.title}`);
      if (authMode === "account") runSync("homework", "upsert", updated.id, updated.title, updated);

      const nextInstance = next === "done" ? spawnNextRecurrence(current) : null;
      if (nextInstance) {
        logEvent(`Prochaine occurrence créée : ${nextInstance.title}`);
        if (authMode === "account") runSync("homework", "upsert", nextInstance.id, nextInstance.title, nextInstance);
        return [nextInstance, ...prev.map((h) => (h.id === id ? updated : h))];
      }

      return prev.map((h) => (h.id === id ? updated : h));
    });
  }

  function persistGoal(g: Goal) {
    setGoals((prev) => {
      const exists = prev.some((p) => p.id === g.id);
      return exists ? prev.map((p) => (p.id === g.id ? g : p)) : [g, ...prev];
    });
    logEvent(`Objectif enregistré : ${g.title}`);
    if (authMode === "account") runSync("goal", "upsert", g.id, g.title, g);
  }

  function removeGoal(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    logEvent("Objectif supprimé");
    if (authMode === "account") runSync("goal", "delete", id, "suppression");
  }

  function toggleGoalDone(id: string) {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const done = !g.done;
        const updated = { ...g, done, progress: done ? 100 : g.progress };
        if (done) logEvent(`Objectif atteint : ${g.title}`);
        if (authMode === "account") runSync("goal", "upsert", updated.id, updated.title, updated);
        return updated;
      })
    );
  }

  function changeGoalProgress(id: string, progress: number) {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const updated = { ...g, progress, done: progress >= 100 };
        if (authMode === "account") runSync("goal", "upsert", updated.id, updated.title, updated);
        return updated;
      })
    );
  }

  // --- Notions ---------------------------------------------------------------

  function persistNotion(n: Notion) {
    setNotions((prev) => {
      const exists = prev.some((p) => p.id === n.id);
      return exists ? prev.map((p) => (p.id === n.id ? n : p)) : [n, ...prev];
    });
    logEvent(`Notion enregistrée : ${n.name}`);
    if (authMode === "account") runSync("notion", "upsert", n.id, n.name, n);
  }

  function removeNotion(id: string) {
    setNotions((prev) => prev.filter((n) => n.id !== id));
    logEvent("Notion supprimée");
    if (authMode === "account") runSync("notion", "delete", id, "suppression");
  }

  // --- Confirmation avant suppression -----------------------------------
  // Toutes les suppressions passent désormais par une confirmation
  // (voir ConfirmDialog) au lieu d'agir immédiatement au clic — la
  // suppression d'une matière en particulier est irréversible et affecte
  // aussi les devoirs/objectifs qui lui sont rattachés (ils sont
  // détachés, pas supprimés, mais mieux vaut le dire avant plutôt
  // qu'après).
  function requestDeleteSubject(id: string) {
    const s = subjects.find((x) => x.id === id);
    setPendingDelete({
      kind: "subject",
      id,
      title: "Supprimer cette matière ?",
      message: `« ${s?.name ?? "Cette matière"} » sera définitivement supprimée. Les devoirs et objectifs qui lui sont associés ne seront pas supprimés, mais deviendront « sans matière ».`,
    });
  }
  function requestDeleteHomework(id: string) {
    const h = homework.find((x) => x.id === id);
    setPendingDelete({
      kind: "homework",
      id,
      title: "Supprimer ce devoir ?",
      message: `« ${h?.title ?? "Ce devoir"} » sera définitivement supprimé.`,
    });
  }
  function requestDeleteGoal(id: string) {
    const g = goals.find((x) => x.id === id);
    setPendingDelete({
      kind: "goal",
      id,
      title: "Supprimer cet objectif ?",
      message: `« ${g?.title ?? "Cet objectif"} » sera définitivement supprimé.`,
    });
  }
  function requestDeleteNotion(id: string) {
    const n = notions.find((x) => x.id === id);
    setPendingDelete({
      kind: "notion",
      id,
      title: "Supprimer cette notion ?",
      message: `« ${n?.name ?? "Cette notion"} » sera définitivement supprimée, avec son historique de révision.`,
    });
  }
  function requestDeleteEvent(id: string) {
    const e = events.find((x) => x.id === id);
    setPendingDelete({
      kind: "event",
      id,
      title: "Supprimer cet événement ?",
      message: `« ${e?.title ?? "Cet événement"} » sera définitivement supprimé.`,
    });
  }
  function confirmPendingDelete() {
    if (!pendingDelete) return;
    const { kind, id } = pendingDelete;
    if (kind === "subject") removeSubject(id);
    else if (kind === "homework") removeHomework(id);
    else if (kind === "goal") removeGoal(id);
    else if (kind === "notion") removeNotion(id);
    else if (kind === "event") removeEvent(id);
    setPendingDelete(null);
  }

  // --- Export / Import JSON --------------------------------------------------
  // Sauvegarde/restauration manuelle de toutes les données au format JSON.
  // L'export part toujours de l'état actuellement en mémoire (déjà
  // synchronisé avec D1 en mode compte). L'import est une FUSION (upsert par
  // id, voir upsertById plus haut) et jamais un remplacement total : un id
  // déjà présent est écrasé par la version importée, un id inconnu est
  // ajouté — rien n'est jamais supprimé par un import. C'est cohérent avec
  // la façon dont le reste de l'app synchronise déjà (upsert côté Worker),
  // et ça évite qu'un import malencontreux efface tout d'un coup.
  function exportAllData() {
    const payload = {
      format: "benkyo-flow-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      subjects,
      homework,
      goals,
      notions,
      studySessions,
      events,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `benkyo-flow-sauvegarde-${isoDateDaysAgo(0)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logEvent("Sauvegarde téléchargée");
  }

  // Étape 1 : parse + valide le fichier choisi, prépare un résumé lisible,
  // et ouvre la confirmation (voir ConfirmDialog) — n'écrit encore rien.
  function requestImportData(raw: unknown) {
    if (!isRecord(raw)) {
      showToast("Fichier invalide : ce n'est pas une sauvegarde Benkyō Flow reconnue.", "danger");
      return;
    }

    const impSubjects = importableItems(raw.subjects).map(normalizeImportedSubject);
    const impHomework = importableItems(raw.homework).map(normalizeImportedHomework);
    const impGoals = importableItems(raw.goals).map(normalizeImportedGoal);
    const impNotions = importableItems(raw.notions).map(normalizeImportedNotion);
    const impSessions = importableItems(raw.studySessions).map(normalizeImportedStudySession);
    const impEvents = importableItems(raw.events).map(normalizeImportedEvent);

    const total =
      impSubjects.length + impHomework.length + impGoals.length + impNotions.length + impSessions.length + impEvents.length;
    if (total === 0) {
      showToast("Ce fichier ne contient aucune donnée reconnue à importer.", "danger");
      return;
    }

    const parts: string[] = [];
    if (impSubjects.length) parts.push(`${impSubjects.length} matière${impSubjects.length > 1 ? "s" : ""}`);
    if (impHomework.length) parts.push(`${impHomework.length} devoir${impHomework.length > 1 ? "s" : ""}`);
    if (impGoals.length) parts.push(`${impGoals.length} objectif${impGoals.length > 1 ? "s" : ""}`);
    if (impNotions.length) parts.push(`${impNotions.length} notion${impNotions.length > 1 ? "s" : ""}`);
    if (impSessions.length) parts.push(`${impSessions.length} session${impSessions.length > 1 ? "s" : ""} d'étude`);
    if (impEvents.length) parts.push(`${impEvents.length} événement${impEvents.length > 1 ? "s" : ""}`);

    setPendingImport({
      subjects: impSubjects,
      homework: impHomework,
      goals: impGoals,
      notions: impNotions,
      studySessions: impSessions,
      events: impEvents,
      summary: parts.join(", "),
    });
  }

  // Étape 2 : appelée seulement après confirmation explicite de l'utilisateur.
  function confirmPendingImport() {
    if (!pendingImport) return;
    const {
      subjects: impSubjects,
      homework: impHomework,
      goals: impGoals,
      notions: impNotions,
      studySessions: impSessions,
      events: impEvents,
    } = pendingImport;

    setSubjects((prev) => upsertById(prev, impSubjects));
    setHomework((prev) => upsertById(prev, impHomework));
    setGoals((prev) => upsertById(prev, impGoals));
    setNotions((prev) => upsertById(prev, impNotions));
    setStudySessions((prev) => upsertById(prev, impSessions));
    setEvents((prev) => upsertById(prev, impEvents));

    if (authMode === "account") {
      impSubjects.forEach((s) => runSync("subject", "upsert", s.id, s.name, s));
      impHomework.forEach((h) => runSync("homework", "upsert", h.id, h.title, h));
      impGoals.forEach((g) => runSync("goal", "upsert", g.id, g.title, g));
      impNotions.forEach((n) => runSync("notion", "upsert", n.id, n.name, n));
      impSessions.forEach((s) => runSync("studySession", "upsert", s.id, "session importée", s));
      impEvents.forEach((e) => runSync("event", "upsert", e.id, e.title, e));
    }

    logEvent(`Sauvegarde rechargée : ${pendingImport.summary}`);
    showToast(`Sauvegarde rechargée : ${pendingImport.summary}.`, "success");
    setPendingImport(null);
  }

  function markNotionReviewed(id: string, nextStatus?: NotionStatus) {
    setNotions((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const updated: Notion = { ...n, lastReviewedAt: Date.now(), status: nextStatus ?? n.status };
        if (authMode === "account") runSync("notion", "upsert", updated.id, updated.name, updated);
        return updated;
      })
    );
  }

  // Révision rapide depuis le panneau « Aujourd'hui » : fait avancer le
  // statut et la prochaine date de révision selon un schéma de répétition
  // espacée simple (voir lib/spacedRepetition.ts).
  function reviewNotionFromToday(id: string, outcome: ReviewOutcome) {
    setNotions((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const updated = reviewNotion(n, outcome);
        logEvent(outcome === "remembered" ? `Notion révisée : ${n.name}` : `À revoir bientôt : ${n.name}`);
        if (authMode === "account") runSync("notion", "upsert", updated.id, updated.name, updated);
        return updated;
      })
    );
  }

  // Marque un devoir comme terminé directement (raccourci depuis « Aujourd'hui »),
  // sans passer par le cycle todo → en cours → terminé → todo.
  function completeHomeworkFromToday(id: string) {
    setHomework((prev) => {
      const current = prev.find((h) => h.id === id);
      if (!current || current.status === "done") return prev;
      const updated: Homework = { ...current, status: "done" };
      logEvent(`Devoir terminé : ${current.title}`);
      if (authMode === "account") runSync("homework", "upsert", updated.id, updated.title, updated);

      const nextInstance = spawnNextRecurrence(current);
      if (nextInstance) {
        logEvent(`Prochaine occurrence créée : ${nextInstance.title}`);
        if (authMode === "account") runSync("homework", "upsert", nextInstance.id, nextInstance.title, nextInstance);
        return [nextInstance, ...prev.map((h) => (h.id === id ? updated : h))];
      }

      return prev.map((h) => (h.id === id ? updated : h));
    });
  }

  // --- Sessions d'étude --------------------------------------------------------

  function addStudySession(s: StudySession) {
    setStudySessions((prev) => [s, ...prev]);
    logEvent(`Session d'étude enregistrée (${s.minutes} min)`);
    if (authMode === "account") runSync("studySession", "upsert", s.id, "session d'étude", s);
  }

  function removeStudySession(id: string) {
    setStudySessions((prev) => prev.filter((s) => s.id !== id));
    if (authMode === "account") runSync("studySession", "delete", id, "suppression");
  }

  function persistEvent(e: CalendarEvent) {
    setEvents((prev) => {
      const exists = prev.some((p) => p.id === e.id);
      return exists ? prev.map((p) => (p.id === e.id ? e : p)) : [e, ...prev];
    });
    logEvent(`Événement enregistré : ${e.title}`);
    if (authMode === "account") runSync("event", "upsert", e.id, e.title, e);
  }

  function removeEvent(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    if (authMode === "account") runSync("event", "delete", id, "suppression");
  }

  // --- Favoris (bibliothèque de méthodes) — toujours locaux -------------------

  function toggleFavoriteMethod(id: string) {
    setFavoriteMethodIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // --- Contexte compact pour l'assistant IA -----------------------------------
  // Résumé court et à jour de l'espace de l'utilisateur, jamais la base
  // complète : quelques compteurs + une poignée d'éléments les plus
  // pertinents (échéances proches, objectifs actifs, notions à revoir).
  function buildAiContext(): string {
    const lines: string[] = [];
    lines.push(`Prénom : ${displayName}.`);

    if (subjects.length > 0) {
      lines.push(`Matières (${subjects.length}) : ${subjects.map((s) => s.name).join(", ")}.`);
    }

    const todoHw = homework.filter((h) => h.status !== "done");
    const lateHw = todoHw.filter((h) => h.dueDate && (daysUntil(h.dueDate) ?? 0) < 0);
    lines.push(`Devoirs : ${todoHw.length} à faire/en cours dont ${lateHw.length} en retard.`);
    const upcoming = todoHw
      .filter((h) => h.dueDate)
      .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
      .slice(0, 4)
      .map((h) => {
        const subj = subjectById(subjects, h.subjectId);
        return `${h.title}${subj ? ` (${subj.name})` : ""} — ${formatDateFR(h.dueDate)}`;
      });
    if (upcoming.length > 0) lines.push(`Prochaines échéances : ${upcoming.join(" ; ")}.`);

    const activeGoalsList = goals.filter((g) => !g.done).slice(0, 5);
    if (activeGoalsList.length > 0) {
      lines.push(`Objectifs en cours : ${activeGoalsList.map((g) => `${g.title} (${g.progress}%)`).join(", ")}.`);
    }

    const toReview = notions.filter((n) => n.status === "a_revoir" || n.status === "a_apprendre");
    if (toReview.length > 0) {
      lines.push(
        `Notions à revoir/apprendre (${toReview.length}) : ${toReview
          .slice(0, 6)
          .map((n) => n.name)
          .join(", ")}.`
      );
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const weekMinutes = studySessions
      .filter((s) => isWithinDays(s.date, 7))
      .reduce((sum, s) => sum + s.minutes, 0);
    const todayMinutes = studySessions.filter((s) => s.date === todayStr).reduce((sum, s) => sum + s.minutes, 0);
    if (weekMinutes > 0 || todayMinutes > 0) {
      lines.push(`Temps d'étude : ${todayMinutes} min aujourd'hui, ${weekMinutes} min cette semaine.`);
    }

    return lines.join("\n").slice(0, 1500);
  }

  // --- Actions proposées par l'IA : description lisible, résolution, exécution ---

  function describeAiAction(entity: AiActionEntity, operation: AiActionOperation, args: Record<string, unknown>): string {
    const name = typeof args.name === "string" ? args.name : typeof args.title === "string" ? args.title : "";
    const entityLabel: Record<AiActionEntity, string> = {
      subject: "la matière",
      homework: "le devoir",
      goal: "l'objectif",
      notion: "la notion",
      study_session: "la session d'étude",
    };
    if (operation === "create") {
      if (entity === "study_session") {
        const minutes = typeof args.minutes === "number" ? args.minutes : Number(args.minutes) || 0;
        const subj = typeof args.subject === "string" ? ` (${args.subject})` : "";
        return `Enregistrer une session d'étude de ${minutes} min${subj}`;
      }
      return `Créer ${entityLabel[entity]} « ${name || "?"} »`;
    }
    if (operation === "delete") {
      return `Supprimer ${entityLabel[entity]} « ${name || "?"} »`;
    }
    // update
    if (entity === "homework") return `Marquer le devoir « ${name || "?"} » comme « ${args.status ?? "?"} »`;
    if (entity === "goal") return `Mettre la progression de « ${name || "?"} » à ${args.progress ?? "?"}%`;
    if (entity === "notion") return `Passer la notion « ${name || "?"} » au statut « ${args.status ?? "?"} »`;
    return `Modifier ${entityLabel[entity]} « ${name || "?"} »`;
  }

  // Résout l'action (retrouve l'élément visé par son nom) et l'exécute via
  // les mêmes fonctions que celles utilisées par les formulaires manuels —
  // aucun chemin de code séparé, donc aucun risque d'incohérence.
  function resolveAndExecuteAiAction(action: AiAction): string {
    const { entity, operation, args } = action;
    const nameArg = typeof args.name === "string" ? args.name : typeof args.title === "string" ? args.title : "";
    const subjectArg = typeof args.subject === "string" ? args.subject : undefined;
    const subj = findByName(subjects, (s) => s.name, subjectArg);

    try {
      if (entity === "subject") {
        if (operation === "create") {
          if (!nameArg.trim()) return "Nom de matière manquant.";
          persistSubject({
            id: makeId("sub"),
            name: nameArg.trim(),
            color: "teal",
            icon: DEFAULT_SUBJECT_ICON_KEY,
            createdAt: Date.now(),
          });
          return `Matière « ${nameArg.trim()} » créée.`;
        }
        const target = findByName(subjects, (s) => s.name, nameArg);
        if (!target) return `Matière « ${nameArg} » introuvable.`;
        if (operation === "delete") {
          removeSubject(target.id);
          return `Matière « ${target.name} » supprimée.`;
        }
        return `Modification de matière non prise en charge pour l'instant.`;
      }

      if (entity === "homework") {
        if (operation === "create") {
          if (!nameArg.trim()) return "Titre du devoir manquant.";
          persistHomework({
            id: makeId("hw"),
            title: nameArg.trim(),
            subjectId: subj?.id ?? null,
            dueDate: typeof args.dueDate === "string" && args.dueDate ? args.dueDate : null,
            status: "todo",
            notes: "",
            subtasks: [],
            recurrence: null,
            createdAt: Date.now(),
          });
          return `Devoir « ${nameArg.trim()} » créé.`;
        }
        const target = findByName(homework, (h) => h.title, nameArg);
        if (!target) return `Devoir « ${nameArg} » introuvable.`;
        if (operation === "delete") {
          removeHomework(target.id);
          return `Devoir « ${target.title} » supprimé.`;
        }
        const status = typeof args.status === "string" ? args.status : "";
        const validStatus: HomeworkStatus[] = ["todo", "in_progress", "done"];
        const nextStatus = (validStatus as string[]).includes(status) ? (status as HomeworkStatus) : target.status;
        persistHomework({ ...target, status: nextStatus });
        return `Devoir « ${target.title} » mis à jour (${STATUS_LABEL[nextStatus]}).`;
      }

      if (entity === "goal") {
        if (operation === "create") {
          if (!nameArg.trim()) return "Titre de l'objectif manquant.";
          persistGoal({
            id: makeId("goal"),
            title: nameArg.trim(),
            subjectId: subj?.id ?? null,
            progress: 0,
            done: false,
            targetDate: null,
            createdAt: Date.now(),
          });
          return `Objectif « ${nameArg.trim()} » créé.`;
        }
        const target = findByName(goals, (g) => g.title, nameArg);
        if (!target) return `Objectif « ${nameArg} » introuvable.`;
        if (operation === "delete") {
          removeGoal(target.id);
          return `Objectif « ${target.title} » supprimé.`;
        }
        const progress = Math.max(0, Math.min(100, Number(args.progress)));
        if (Number.isFinite(progress)) {
          changeGoalProgress(target.id, progress);
          return `Objectif « ${target.title} » mis à jour (${progress}%).`;
        }
        return "Progression invalide.";
      }

      if (entity === "notion") {
        if (operation === "create") {
          if (!nameArg.trim()) return "Nom de la notion manquant.";
          persistNotion({
            id: makeId("notion"),
            name: nameArg.trim(),
            subjectId: subj?.id ?? null,
            chapter: "",
            status: "non_etudiee",
            lastReviewedAt: null,
            nextReviewAt: null,
            note: "",
            source: "",
            createdAt: Date.now(),
          });
          return `Notion « ${nameArg.trim()} » créée.`;
        }
        const target = findByName(notions, (n) => n.name, nameArg);
        if (!target) return `Notion « ${nameArg} » introuvable.`;
        if (operation === "delete") {
          removeNotion(target.id);
          return `Notion « ${target.name} » supprimée.`;
        }
        const status = typeof args.status === "string" ? args.status : "";
        const validStatuses = Object.keys(NOTION_STATUS_LABEL);
        if (validStatuses.includes(status)) {
          markNotionReviewed(target.id, status as NotionStatus);
          return `Notion « ${target.name} » mise à jour (${NOTION_STATUS_LABEL[status as NotionStatus]}).`;
        }
        return "Statut de notion invalide.";
      }

      if (entity === "study_session") {
        if (operation !== "create") return "Seul l'ajout de session d'étude est pris en charge.";
        const minutes = Number(args.minutes);
        if (!Number.isFinite(minutes) || minutes <= 0) return "Durée invalide.";
        addStudySession({
          id: makeId("study"),
          subjectId: subj?.id ?? null,
          minutes: Math.round(minutes),
          date: typeof args.date === "string" && args.date ? args.date : new Date().toISOString().slice(0, 10),
          createdAt: Date.now(),
        });
        return `Session de ${Math.round(minutes)} min enregistrée.`;
      }

      return "Action non reconnue.";
    } catch {
      return "Une erreur est survenue lors de l'exécution de cette action.";
    }
  }

  function confirmAiAction(messageId: string, actionId: string) {
    setChatMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || !m.actions) return m;
        return {
          ...m,
          actions: m.actions.map((a) => {
            if (a.id !== actionId || a.status !== "pending") return a;
            const resultLabel = resolveAndExecuteAiAction(a);
            const failed = /introuvable|manquant|invalide|erreur|non reconnue|non prise en charge/i.test(resultLabel);
            return { ...a, status: failed ? "error" : "done", resultLabel };
          }),
        };
      })
    );
  }

  function cancelAiAction(messageId: string, actionId: string) {
    setChatMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || !m.actions) return m;
        return {
          ...m,
          actions: m.actions.map((a) => (a.id === actionId && a.status === "pending" ? { ...a, status: "cancelled" } : a)),
        };
      })
    );
  }

  // Filet de sécurité côté app : si l'IA propose malgré tout de créer un
  // élément qui existe déjà (même nom), on ne laisse pas la carte proposer
  // une confirmation — on l'affiche directement comme ignorée, avec
  // l'explication. Ne dépend jamais du bon respect du prompt par le modèle.
  function findExistingDuplicate(raw: RawAiAction): string | null {
    if (raw.operation !== "create") return null;
    const name = typeof raw.args.name === "string" ? raw.args.name : typeof raw.args.title === "string" ? raw.args.title : "";
    if (!name.trim()) return null;
    const q = name.trim().toLowerCase();
    if (raw.entity === "subject" && subjects.some((s) => s.name.toLowerCase() === q)) {
      return `La matière « ${name.trim()} » existe déjà.`;
    }
    if (raw.entity === "homework" && homework.some((h) => h.title.toLowerCase() === q)) {
      return `Le devoir « ${name.trim()} » existe déjà.`;
    }
    if (raw.entity === "goal" && goals.some((g) => g.title.toLowerCase() === q)) {
      return `L'objectif « ${name.trim()} » existe déjà.`;
    }
    if (raw.entity === "notion" && notions.some((n) => n.name.toLowerCase() === q)) {
      return `La notion « ${name.trim()} » existe déjà.`;
    }
    return null;
  }

  async function sendChatMessage(text: string) {
    const userMessage: ChatMessage = { id: makeId("msg"), role: "user", content: text, createdAt: Date.now() };
    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);

    const { reply, actions: rawActions } = await apiChatSend(
      nextMessages.map((m) => ({ role: m.role, content: m.content })),
      buildAiContext()
    );

    const actions: AiAction[] = rawActions.map((raw: RawAiAction) => {
      const duplicate = findExistingDuplicate(raw);
      return {
        id: makeId("action"),
        entity: raw.entity,
        operation: raw.operation,
        args: raw.args,
        status: duplicate ? "cancelled" : "pending",
        description: describeAiAction(raw.entity, raw.operation, raw.args),
        resultLabel: duplicate ? `${duplicate} Proposition ignorée.` : undefined,
      };
    });

    setChatMessages((prev) => [
      ...prev,
      { id: makeId("msg"), role: "assistant", content: reply, createdAt: Date.now(), actions },
    ]);
  }

  async function handleLogout() {
    if (authMode === "account") {
      await apiLogout();
      setAuthUser(null);
      setAuthMode("guest");
      setSubjects(loadSubjectsFor(null));
      setHomework(loadHomeworkFor(null));
      setGoals(loadGoalsFor(null));
      setNotions(loadNotionsFor(null));
      setStudySessions(loadStudySessionsFor(null));
      setEvents(loadEventsFor(null));
      setHistory(loadHistoryFor(null));
      setChatMessages(loadChatHistoryFor(null));
      setFavoriteMethodIds(loadFavoriteMethodsFor(null));
      setSettings(loadSettingsFor(null));
      setTheme(loadThemeFor(null));
    } else {
      setUser((u) => ({ ...u, loggedIn: false }));
    }
  }

  // --- Page admin (génération de code de récupération) ----------------------
  // Aussi prioritaire : totalement indépendante de l'état de connexion.
  if (adminPanel) {
    return <AdminScreen />;
  }

  // --- Ecran de réinitialisation de mot de passe (lien reçu par email) ------
  // Prioritaire sur tout le reste, y compris l'écran de chargement : si
  // quelqu'un ouvre le lien alors qu'il est déjà connecté ailleurs sur cet
  // appareil, on affiche quand même l'écran de reset plutôt que de
  // l'ignorer silencieusement ou le faire attendre la vérification de
  // session en cours (qui ne le concerne pas).
  if (resetToken) {
    return (
      <ResetPasswordScreen
        token={resetToken}
        onDone={() => {
          // Nettoie l'URL (retire ?reset_token=...) sans recharger la page.
          const url = new URL(window.location.href);
          url.searchParams.delete("reset_token");
          window.history.replaceState({}, "", url.toString());
          setResetToken(null);
        }}
      />
    );
  }

  // --- Ecran de chargement (vérification de session) -------------------------
  if (authMode === "checking") {
    return (
      <div className="bf-auth">
        <div className="bf-auth__card">
          <div className="bf-auth__brand">
            <span className="bf-auth__brand-icon">
              <Sprout size={22} strokeWidth={2.2} />
            </span>
            Benkyō Flow
          </div>
          <p className="bf-auth__subtitle">Chargement…</p>
        </div>
      </div>
    );
  }

  const isLoggedIn = authMode === "account" || (authMode === "guest" && user.loggedIn);

  // --- Ecran de connexion / inscription / mode local -------------------------
  if (!isLoggedIn) {
    return (
      <AuthScreen
        cloudAvailable={cloudAvailable}
        installAvailable={installAvailable}
        isStandalone={isStandalone}
        isIOS={isIOS}
        onInstallClick={handleInstallClick}
        onRegister={async (email, password, name) => {
          const u = await apiRegister(email, password, name);
          setAuthUser(u);
          setAuthMode("account");
          setJustRegistered(true);
        }}
        onLogin={async (email, password) => {
          const u = await apiLogin(email, password);
          setAuthUser(u);
          setAuthMode("account");
        }}
        onGuestContinue={(name) => {
          setUser({ name, loggedIn: true });
          if (subjects.length === 0) setSubjects(starterSubjects);
          logEvent(`Bienvenue, ${name} !`);
        }}
      />
    );
  }

  const displayName = authMode === "account" ? authUser!.name : user.name;

  const dueSoon = homework
    .filter((h) => h.status !== "done" && h.dueDate)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
    .slice(0, 5);

  // --- Panneau « Aujourd'hui » : notions à réviser et devoirs dus -----------
  const todayStrForDue = todayISODate();
  const dueTodayNotions = notions.filter((n) => isNotionDueToday(n, todayStrForDue));
  const dueTodayHomework = homework.filter(
    (h) => h.status !== "done" && h.dueDate !== null && h.dueDate <= todayStrForDue
  );

  // --- Réglages du minuteur Pomodoro, dérivés des réglages génériques -------
  const pomodoroSettings: PomodoroSettings = {
    workMinutes: settings.pomodoroWorkMinutes,
    breakMinutes: settings.pomodoroBreakMinutes,
    longBreakMinutes: settings.pomodoroLongBreakMinutes,
    sessionsBeforeLongBreak: settings.pomodoroSessionsBeforeLongBreak,
  };
  function updatePomodoroSettings(p: PomodoroSettings) {
    setSettings((s) => ({
      ...s,
      pomodoroWorkMinutes: p.workMinutes,
      pomodoroBreakMinutes: p.breakMinutes,
      pomodoroLongBreakMinutes: p.longBreakMinutes,
      pomodoroSessionsBeforeLongBreak: p.sessionsBeforeLongBreak,
    }));
  }
  function updateCustomPomodoroPresets(presets: PomodoroPreset[]) {
    setSettings((s) => ({ ...s, customPomodoroPresets: presets }));
  }

  const activeGoals = goals.filter((g) => !g.done);
  const overallProgress =
    goals.length === 0 ? 0 : Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length);
  const studyStreak = computeStudyStreak(studySessions);

  return (
    <div className="bf-app">
      <aside
        className={`bf-sidebar ${settings.sidebarCollapsed ? "collapsed" : ""} ${mobileSidebarOpen ? "expanded" : ""}`}
        style={
          settings.sidebarBackgroundImage
            ? {
                backgroundImage: `linear-gradient(rgba(var(--bf-primary-rgb), ${
                  1 - settings.sidebarBackgroundOpacity / 100
                }), rgba(var(--bf-primary-rgb), ${
                  1 - settings.sidebarBackgroundOpacity / 100
                })), url(${settings.sidebarBackgroundImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <div className="bf-sidebar__header">
          <div className="bf-sidebar__brand">
            <span className="bf-sidebar__brand-mark">
              <Sprout size={18} strokeWidth={2.3} />
            </span>
            <span className="bf-sidebar__brand-text">Benkyō Flow</span>
          </div>
          <button
            className="bf-sidebar__toggle"
            aria-label={mobileSidebarOpen ? "Fermer le menu" : "Réduire ou agrandir le menu"}
            onClick={() => {
              if (window.innerWidth <= 860) {
                setMobileSidebarOpen(false);
              } else {
                setSettings((s) => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }));
              }
            }}
          >
            {mobileSidebarOpen ? <X size={17} /> : <MenuIcon size={17} />}
          </button>
        </div>
        <ul className="bf-menu">
          {SECTIONS.map((s) => (
            <li key={s.id} className={`bf-menu__item ${section === s.id ? "active" : ""}`}>
              <button
                className="bf-menu__button"
                onClick={() => {
                  setSection(s.id);
                  setMobileSidebarOpen(false);
                }}
              >
                <span className="bf-menu__icon">
                  <s.icon size={18} strokeWidth={2.1} />
                </span>
                <span className="bf-menu__label">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div
        className={`bf-sidebar-backdrop ${mobileSidebarOpen ? "visible" : ""}`}
        onClick={() => setMobileSidebarOpen(false)}
        aria-hidden="true"
      />

      <div
        className="bf-content"
        style={
          settings.appBackgroundImage
            ? {
                backgroundImage: `linear-gradient(rgba(var(--bf-bg-rgb), ${
                  1 - settings.appBackgroundOpacity / 100
                }), rgba(var(--bf-bg-rgb), ${
                  1 - settings.appBackgroundOpacity / 100
                })), url(${settings.appBackgroundImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundAttachment: "fixed",
              }
            : undefined
        }
      >
        <div className="bf-topbar">
          <button
            type="button"
            className="bf-mobile-menu-btn"
            aria-label="Ouvrir le menu"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <MenuIcon size={18} />
          </button>
          <div className="bf-topbar__title">{SECTIONS.find((s) => s.id === section)?.label}</div>
          <div className="bf-topbar__actions">
            <button
              type="button"
              className="bf-topbar__search-btn"
              onClick={() => setSearchOpen(true)}
              aria-label="Recherche globale"
              title="Recherche (appuie sur / )"
            >
              <Search size={16} />
            </button>
            <ThemeSwitch theme={theme} onChange={setTheme} />
            {installAvailable && !isStandalone && (
              <button className="bf-btn primary small bf-install-btn" onClick={handleInstallClick}>
                <Download size={15} /> <span className="bf-btn-label">Installer</span>
              </button>
            )}
            <span
              className={`bf-sync-badge ${!isOnline ? "offline" : pendingSync.length > 0 ? "pending" : ""}`}
              title={
                authMode === "account"
                  ? !isOnline
                    ? "Hors ligne — les modifications seront envoyées au retour de la connexion"
                    : pendingSync.length > 0
                    ? `${pendingSync.length} modification(s) en attente de synchronisation`
                    : cloudAvailable
                    ? "Compte synchronisé avec le cloud"
                    : "Compte — synchronisation momentanément indisponible"
                  : !isOnline
                  ? "Hors ligne (stockage local uniquement)"
                  : "Stockage local uniquement (cet appareil)"
              }
            >
              {!isOnline ? (
                <WifiOff size={13} />
              ) : authMode === "account" ? (
                pendingSync.length > 0 ? (
                  <RefreshCcw size={13} />
                ) : cloudAvailable ? (
                  <Cloud size={13} />
                ) : (
                  <AlertTriangle size={13} />
                )
              ) : (
                <HardDrive size={13} />
              )}
              {!isOnline
                ? "Hors ligne"
                : authMode === "account"
                ? pendingSync.length > 0
                  ? `${pendingSync.length} en attente`
                  : "Compte"
                : "Local"}
            </span>
            <div className="bf-user">
              <div className="bf-user__avatar">{displayName.slice(0, 1).toUpperCase()}</div>
              <span className="bf-user__name">{displayName}</span>
            </div>
            <button className="bf-logout" onClick={handleLogout} aria-label="Déconnexion">
              <span className="bf-btn-label">Déconnexion</span>
              <span className="bf-logout__icon">
                <LogOut size={15} />
              </span>
            </button>
          </div>
        </div>

        {section === "home" && (
          <HomeSection
            userName={displayName}
            subjects={subjects}
            homework={homework}
            goals={goals}
            dueSoon={dueSoon}
            activeGoalsCount={activeGoals.length}
            overallProgress={overallProgress}
            history={history}
            dueTodayNotions={dueTodayNotions}
            dueTodayHomework={dueTodayHomework}
            studyStreak={studyStreak.current}
            onReviewNotion={reviewNotionFromToday}
            onCompleteHomework={completeHomeworkFromToday}
            onGoTo={setSection}
          />
        )}

        {section === "subjects" && (
          <SubjectsSection
            subjects={subjects}
            homework={homework}
            isLoading={dataLoading}
            onAdd={() => setSubjectModal("new")}
            onEdit={(s) => setSubjectModal(s)}
            onDelete={requestDeleteSubject}
          />
        )}

        {section === "homework" && (
          <HomeworkSection
            homework={homework}
            subjects={subjects}
            isLoading={dataLoading}
            onAdd={() => setHomeworkModal("new")}
            onEdit={(h) => setHomeworkModal(h)}
            onDelete={requestDeleteHomework}
            onCycleStatus={cycleHomeworkStatus}
          />
        )}

        {section === "goals" && (
          <GoalsSection
            goals={goals}
            subjects={subjects}
            isLoading={dataLoading}
            onAdd={() => setGoalModal("new")}
            onEdit={(g) => setGoalModal(g)}
            onDelete={requestDeleteGoal}
            onToggleDone={toggleGoalDone}
            onProgressChange={changeGoalProgress}
          />
        )}

        {section === "notions" && (
          <NotionsSection
            notions={notions}
            subjects={subjects}
            isLoading={dataLoading}
            onAdd={() => setNotionModal("new")}
            onEdit={(n) => setNotionModal(n)}
            onDelete={requestDeleteNotion}
            onMarkReviewed={markNotionReviewed}
          />
        )}

        {section === "methods" && (
          <MethodsSection favoriteIds={favoriteMethodIds} onToggleFavorite={toggleFavoriteMethod} />
        )}

        {section === "session" && (
          <PomodoroTimer
            subjects={subjects}
            settings={pomodoroSettings}
            onSettingsChange={updatePomodoroSettings}
            customPresets={settings.customPomodoroPresets}
            onCustomPresetsChange={updateCustomPomodoroPresets}
            studySessions={studySessions}
            onAddStudySession={addStudySession}
            onToast={showToast}
          />
        )}

        {section === "planning" && (
          <PlanningSection homework={homework} subjects={subjects} studySessions={studySessions} ownerName={displayName} onToast={showToast} />
        )}

        {section === "calendar" && (
          <CalendarSection
            homework={homework}
            goals={goals}
            notions={notions}
            studySessions={studySessions}
            events={events}
            subjects={subjects}
            onAddHomeworkOn={(date) => {
              setCalendarPrefillDate(date);
              setHomeworkModal("new");
            }}
            onEditHomework={(h) => setHomeworkModal(h)}
            onAddEventOn={(date) => {
              setCalendarPrefillDate(date);
              setEventModal("new");
            }}
            onEditEvent={(e) => setEventModal(e)}
            onDeleteEvent={requestDeleteEvent}
          />
        )}

        {section === "progress" && (
          <ProgressSection
            subjects={subjects}
            homework={homework}
            goals={goals}
            notions={notions}
            studySessions={studySessions}
            studyStreak={studyStreak}
            onAddStudySession={addStudySession}
          />
        )}

        {section === "history" && <HistorySection history={history} />}

        {section === "assistant" && (
          <ChatSection
            messages={chatMessages}
            onSend={sendChatMessage}
            onClear={() => setChatMessages([])}
            onConfirmAction={confirmAiAction}
            onCancelAction={cancelAiAction}
          />
        )}

        {section === "settings" && (
          <SettingsSection
            authMode={authMode}
            authUser={authUser}
            user={user}
            theme={theme}
            settings={settings}
            onThemeChange={setTheme}
            onSettingsChange={setSettings}
            onRenameUser={(name) => setUser((u) => ({ ...u, name }))}
            installAvailable={installAvailable}
            isStandalone={isStandalone}
            isIOS={isIOS}
            onInstallClick={handleInstallClick}
            onToast={showToast}
            onExportData={exportAllData}
            onImportData={requestImportData}
            onResetData={
              authMode === "account"
                ? undefined
                : () => {
                    setSubjects(starterSubjects);
                    setHomework([]);
                    setGoals([]);
                    setHistory([]);
                    logEvent("Données réinitialisées");
                  }
            }
          />
        )}

        {section === "about" && <AboutSection />}
      </div>

      {subjectModal && (
        <SubjectFormModal
          subject={subjectModal === "new" ? null : subjectModal}
          onClose={() => setSubjectModal(null)}
          onSave={(s) => {
            persistSubject(s);
            setSubjectModal(null);
          }}
        />
      )}

      {homeworkModal && (
        <HomeworkFormModal
          homework={homeworkModal === "new" ? null : homeworkModal}
          subjects={subjects}
          prefillDueDate={homeworkModal === "new" ? calendarPrefillDate ?? undefined : undefined}
          onClose={() => {
            setHomeworkModal(null);
            setCalendarPrefillDate(null);
          }}
          onSave={(h) => {
            persistHomework(h);
            setHomeworkModal(null);
            setCalendarPrefillDate(null);
          }}
        />
      )}

      {goalModal && (
        <GoalFormModal
          goal={goalModal === "new" ? null : goalModal}
          subjects={subjects}
          onClose={() => setGoalModal(null)}
          onSave={(g) => {
            persistGoal(g);
            setGoalModal(null);
          }}
        />
      )}

      {notionModal && (
        <NotionFormModal
          notion={notionModal === "new" ? null : notionModal}
          subjects={subjects}
          onClose={() => setNotionModal(null)}
          onSave={(n) => {
            persistNotion(n);
            setNotionModal(null);
          }}
        />
      )}

      {eventModal && (
        <EventFormModal
          event={eventModal === "new" ? null : eventModal}
          subjects={subjects}
          prefillDate={eventModal === "new" ? calendarPrefillDate ?? undefined : undefined}
          onClose={() => {
            setEventModal(null);
            setCalendarPrefillDate(null);
          }}
          onSave={(e) => {
            persistEvent(e);
            setEventModal(null);
            setCalendarPrefillDate(null);
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={pendingDelete.title}
          message={pendingDelete.message}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmPendingDelete}
        />
      )}

      {pendingImport && (
        <ConfirmDialog
          title="Recharger cette sauvegarde ?"
          message={`Le fichier contient : ${pendingImport.summary}. Ce qui existe déjà chez toi sera mis à jour, le reste sera ajouté. Rien ne sera supprimé.`}
          confirmLabel="Recharger"
          onCancel={() => setPendingImport(null)}
          onConfirm={confirmPendingImport}
        />
      )}

      {searchOpen && (
        <GlobalSearchModal
          subjects={subjects}
          homework={homework}
          goals={goals}
          notions={notions}
          onNavigate={(s) => {
            setSection(s);
            setSearchOpen(false);
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}

      <div className="bf-toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`bf-toast tone-${t.tone}`}>
            {t.tone === "danger" ? (
              <AlertTriangle size={16} />
            ) : t.tone === "info" ? (
              <Sparkles size={16} />
            ) : (
              <CheckCircle2 size={16} />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// Ecran d'authentification (connexion / inscription / mode local)
// ===========================================================================

function AuthScreen({
  cloudAvailable,
  installAvailable,
  isStandalone,
  isIOS,
  onInstallClick,
  onRegister,
  onLogin,
  onGuestContinue,
}: {
  cloudAvailable: boolean;
  installAvailable: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  onInstallClick: () => void;
  onRegister: (email: string, password: string, name: string) => Promise<void>;
  onLogin: (email: string, password: string) => Promise<void>;
  onGuestContinue: (name: string) => void;
}) {
  const [mode, setMode] = useState<"login" | "register" | "guest" | "forgot">(cloudAvailable ? "login" : "guest");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Récupération manuelle : l'utilisateur nous contacte sur WhatsApp, on
  // vérifie son identité, on lui envoie un code depuis la page admin, il le
  // saisit ici avec son nouveau mot de passe.
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [forgotDone, setForgotDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "guest") {
      if (!name.trim()) return;
      onGuestContinue(name.trim());
      return;
    }

    if (mode === "forgot") {
      if (!recoveryCode.trim()) {
        setError("Merci de renseigner le code reçu par WhatsApp.");
        return;
      }
      if (newPassword.length < 8) {
        setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
        return;
      }
      if (newPassword !== newPasswordConfirm) {
        setError("Les deux mots de passe ne correspondent pas.");
        return;
      }
      setBusy(true);
      try {
        await apiResetPassword(recoveryCode.trim().toUpperCase(), newPassword);
        setForgotDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Code invalide ou expiré.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!email.trim() || !password) {
      setError("Merci de renseigner un email et un mot de passe.");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setError("Merci de renseigner un prénom.");
      return;
    }
    if (mode === "register" && password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "register") {
        await onRegister(email.trim().toLowerCase(), password, name.trim());
      } else {
        await onLogin(email.trim().toLowerCase(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  function resetForgotState() {
    setError(null);
    setForgotDone(false);
    setRecoveryCode("");
    setNewPassword("");
    setNewPasswordConfirm("");
  }

  return (
    <div className="bf-auth">
      <div className="bf-auth__card">
        <div className="bf-auth__brand">
          <span className="bf-auth__brand-icon">
            <Sprout size={22} strokeWidth={2.2} />
          </span>
          Benkyō Flow
        </div>
        <p className="bf-auth__subtitle">
          {mode === "guest"
            ? "Utilise Benkyō Flow sans compte : tes données restent sur cet appareil."
            : mode === "forgot"
            ? "Appuie sur le bouton WhatsApp ci-dessous pour recevoir ton code de récupération."
            : "Ton espace d'organisation scolaire, synchronisé entre tes appareils."}
        </p>

        {!isStandalone && installAvailable && (
          <button
            type="button"
            className="bf-btn primary small bf-install-btn"
            onClick={onInstallClick}
            style={{ marginBottom: 16, width: "100%", justifyContent: "center" }}
          >
            <Download size={15} /> Installer Benkyō Flow
          </button>
        )}
        {!isStandalone && !installAvailable && isIOS && (
          <p
            style={{
              fontSize: 13,
              color: "var(--bf-text-muted)",
              marginBottom: 16,
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--bf-surface-alt, rgba(0,0,0,0.04))",
            }}
          >
            Pour installer l'application : appuie sur <strong>Partager</strong> puis{" "}
            <strong>Sur l'écran d'accueil</strong>.
          </p>
        )}

        {cloudAvailable && mode !== "forgot" && (
          <div className="bf-auth__tabs">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setError(null);
              }}
            >
              Se connecter
            </button>
            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setError(null);
              }}
            >
              Créer un compte
            </button>
          </div>
        )}

        {mode === "forgot" && forgotDone ? (
          <div className="bf-field" role="status">
            <p>Ton mot de passe a bien été mis à jour. Tu peux maintenant te connecter avec le nouveau.</p>
            <button
              className="bf-btn primary"
              type="button"
              style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
              onClick={() => {
                resetForgotState();
                setMode("login");
              }}
            >
              Aller à la connexion
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            {mode === "register" && (
              <div className="bf-field">
                <label htmlFor="auth-name">Prénom</label>
                <input id="auth-name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
            )}

            {(mode === "login" || mode === "register") && (
              <div className="bf-field">
                <label htmlFor="auth-email">Email</label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus={mode === "login"}
                />
              </div>
            )}

            {(mode === "login" || mode === "register") && (
              <div className="bf-field">
                <label htmlFor="auth-password">Mot de passe</label>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                />
              </div>
            )}

            {mode === "login" && (
              <button
                type="button"
                className="bf-auth__guest-link"
                style={{ marginTop: 0 }}
                onClick={() => {
                  resetForgotState();
                  setMode("forgot");
                }}
              >
                Mot de passe oublié ?
              </button>
            )}

            {mode === "forgot" && (
              <>
                <a
                  href={`https://wa.me/261383089721?text=${encodeURIComponent(
                    "Bonjour, j'ai oublié mon mot de passe Benkyō Flow. Mon email de compte est : "
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bf-btn"
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    marginBottom: 14,
                    textDecoration: "none",
                    gap: 8,
                  }}
                >
                  <SiWhatsapp size={16} />
                  Recevoir mon code sur WhatsApp
                </a>

                <div className="bf-field">
                  <label htmlFor="recovery-code">Code reçu par WhatsApp</label>
                  <input
                    id="recovery-code"
                    type="text"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    autoCapitalize="characters"
                    autoFocus
                  />
                </div>
                <div className="bf-field">
                  <label htmlFor="new-password">Nouveau mot de passe</label>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                  />
                </div>
                <div className="bf-field">
                  <label htmlFor="new-password-confirm">Confirme le mot de passe</label>
                  <input
                    id="new-password-confirm"
                    type="password"
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    minLength={8}
                  />
                </div>
              </>
            )}

            {mode === "guest" && (
              <div className="bf-field">
                <label htmlFor="auth-guest-name">Prénom</label>
                <input
                  id="auth-guest-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            {error && <p className="bf-auth__error">{error}</p>}

            <button className="bf-btn primary" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
              {busy
                ? "Un instant…"
                : mode === "register"
                ? "Créer mon compte"
                : mode === "login"
                ? "Entrer dans Benkyō Flow"
                : mode === "forgot"
                ? "Réinitialiser le mot de passe"
                : "Continuer sans compte"}
            </button>
          </form>
        )}

        {mode === "forgot" ? (
          <button
            type="button"
            className="bf-auth__guest-link"
            onClick={() => {
              resetForgotState();
              setMode("login");
            }}
          >
            Retour à la connexion
          </button>
        ) : mode !== "guest" ? (
          <button
            type="button"
            className="bf-auth__guest-link"
            onClick={() => {
              setMode("guest");
              setError(null);
            }}
          >
            Continuer sans compte
          </button>
        ) : cloudAvailable ? (
          <button
            type="button"
            className="bf-auth__guest-link"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            J'ai déjà un compte / créer un compte
          </button>
        ) : (
          <p className="bf-auth__hint">Les comptes ne sont pas encore configurés sur ce déploiement.</p>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// Ecran de réinitialisation de mot de passe (arrivée via le lien reçu par email)
// ===========================================================================

function ResetPasswordScreen({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setBusy(true);
    try {
      await apiResetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bf-auth">
      <div className="bf-auth__card">
        <div className="bf-auth__brand">
          <span className="bf-auth__brand-icon">
            <Sprout size={22} strokeWidth={2.2} />
          </span>
          Benkyō Flow
        </div>

        {done ? (
          <>
            <p className="bf-auth__subtitle">
              Ton mot de passe a bien été mis à jour. Tu peux maintenant te connecter avec le nouveau.
            </p>
            <button
              className="bf-btn primary"
              type="button"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={onDone}
            >
              Aller à la connexion
            </button>
          </>
        ) : (
          <>
            <p className="bf-auth__subtitle">Choisis un nouveau mot de passe pour ton compte.</p>
            <form onSubmit={submit}>
              <div className="bf-field">
                <label htmlFor="reset-password">Nouveau mot de passe</label>
                <input
                  id="reset-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  autoFocus
                />
              </div>
              <div className="bf-field">
                <label htmlFor="reset-password-confirm">Confirme le mot de passe</label>
                <input
                  id="reset-password-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={8}
                />
              </div>

              {error && <p className="bf-auth__error">{error}</p>}

              <button
                className="bf-btn primary"
                type="submit"
                disabled={busy}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {busy ? "Un instant…" : "Réinitialiser le mot de passe"}
              </button>
            </form>
            <button type="button" className="bf-auth__guest-link" onClick={onDone}>
              Annuler et revenir à la connexion
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// Page admin — génère un code de récupération pour un compte donné
// (à envoyer manuellement par WhatsApp après vérification d'identité)
// ===========================================================================

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportAdminStatsCsv(stats: AdminStats) {
  const headers = [
    "email",
    "nom",
    "cree_le",
    "derniere_connexion",
    "derniere_activite",
    "minutes_etudiees",
    "matieres",
    "devoirs",
    "devoirs_faits",
    "objectifs",
    "notions",
    "notions_maitrisees",
    "evenements",
  ];
  const rows = stats.users.map((u) => [
    u.email,
    u.name,
    new Date(u.createdAt).toISOString(),
    u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : "",
    u.lastActivityAt ? new Date(u.lastActivityAt).toISOString() : "",
    u.totalStudyMinutes,
    u.subjectsCount,
    u.homeworkCount,
    u.homeworkDoneCount,
    u.goalsCount,
    u.notionsCount,
    u.notionsMasteredCount,
    u.eventsCount,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `benkyo-flow-comptes-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function AdminScreen() {
  const [adminAccessCode, setAdminAccessCode] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ code: string; expiresInMinutes: number } | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsBusy, setStatsBusy] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!adminAccessCode.trim() || !email.trim()) {
      setError("Renseigne le mot de passe admin et l'email du compte.");
      return;
    }

    setBusy(true);
    try {
      const res = await apiAdminGenerateCode(adminAccessCode.trim(), email.trim().toLowerCase());
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  async function loadStats() {
    setStatsError(null);
    if (!adminAccessCode.trim()) {
      setStatsError("Renseigne d'abord le mot de passe admin ci-dessus.");
      return;
    }
    setStatsBusy(true);
    try {
      const res = await apiAdminStats(adminAccessCode.trim());
      setStats(res);
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setStatsBusy(false);
    }
  }

  return (
    <div className="bf-auth">
      <div className="bf-auth__card">
        <div className="bf-auth__brand">
          <span className="bf-auth__brand-icon">
            <Sprout size={22} strokeWidth={2.2} />
          </span>
          Admin — Codes de récupération
        </div>
        <p className="bf-auth__subtitle">
          Génère un code de récupération pour un compte, puis envoie-le manuellement à la personne (WhatsApp) après
          avoir vérifié son identité.
        </p>

        <form onSubmit={submit}>
          <div className="bf-field">
            <label htmlFor="admin-access-code">Mot de passe admin</label>
            <input
              id="admin-access-code"
              type="password"
              value={adminAccessCode}
              onChange={(e) => setAdminAccessCode(e.target.value)}
              autoFocus
            />
          </div>
          <div className="bf-field">
            <label htmlFor="admin-email">Email du compte</label>
            <input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          {error && <p className="bf-auth__error">{error}</p>}

          <button className="bf-btn primary" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
            {busy ? "Un instant…" : "Générer un code"}
          </button>
        </form>

        {result && (
          <div className="bf-field" role="status" style={{ marginTop: 16 }}>
            <p style={{ fontSize: "1.6rem", fontWeight: 700, letterSpacing: "0.12em", textAlign: "center" }}>
              {result.code}
            </p>
            <p style={{ textAlign: "center" }}>
              Valable {result.expiresInMinutes} minutes, à usage unique. Envoie-le tel quel à la personne.
            </p>
          </div>
        )}

        <div className="bf-admin-stats">
          <div className="bf-admin-stats__header">
            <Users size={16} />
            <h3>Comptes &amp; utilisation</h3>
          </div>

          <button
            className="bf-btn ghost small"
            type="button"
            onClick={loadStats}
            disabled={statsBusy}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {statsBusy ? "Chargement…" : stats ? "Actualiser" : "Voir les statistiques"}
          </button>

          {statsError && <p className="bf-auth__error">{statsError}</p>}

          {stats && (
            <>
              <div className="bf-admin-stats__summary">
                <div className="bf-admin-stats__summary-item">
                  <span className="bf-admin-stats__summary-value">{stats.totalUsers}</span>
                  <span className="bf-admin-stats__summary-label">comptes au total</span>
                </div>
                <div className="bf-admin-stats__summary-item">
                  <span className="bf-admin-stats__summary-value">{stats.newUsersLast7Days}</span>
                  <span className="bf-admin-stats__summary-label">nouveaux sur 7 jours</span>
                </div>
                <div className="bf-admin-stats__summary-item">
                  <span className="bf-admin-stats__summary-value">{stats.newUsersLast30Days}</span>
                  <span className="bf-admin-stats__summary-label">nouveaux sur 30 jours</span>
                </div>
                <div className="bf-admin-stats__summary-item">
                  <span className="bf-admin-stats__summary-value">{stats.activeSessionsNow}</span>
                  <span className="bf-admin-stats__summary-label">sessions actives</span>
                </div>
                <div className="bf-admin-stats__summary-item">
                  <span className="bf-admin-stats__summary-value">{stats.activeUsersLast7Days}</span>
                  <span className="bf-admin-stats__summary-label">actifs sur 7 jours</span>
                </div>
                <div className="bf-admin-stats__summary-item">
                  <span className="bf-admin-stats__summary-value">{stats.activeUsersLast30Days}</span>
                  <span className="bf-admin-stats__summary-label">actifs sur 30 jours</span>
                </div>
                <div className="bf-admin-stats__summary-item">
                  <span className="bf-admin-stats__summary-value">{stats.totalStudyMinutesAll}</span>
                  <span className="bf-admin-stats__summary-label">minutes étudiées (total)</span>
                </div>
                <div className="bf-admin-stats__summary-item">
                  <span className="bf-admin-stats__summary-value">{stats.totalHomeworkAll}</span>
                  <span className="bf-admin-stats__summary-label">devoirs créés</span>
                </div>
                <div className="bf-admin-stats__summary-item">
                  <span className="bf-admin-stats__summary-value">{stats.totalNotionsAll}</span>
                  <span className="bf-admin-stats__summary-label">notions créées</span>
                </div>
                <div className="bf-admin-stats__summary-item">
                  <span className="bf-admin-stats__summary-value">{stats.totalGoalsAll}</span>
                  <span className="bf-admin-stats__summary-label">objectifs créés</span>
                </div>
                <div className="bf-admin-stats__summary-item">
                  <span className="bf-admin-stats__summary-value">{stats.totalEventsAll}</span>
                  <span className="bf-admin-stats__summary-label">événements créés</span>
                </div>
                <div className="bf-admin-stats__summary-item">
                  <span className="bf-admin-stats__summary-value">{stats.totalSubjectsAll}</span>
                  <span className="bf-admin-stats__summary-label">matières créées</span>
                </div>
              </div>

              <p className="bf-admin-stats__note">
                « Actif » = au moins un contenu créé sur la période (le schéma ne garde pas de date de modification,
                donc une simple relecture n'est pas comptée).
              </p>

              <div className="bf-admin-stats__chart-label">Inscriptions — 30 derniers jours</div>
              <div className="bf-admin-stats__chart">
                {stats.signupsLast30Days.map((d) => {
                  const max = Math.max(1, ...stats.signupsLast30Days.map((x) => x.count));
                  return (
                    <div key={d.day} className="bf-admin-stats__bar-wrap" title={`${d.day} : ${d.count}`}>
                      <div className="bf-admin-stats__bar-track">
                        <div
                          className="bf-admin-stats__bar"
                          style={{ height: d.count > 0 ? `${Math.max(6, (d.count / max) * 100)}%` : "2px" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                className="bf-btn ghost small"
                type="button"
                onClick={() => exportAdminStatsCsv(stats)}
                style={{ marginBottom: 14 }}
              >
                <Download size={14} /> <span className="bf-btn-label">Exporter en CSV</span>
              </button>

              <div className="bf-admin-stats__table-wrap">
                <table className="bf-admin-stats__table">
                  <thead>
                    <tr>
                      <th>Compte</th>
                      <th>Créé le</th>
                      <th>Dernière connexion</th>
                      <th>Dernière activité</th>
                      <th>Minutes étudiées</th>
                      <th>Matières</th>
                      <th>Devoirs (faits)</th>
                      <th>Objectifs</th>
                      <th>Notions (maîtrisées)</th>
                      <th>Événements</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.users.map((u: AdminUserStats) => (
                      <tr key={u.id}>
                        <td>
                          <div className="bf-admin-stats__account">
                            <strong>{u.name}</strong>
                            <span>{u.email}</span>
                          </div>
                        </td>
                        <td>{new Date(u.createdAt).toLocaleDateString("fr-FR")}</td>
                        <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("fr-FR") : "—"}</td>
                        <td>{u.lastActivityAt ? new Date(u.lastActivityAt).toLocaleDateString("fr-FR") : "—"}</td>
                        <td>{u.totalStudyMinutes}</td>
                        <td>{u.subjectsCount}</td>
                        <td>
                          {u.homeworkCount} ({u.homeworkDoneCount})
                        </td>
                        <td>{u.goalsCount}</td>
                        <td>
                          {u.notionsCount} ({u.notionsMasteredCount})
                        </td>
                        <td>{u.eventsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Sélecteur de thème
// ===========================================================================

function ThemeSwitch({ theme, onChange }: { theme: ThemeMode; onChange: (t: ThemeMode) => void }) {
  const options: { id: ThemeMode; icon: LucideIcon; label: string }[] = [
    { id: "light", icon: Sun, label: "Mode jour" },
    { id: "dark", icon: Moon, label: "Mode nuit" },
    { id: "system", icon: Monitor, label: "Mode système" },
  ];
  return (
    <div className="bf-theme-switch">
      {options.map((o) => (
        <button
          key={o.id}
          className={theme === o.id ? "active" : ""}
          title={o.label}
          aria-label={o.label}
          onClick={() => onChange(o.id)}
        >
          <o.icon size={15} strokeWidth={2.2} />
        </button>
      ))}
    </div>
  );
}

// ===========================================================================
// Section : Accueil
// ===========================================================================

function HomeSection({
  userName,
  subjects,
  homework,
  goals,
  dueSoon,
  activeGoalsCount,
  overallProgress,
  history,
  dueTodayNotions,
  dueTodayHomework,
  studyStreak,
  onReviewNotion,
  onCompleteHomework,
  onGoTo,
}: {
  userName: string;
  subjects: Subject[];
  homework: Homework[];
  goals: Goal[];
  dueSoon: Homework[];
  activeGoalsCount: number;
  overallProgress: number;
  history: HistoryEntry[];
  dueTodayNotions: Notion[];
  dueTodayHomework: Homework[];
  studyStreak: number;
  onReviewNotion: (id: string, outcome: ReviewOutcome) => void;
  onCompleteHomework: (id: string) => void;
  onGoTo: (s: SectionId) => void;
}) {
  const todoCount = homework.filter((h) => h.status !== "done").length;
  const hasTodayItems = dueTodayNotions.length > 0 || dueTodayHomework.length > 0;

  return (
    <>
      <div className="bf-page-heading">
        <div className="bf-page-heading__row">
          <div>
            <h1>Bonjour {userName}</h1>
            <p>Voici un aperçu de ton espace d'étude.</p>
          </div>
          {studyStreak > 0 && (
            <div className="bf-streak-badge" title={`${studyStreak} jour${studyStreak > 1 ? "s" : ""} d'affilée avec au moins une session d'étude`}>
              <Flame size={16} strokeWidth={2.2} />
              <span>
                {studyStreak} jour{studyStreak > 1 ? "s" : ""} d'affilée
              </span>
            </div>
          )}
        </div>
      </div>

      <div className={`bf-today-panel ${hasTodayItems ? "" : "bf-today-panel--empty"}`}>
        <div className="bf-today-panel__header">
          <div className="bf-today-panel__title">
            <Sparkles size={17} strokeWidth={2.2} />
            <h2>
              Aujourd'hui : {dueTodayNotions.length} notion{dueTodayNotions.length > 1 ? "s" : ""} à réviser,{" "}
              {dueTodayHomework.length} devoir{dueTodayHomework.length > 1 ? "s" : ""} dû{dueTodayHomework.length > 1 ? "s" : ""}
            </h2>
          </div>
          <button className="bf-btn primary small" onClick={() => onGoTo("session")}>
            <Timer size={15} /> <span className="bf-btn-label">Démarrer une session</span>
          </button>
        </div>

        {!hasTodayItems ? (
          <p className="bf-today-panel__empty-text">
            Rien à réviser ni à rendre aujourd'hui. Profites-en pour avancer sur tes objectifs, ou lance une session
            d'étude libre.
          </p>
        ) : (
          <div className="bf-today-panel__grid">
            {dueTodayHomework.length > 0 && (
              <div className="bf-today-panel__col">
                <div className="bf-today-panel__col-label">
                  <ClipboardList size={14} /> Devoirs dus
                </div>
                <div className="bf-list">
                  {dueTodayHomework.map((h) => {
                    const subject = subjectById(subjects, h.subjectId);
                    const days = daysUntil(h.dueDate);
                    return (
                      <div className="bf-item-row" key={h.id}>
                        <div className="bf-item-row__main">
                          <div className="bf-item-row__title">{h.title}</div>
                          <div className="bf-item-row__meta">
                            {subject && (
                              <span className="bf-inline-icon">
                                <SubjectIcon iconKey={subject.icon} size={12} /> {subject.name}
                              </span>
                            )}
                            {days !== null && days < 0 && <span className="bf-tag status-todo">En retard</span>}
                          </div>
                        </div>
                        <button className="bf-btn ghost small" onClick={() => onCompleteHomework(h.id)}>
                          <CheckCircle2 size={14} /> <span className="bf-btn-label">Terminé</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {dueTodayNotions.length > 0 && (
              <div className="bf-today-panel__col">
                <div className="bf-today-panel__col-label">
                  <Puzzle size={14} /> Notions à réviser
                </div>
                <div className="bf-list">
                  {dueTodayNotions.map((n) => {
                    const subject = subjectById(subjects, n.subjectId);
                    return (
                      <div className="bf-item-row" key={n.id}>
                        <div className="bf-item-row__main">
                          <div className="bf-item-row__title">{n.name}</div>
                          <div className="bf-item-row__meta">
                            {subject && (
                              <span className="bf-inline-icon">
                                <SubjectIcon iconKey={subject.icon} size={12} /> {subject.name}
                              </span>
                            )}
                            {n.chapter && <span>{n.chapter}</span>}
                          </div>
                        </div>
                        <div className="bf-today-panel__review-actions">
                          <button
                            className="bf-btn ghost small"
                            title="Oubliée : à revoir bientôt"
                            onClick={() => onReviewNotion(n.id, "forgot")}
                          >
                            <RefreshCcw size={14} />
                          </button>
                          <button
                            className="bf-btn ghost small"
                            title="Sue : la prochaine révision sera plus espacée"
                            onClick={() => onReviewNotion(n.id, "remembered")}
                          >
                            <CheckCircle2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bf-info-cards">
        <InfoCard icon={BookOpen} tone="primary" label="Matières" value={subjects.length} />
        <InfoCard icon={ClipboardList} tone="accent" label="Devoirs à faire" value={todoCount} />
        <InfoCard icon={Target} tone="success" label="Objectifs en cours" value={activeGoalsCount} />
        <InfoCard icon={BarChart3} tone="info" label="Progression générale" value={`${overallProgress}%`} />
      </div>

      <div className="bf-two-col">
        <div className="bf-panel">
          <div className="bf-panel__header">
            <h2>Prochaines échéances</h2>
            <button className="bf-btn ghost small" onClick={() => onGoTo("homework")}>
              Voir les devoirs
            </button>
          </div>
          {dueSoon.length === 0 ? (
            <div className="bf-empty">Aucune échéance pour le moment. Ajoute un devoir pour commencer.</div>
          ) : (
            <div className="bf-list">
              {dueSoon.map((h) => {
                const subject = subjectById(subjects, h.subjectId);
                const days = daysUntil(h.dueDate);
                return (
                  <div className="bf-item-row" key={h.id}>
                    <div className="bf-item-row__main">
                      <div className="bf-item-row__title">{h.title}</div>
                      <div className="bf-item-row__meta">
                        {subject && <span className="bf-inline-icon"><SubjectIcon iconKey={subject.icon} size={12} /> {subject.name}</span>}
                        <span>{formatDateFR(h.dueDate)}</span>
                        {days !== null && (
                          <span className={days < 0 ? "bf-tag status-todo" : "bf-tag status-in_progress"}>
                            {days < 0 ? "En retard" : days === 0 ? "Aujourd'hui" : `Dans ${days} j`}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`bf-tag status-${h.status}`}>{STATUS_LABEL[h.status]}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bf-panel">
          <div className="bf-panel__header">
            <h2>Activité récente</h2>
            <button className="bf-btn ghost small" onClick={() => onGoTo("history")}>
              Tout l'historique
            </button>
          </div>
          {history.length === 0 ? (
            <div className="bf-empty">Ton activité apparaîtra ici au fil de ton utilisation.</div>
          ) : (
            <div className="bf-list">
              {history.slice(0, 6).map((h) => (
                <div className="bf-item-row" key={h.id}>
                  <div className="bf-item-row__main">
                    <div className="bf-item-row__title">{h.label}</div>
                    <div className="bf-item-row__meta">
                      {new Date(h.date).toLocaleString("fr-FR")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Objectifs en cours</h2>
          <button className="bf-btn ghost small" onClick={() => onGoTo("goals")}>
            Gérer les objectifs
          </button>
        </div>
        {goals.filter((g) => !g.done).length === 0 ? (
          <div className="bf-empty">Aucun objectif en cours. Fixe-toi un premier objectif !</div>
        ) : (
          <div className="bf-list">
            {goals
              .filter((g) => !g.done)
              .slice(0, 4)
              .map((g) => (
                <div className="bf-item-row" key={g.id} style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <div className="bf-item-row__title">{g.title}</div>
                  <div className="bf-progress-bar">
                    <div className="bf-progress-bar__fill" style={{ width: `${g.progress}%` }} />
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </>
  );
}

// ===========================================================================
// Section : Matières
// ===========================================================================

function SubjectsSection({
  subjects,
  homework,
  isLoading = false,
  onAdd,
  onEdit,
  onDelete,
}: {
  subjects: Subject[];
  homework: Homework[];
  isLoading?: boolean;
  onAdd: () => void;
  onEdit: (s: Subject) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div className="bf-page-heading">
        <h1>Matières</h1>
        <p>Organise tes matières et personnalise-les à ta façon.</p>
      </div>
      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Toutes les matières ({subjects.length})</h2>
          <button className="bf-btn primary small" onClick={onAdd}>
            + Ajouter une matière
          </button>
        </div>
        {isLoading ? (
          <LoadingState label="Chargement des matières…" />
        ) : subjects.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            tone="primary"
            title="Aucune matière pour l'instant"
            hint="Ajoute ta première matière pour commencer."
          />
        ) : (
          <div className="bf-subject-grid" role="list">
            {subjects.map((s) => {
              const count = homework.filter((h) => h.subjectId === s.id && h.status !== "done").length;
              return (
                <div className="bf-subject-card" role="listitem" key={s.id}>
                  <div className="bf-subject-card__top">
                    <div className={`bf-subject-dot swatch-${s.color}`}><SubjectIcon iconKey={s.icon} size={17} /></div>
                    <div style={{ minWidth: 0 }}>
                      <div className="bf-subject-card__name">{s.name}</div>
                      <div className="bf-subject-card__meta">{count} devoir(s) en attente</div>
                    </div>
                  </div>
                  <div className="bf-subject-card__actions">
                    <button className="bf-btn ghost small" onClick={() => onEdit(s)} aria-label={`Modifier « ${s.name} »`}>
                      Modifier
                    </button>
                    <button className="bf-btn danger small" onClick={() => onDelete(s.id)} aria-label={`Supprimer « ${s.name} »`}>
                      Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function SubjectFormModal({
  subject,
  onClose,
  onSave,
}: {
  subject: Subject | null;
  onClose: () => void;
  onSave: (s: Subject) => void;
}) {
  const [name, setName] = useState(subject?.name ?? "");
  const [color, setColor] = useState<SubjectColor>(subject?.color ?? "teal");
  const [icon, setIcon] = useState(
    subject?.icon && SUBJECT_ICON_KEYS.includes(subject.icon) ? subject.icon : DEFAULT_SUBJECT_ICON_KEY
  );
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <Modal title={subject ? "Modifier la matière" : "Nouvelle matière"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) {
            setFormError("Merci de renseigner un nom pour cette matière.");
            return;
          }
          setFormError(null);
          onSave({
            id: subject?.id ?? makeId("sub"),
            name: name.trim(),
            color,
            icon,
            createdAt: subject?.createdAt ?? Date.now(),
          });
        }}
      >
        {formError && (
          <p className="bf-form-error" id="s-name-error" role="alert">
            {formError}
          </p>
        )}
        <div className="bf-field">
          <label htmlFor="s-name">Nom de la matière</label>
          <input
            id="s-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            aria-invalid={!!formError}
            aria-describedby={formError ? "s-name-error" : undefined}
          />
        </div>
        <div className="bf-field">
          <label>Icône</label>
          <div className="bf-icon-picker">
            {SUBJECT_ICON_KEYS.map((key) => (
              <button
                type="button"
                key={key}
                className={`bf-icon-swatch swatch-${color} ${icon === key ? "selected" : ""}`}
                onClick={() => setIcon(key)}
                aria-label={key}
              >
                <SubjectIcon iconKey={key} size={17} />
              </button>
            ))}
          </div>
        </div>
        <div className="bf-field">
          <label>Couleur</label>
          <div className="bf-color-picker">
            {SUBJECT_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={`bf-color-swatch swatch-${c} ${color === c ? "selected" : ""}`}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
          </div>
        </div>
        <div className="bf-modal__actions">
          <button type="button" className="bf-btn ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="bf-btn primary">
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ===========================================================================
// Section : Devoirs
// ===========================================================================

type HomeworkSortKey = "dueDate" | "dueDateDesc" | "title" | "status";

const HOMEWORK_SORT_OPTIONS: { value: HomeworkSortKey; label: string }[] = [
  { value: "dueDate", label: "Échéance (proche → loin)" },
  { value: "dueDateDesc", label: "Échéance (loin → proche)" },
  { value: "title", label: "Titre (A → Z)" },
  { value: "status", label: "Statut" },
];

const HOMEWORK_PAGE_SIZE = 8;

function HomeworkSection({
  homework,
  subjects,
  isLoading = false,
  onAdd,
  onEdit,
  onDelete,
  onCycleStatus,
}: {
  homework: Homework[];
  subjects: Subject[];
  isLoading?: boolean;
  onAdd: () => void;
  onEdit: (h: Homework) => void;
  onDelete: (id: string) => void;
  onCycleStatus: (id: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | HomeworkStatus>("all");
  const [filterSubject, setFilterSubject] = useState("");
  const [sortKey, setSortKey] = useState<HomeworkSortKey>("dueDate");
  const [page, setPage] = useState(1);

  const filtered = homework.filter((h) => {
    if (filter !== "all" && h.status !== filter) return false;
    if (filterSubject && h.subjectId !== filterSubject) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "title") return a.title.localeCompare(b.title, "fr");
    if (sortKey === "status") return a.status.localeCompare(b.status);
    // Échéances : les devoirs sans date sont toujours relégués en fin de
    // liste, quel que soit le sens choisi (proche→loin ou loin→proche).
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    if (a.dueDate === b.dueDate) return 0;
    const cmp = a.dueDate < b.dueDate ? -1 : 1;
    return sortKey === "dueDateDesc" ? -cmp : cmp;
  });

  // Remet la pagination à la première page dès que les filtres/tri changent,
  // pour éviter de se retrouver bloqué sur une page vide.
  useEffect(() => {
    setPage(1);
  }, [filter, filterSubject, sortKey]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / HOMEWORK_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginated = sorted.slice((currentPage - 1) * HOMEWORK_PAGE_SIZE, currentPage * HOMEWORK_PAGE_SIZE);

  return (
    <>
      <div className="bf-page-heading">
        <h1>Devoirs</h1>
        <p>Suis l'avancement de tes devoirs, du premier brouillon jusqu'au rendu.</p>
      </div>
      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Liste des devoirs ({homework.length})</h2>
          <div className="bf-panel__toolbar">
            <div className="bf-filter-chips" role="group" aria-label="Filtrer par statut">
              {(
                [
                  { value: "all", label: "Tous" },
                  { value: "todo", label: "À faire" },
                  { value: "in_progress", label: "En cours" },
                  { value: "done", label: "Terminé" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`bf-chip ${filter === opt.value ? "active" : ""}`}
                  aria-pressed={filter === opt.value}
                  onClick={() => setFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <CustomSelect
              value={filterSubject}
              onChange={setFilterSubject}
              options={[{ value: "", label: "Toutes les matières" }, ...subjects.map((s) => ({ value: s.id, label: s.name }))]}
              ariaLabel="Filtrer par matière"
            />
            <CustomSelect
              value={sortKey}
              onChange={(v) => setSortKey(v as HomeworkSortKey)}
              options={HOMEWORK_SORT_OPTIONS}
              ariaLabel="Trier les devoirs"
            />
            <button className="bf-btn primary small" onClick={onAdd}>
              + Nouveau devoir
            </button>
          </div>
        </div>
        {isLoading ? (
          <LoadingState label="Chargement des devoirs…" />
        ) : sorted.length === 0 ? (
          homework.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              tone="accent"
              title="Aucun devoir ici"
              hint="Ajoute-en un pour t'organiser."
            />
          ) : (
            <div className="bf-empty">Aucun devoir ne correspond à ces filtres.</div>
          )
        ) : (
          <>
            <div className="bf-list" role="list">
              {paginated.map((h) => {
                const subject = subjectById(subjects, h.subjectId);
                return (
                  <div className="bf-item-row" role="listitem" key={h.id}>
                    <div className="bf-item-row__main">
                      <div className="bf-item-row__title">{h.title}</div>
                      <div className="bf-item-row__meta">
                        {subject && <span className="bf-inline-icon"><SubjectIcon iconKey={subject.icon} size={12} /> {subject.name}</span>}
                        <span>{formatDateFR(h.dueDate)}</span>
                        {h.subtasks.length > 0 && (
                          <span className="bf-inline-icon">
                            <ListChecks size={12} /> {h.subtasks.filter((s) => s.done).length}/{h.subtasks.length}
                          </span>
                        )}
                        {h.recurrence && (
                          <span className="bf-inline-icon" title="Devoir récurrent">
                            <Repeat size={12} /> {formatRecurrenceLabel(h.recurrence)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className={`bf-tag status-${h.status}`}
                      style={{ border: "none", cursor: "pointer" }}
                      onClick={() => onCycleStatus(h.id)}
                      aria-label={`Statut de « ${h.title} » : ${STATUS_LABEL[h.status]}. Cliquer pour changer.`}
                      title="Changer le statut"
                    >
                      {STATUS_LABEL[h.status]}
                    </button>
                    <div className="bf-item-row__actions">
                      <button className="bf-btn ghost small" onClick={() => onEdit(h)} aria-label={`Modifier « ${h.title} »`}>
                        Modifier
                      </button>
                      <button className="bf-btn danger small" onClick={() => onDelete(h.id)} aria-label={`Supprimer « ${h.title} »`}>
                        Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {pageCount > 1 && (
              <nav className="bf-pagination" aria-label="Pagination des devoirs">
                <button
                  type="button"
                  className="bf-btn ghost small"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Page précédente"
                >
                  Précédent
                </button>
                <span className="bf-pagination__status" aria-live="polite">
                  Page {currentPage} / {pageCount}
                </span>
                <button
                  type="button"
                  className="bf-btn ghost small"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={currentPage === pageCount}
                  aria-label="Page suivante"
                >
                  Suivant
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </>
  );
}

function HomeworkFormModal({
  homework,
  subjects,
  prefillDueDate,
  onClose,
  onSave,
}: {
  homework: Homework | null;
  subjects: Subject[];
  prefillDueDate?: string;
  onClose: () => void;
  onSave: (h: Homework) => void;
}) {
  const [title, setTitle] = useState(homework?.title ?? "");
  const [subjectId, setSubjectId] = useState<string>(homework?.subjectId ?? "");
  const [dueDate, setDueDate] = useState(homework?.dueDate ?? prefillDueDate ?? "");
  const [status, setStatus] = useState<HomeworkStatus>(homework?.status ?? "todo");
  const [notes, setNotes] = useState(homework?.notes ?? "");
  const [subtasks, setSubtasks] = useState<HomeworkSubtask[]>(homework?.subtasks ?? []);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(!!homework?.recurrence);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<HomeworkRecurrence["frequency"]>(
    homework?.recurrence?.frequency ?? "weekly"
  );
  const [recurrenceInterval, setRecurrenceInterval] = useState(homework?.recurrence?.interval ?? 1);
  const [formError, setFormError] = useState<string | null>(null);

  function addSubtask() {
    const title = newSubtaskTitle.trim();
    if (!title) return;
    setSubtasks((prev) => [...prev, { id: makeId("subtask"), title, done: false }]);
    setNewSubtaskTitle("");
  }
  function toggleSubtask(id: string) {
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));
  }
  function removeSubtask(id: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <Modal title={homework ? "Modifier le devoir" : "Nouveau devoir"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) {
            setFormError("Merci de renseigner un titre pour ce devoir.");
            return;
          }
          setFormError(null);
          onSave({
            id: homework?.id ?? makeId("hw"),
            title: title.trim(),
            subjectId: subjectId || null,
            dueDate: dueDate || null,
            status,
            notes: notes.trim(),
            subtasks,
            recurrence:
              recurrenceEnabled && dueDate && recurrenceInterval > 0
                ? { frequency: recurrenceFrequency, interval: Math.floor(recurrenceInterval) }
                : null,
            createdAt: homework?.createdAt ?? Date.now(),
          });
        }}
      >
        {formError && (
          <p className="bf-form-error" id="hw-title-error" role="alert">
            {formError}
          </p>
        )}
        <div className="bf-field">
          <label htmlFor="hw-title">Titre</label>
          <input
            id="hw-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            aria-invalid={!!formError}
            aria-describedby={formError ? "hw-title-error" : undefined}
          />
        </div>
        <div className="bf-form-row">
          <div className="bf-field">
            <label htmlFor="hw-subject">Matière</label>
            <CustomSelect
              id="hw-subject"
              value={subjectId}
              onChange={setSubjectId}
              options={[{ value: "", label: "Aucune" }, ...subjects.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </div>
          <div className="bf-field">
            <label htmlFor="hw-due">Échéance</label>
            <input id="hw-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="bf-field">
          <label className="bf-checkbox-label">
            <input
              type="checkbox"
              checked={recurrenceEnabled}
              onChange={(e) => setRecurrenceEnabled(e.target.checked)}
              disabled={!dueDate}
            />
            Devoir récurrent
          </label>
          {!dueDate && (
            <p className="bf-field__hint">Renseigne une échéance pour activer la récurrence.</p>
          )}
          {recurrenceEnabled && dueDate && (
            <div className="bf-form-row" style={{ marginTop: 8 }}>
              <div className="bf-field">
                <label htmlFor="hw-recurrence-frequency">Fréquence</label>
                <CustomSelect
                  id="hw-recurrence-frequency"
                  value={recurrenceFrequency}
                  onChange={(v) => setRecurrenceFrequency(v as HomeworkRecurrence["frequency"])}
                  options={[
                    { value: "daily", label: "Jour(s)" },
                    { value: "weekly", label: "Semaine(s)" },
                    { value: "monthly", label: "Mois" },
                  ]}
                />
              </div>
              <div className="bf-field">
                <label htmlFor="hw-recurrence-interval">Tous les</label>
                <input
                  id="hw-recurrence-interval"
                  type="number"
                  min={1}
                  max={365}
                  value={recurrenceInterval}
                  onChange={(e) => setRecurrenceInterval(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
            </div>
          )}
        </div>
        <div className="bf-field">
          <label htmlFor="hw-status">Statut</label>
          <CustomSelect
            id="hw-status"
            value={status}
            onChange={(v) => setStatus(v as HomeworkStatus)}
            options={[
              { value: "todo", label: "À faire" },
              { value: "in_progress", label: "En cours" },
              { value: "done", label: "Terminé" },
            ]}
          />
        </div>
        <div className="bf-field">
          <label htmlFor="hw-notes">Notes (optionnel)</label>
          <textarea id="hw-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="bf-field">
          <label id="hw-subtasks-label">Sous-tâches ({subtasks.filter((s) => s.done).length}/{subtasks.length})</label>
          {subtasks.length > 0 && (
            <ul className="bf-subtask-list" aria-labelledby="hw-subtasks-label">
              {subtasks.map((s) => (
                <li key={s.id} className="bf-subtask-list__item">
                  <label className="bf-subtask-list__checkbox">
                    <input type="checkbox" checked={s.done} onChange={() => toggleSubtask(s.id)} />
                    <span className={s.done ? "done" : ""}>{s.title}</span>
                  </label>
                  <button
                    type="button"
                    className="bf-btn ghost small"
                    onClick={() => removeSubtask(s.id)}
                    aria-label={`Supprimer la sous-tâche « ${s.title} »`}
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="bf-subtask-add">
            <input
              type="text"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSubtask();
                }
              }}
              placeholder="Ajouter une sous-tâche"
              aria-label="Titre de la nouvelle sous-tâche"
            />
            <button type="button" className="bf-btn ghost small" onClick={addSubtask}>
              Ajouter
            </button>
          </div>
        </div>
        <div className="bf-modal__actions">
          <button type="button" className="bf-btn ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="bf-btn primary">
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ===========================================================================
// Section : Objectifs
// ===========================================================================

function GoalsSection({
  goals,
  subjects,
  isLoading = false,
  onAdd,
  onEdit,
  onDelete,
  onToggleDone,
  onProgressChange,
}: {
  goals: Goal[];
  subjects: Subject[];
  isLoading?: boolean;
  onAdd: () => void;
  onEdit: (g: Goal) => void;
  onDelete: (id: string) => void;
  onToggleDone: (id: string) => void;
  onProgressChange: (id: string, progress: number) => void;
}) {
  return (
    <>
      <div className="bf-page-heading">
        <h1>Objectifs</h1>
        <p>Fixe-toi des objectifs concrets et suis ta progression.</p>
      </div>
      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Tous les objectifs ({goals.length})</h2>
          <button className="bf-btn primary small" onClick={onAdd}>
            + Nouvel objectif
          </button>
        </div>
        {isLoading ? (
          <LoadingState label="Chargement des objectifs…" />
        ) : goals.length === 0 ? (
          <EmptyState
            icon={Target}
            tone="cyan"
            title="Aucun objectif pour le moment"
            hint="Fixe-toi un premier objectif !"
          />
        ) : (
          <div className="bf-list" role="list">
            {goals.map((g) => {
              const subject = subjectById(subjects, g.subjectId);
              const isLate = !g.done && !!g.targetDate && (daysUntil(g.targetDate) ?? 0) < 0;
              return (
                <div className="bf-item-row" role="listitem" key={g.id} style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div className="bf-item-row__main">
                      <div className="bf-item-row__title" style={{ textDecoration: g.done ? "line-through" : "none" }}>
                        {g.title}
                      </div>
                      <div className="bf-item-row__meta">
                        {subject && <span className="bf-inline-icon"><SubjectIcon iconKey={subject.icon} size={12} /> {subject.name}</span>}
                        <span>{g.progress}% atteint</span>
                        {g.targetDate && <span>Échéance : {formatDateFR(g.targetDate)}</span>}
                        {isLate && <span className="bf-tag status-todo">En retard</span>}
                      </div>
                    </div>
                    <div className="bf-item-row__actions">
                      <button className="bf-btn ghost small" onClick={() => onToggleDone(g.id)} aria-label={`${g.done ? "Rouvrir" : "Marquer terminé"} « ${g.title} »`}>
                        {g.done ? "Rouvrir" : "Marquer terminé"}
                      </button>
                      <button className="bf-btn ghost small" onClick={() => onEdit(g)} aria-label={`Modifier « ${g.title} »`}>
                        Modifier
                      </button>
                      <button className="bf-btn danger small" onClick={() => onDelete(g.id)} aria-label={`Supprimer « ${g.title} »`}>
                        Supprimer
                      </button>
                    </div>
                  </div>
                  <div className="bf-progress-bar">
                    <div className="bf-progress-bar__fill" style={{ width: `${g.progress}%` }} />
                  </div>
                  {!g.done && (
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={g.progress}
                      onChange={(e) => onProgressChange(g.id, Number(e.target.value))}
                      style={{ width: "100%" }}
                      aria-label={`Progression de « ${g.title} » : ${g.progress}%`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function GoalFormModal({
  goal,
  subjects,
  onClose,
  onSave,
}: {
  goal: Goal | null;
  subjects: Subject[];
  onClose: () => void;
  onSave: (g: Goal) => void;
}) {
  const [title, setTitle] = useState(goal?.title ?? "");
  const [subjectId, setSubjectId] = useState(goal?.subjectId ?? "");
  const [progress, setProgress] = useState(goal?.progress ?? 0);
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <Modal title={goal ? "Modifier l'objectif" : "Nouvel objectif"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) {
            setFormError("Merci de renseigner un titre pour cet objectif.");
            return;
          }
          setFormError(null);
          onSave({
            id: goal?.id ?? makeId("goal"),
            title: title.trim(),
            subjectId: subjectId || null,
            progress,
            done: goal?.done ?? false,
            targetDate: targetDate || null,
            createdAt: goal?.createdAt ?? Date.now(),
          });
        }}
      >
        {formError && (
          <p className="bf-form-error" id="g-title-error" role="alert">
            {formError}
          </p>
        )}
        <div className="bf-field">
          <label htmlFor="g-title">Titre de l'objectif</label>
          <input
            id="g-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            placeholder="Ex: Réviser les mathématiques"
            aria-invalid={!!formError}
            aria-describedby={formError ? "g-title-error" : undefined}
          />
        </div>
        <div className="bf-form-row">
          <div className="bf-field">
            <label htmlFor="g-subject">Matière liée (optionnel)</label>
            <CustomSelect
              id="g-subject"
              value={subjectId}
              onChange={setSubjectId}
              options={[{ value: "", label: "Aucune" }, ...subjects.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </div>
          <div className="bf-field">
            <label htmlFor="g-target">Échéance visée (optionnel)</label>
            <input id="g-target" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
        </div>
        <div className="bf-field">
          <label htmlFor="g-progress">Progression initiale ({progress}%)</label>
          <input id="g-progress" type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} />
        </div>
        <div className="bf-modal__actions">
          <button type="button" className="bf-btn ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="bf-btn primary">
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ===========================================================================
// Section : Notions (Matière → Chapitre → Notion)
// ===========================================================================

type NotionSortKey = "recent" | "name" | "status";

const NOTION_SORT_OPTIONS: { value: NotionSortKey; label: string }[] = [
  { value: "recent", label: "Révision (moins récente d'abord)" },
  { value: "name", label: "Nom (A → Z)" },
  { value: "status", label: "Statut" },
];

const NOTION_PAGE_SIZE = 8;

function NotionsSection({
  notions,
  subjects,
  isLoading = false,
  onAdd,
  onEdit,
  onDelete,
  onMarkReviewed,
}: {
  notions: Notion[];
  subjects: Subject[];
  isLoading?: boolean;
  onAdd: () => void;
  onEdit: (n: Notion) => void;
  onDelete: (id: string) => void;
  onMarkReviewed: (id: string, nextStatus?: NotionStatus) => void;
}) {
  const [filterSubject, setFilterSubject] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | NotionStatus>("all");
  const [sortKey, setSortKey] = useState<NotionSortKey>("recent");
  const [page, setPage] = useState(1);

  const filtered = notions.filter((n) => {
    if (filterSubject && n.subjectId !== filterSubject) return false;
    if (filterStatus !== "all" && n.status !== filterStatus) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "name") return a.name.localeCompare(b.name, "fr");
    if (sortKey === "status") return a.status.localeCompare(b.status);
    // "recent" : notions jamais révisées en premier, puis par ancienneté de
    // révision croissante — c'est l'ordre le plus utile pour savoir quoi
    // réviser en priorité.
    if (!a.lastReviewedAt) return -1;
    if (!b.lastReviewedAt) return 1;
    return a.lastReviewedAt - b.lastReviewedAt;
  });

  useEffect(() => {
    setPage(1);
  }, [filterSubject, filterStatus, sortKey]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / NOTION_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginated = sorted.slice((currentPage - 1) * NOTION_PAGE_SIZE, currentPage * NOTION_PAGE_SIZE);

  return (
    <>
      <div className="bf-page-heading">
        <h1>Notions</h1>
        <p>Suis ce que tu maîtrises, matière par matière, chapitre par chapitre.</p>
      </div>

      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Toutes les notions ({notions.length})</h2>
          <div className="bf-panel__toolbar">
            <CustomSelect
              value={filterSubject}
              onChange={setFilterSubject}
              options={[{ value: "", label: "Toutes les matières" }, ...subjects.map((s) => ({ value: s.id, label: s.name }))]}
              ariaLabel="Filtrer par matière"
            />
            <CustomSelect
              value={filterStatus}
              onChange={(v) => setFilterStatus(v as "all" | NotionStatus)}
              options={[
                { value: "all", label: "Tous les statuts" },
                ...(Object.keys(NOTION_STATUS_LABEL) as NotionStatus[]).map((st) => ({
                  value: st,
                  label: NOTION_STATUS_LABEL[st],
                })),
              ]}
              ariaLabel="Filtrer par statut"
            />
            <CustomSelect
              value={sortKey}
              onChange={(v) => setSortKey(v as NotionSortKey)}
              options={NOTION_SORT_OPTIONS}
              ariaLabel="Trier les notions"
            />
            <button className="bf-btn primary small" onClick={onAdd}>
              + Nouvelle notion
            </button>
          </div>
        </div>

        {isLoading ? (
          <LoadingState label="Chargement des notions…" />
        ) : sorted.length === 0 ? (
          notions.length === 0 ? (
            <EmptyState
              icon={Puzzle}
              tone="magenta"
              title="Aucune notion pour l'instant"
              hint="Ajoute les notions importantes de tes cours pour suivre ce que tu maîtrises."
            />
          ) : (
            <div className="bf-empty">Aucune notion ne correspond à ces filtres.</div>
          )
        ) : (
          <>
            <div className="bf-list" role="list">
              {paginated.map((n) => {
                const subject = subjectById(subjects, n.subjectId);
                return (
                  <div className="bf-item-row" role="listitem" key={n.id}>
                    <div className="bf-item-row__main">
                      <div className="bf-item-row__title">{n.name}</div>
                      <div className="bf-item-row__meta">
                        {subject && <span className="bf-inline-icon"><SubjectIcon iconKey={subject.icon} size={12} /> {subject.name}</span>}
                        {n.chapter && <span>{n.chapter}</span>}
                        {n.lastReviewedAt && <span>Révisée le {new Date(n.lastReviewedAt).toLocaleDateString("fr-FR")}</span>}
                      </div>
                    </div>
                    <CustomSelect
                      value={n.status}
                      onChange={(v) => onMarkReviewed(n.id, v as NotionStatus)}
                      className="bf-select--tag"
                      buttonClassName={`bf-tag status-${n.status === "maitrisee" ? "done" : n.status === "a_revoir" ? "todo" : "in_progress"}`}
                      ariaLabel={`Statut de ${n.name}`}
                      options={(Object.keys(NOTION_STATUS_LABEL) as NotionStatus[]).map((st) => ({
                        value: st,
                        label: NOTION_STATUS_LABEL[st],
                      }))}
                    />
                    <div className="bf-item-row__actions">
                      <button className="bf-btn ghost small" onClick={() => onMarkReviewed(n.id)} aria-label={`Marquer « ${n.name} » comme révisée aujourd'hui`}>
                        Révisée aujourd'hui
                      </button>
                      <button className="bf-btn ghost small" onClick={() => onEdit(n)} aria-label={`Modifier « ${n.name} »`}>
                        Modifier
                      </button>
                      <button className="bf-btn danger small" onClick={() => onDelete(n.id)} aria-label={`Supprimer « ${n.name} »`}>
                        Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {pageCount > 1 && (
              <nav className="bf-pagination" aria-label="Pagination des notions">
                <button
                  type="button"
                  className="bf-btn ghost small"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Page précédente"
                >
                  Précédent
                </button>
                <span className="bf-pagination__status" aria-live="polite">
                  Page {currentPage} / {pageCount}
                </span>
                <button
                  type="button"
                  className="bf-btn ghost small"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={currentPage === pageCount}
                  aria-label="Page suivante"
                >
                  Suivant
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </>
  );
}

function NotionFormModal({
  notion,
  subjects,
  onClose,
  onSave,
}: {
  notion: Notion | null;
  subjects: Subject[];
  onClose: () => void;
  onSave: (n: Notion) => void;
}) {
  const [name, setName] = useState(notion?.name ?? "");
  const [subjectId, setSubjectId] = useState(notion?.subjectId ?? "");
  const [chapter, setChapter] = useState(notion?.chapter ?? "");
  const [status, setStatus] = useState<NotionStatus>(notion?.status ?? "non_etudiee");
  const [nextReviewAt, setNextReviewAt] = useState(notion?.nextReviewAt ?? "");
  const [note, setNote] = useState(notion?.note ?? "");
  const [source, setSource] = useState(notion?.source ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <Modal title={notion ? "Modifier la notion" : "Nouvelle notion"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) {
            setFormError("Merci de renseigner un nom pour cette notion.");
            return;
          }
          setFormError(null);
          onSave({
            id: notion?.id ?? makeId("notion"),
            name: name.trim(),
            subjectId: subjectId || null,
            chapter: chapter.trim(),
            status,
            lastReviewedAt: notion?.lastReviewedAt ?? null,
            nextReviewAt: nextReviewAt || null,
            note: note.trim(),
            source: source.trim(),
            createdAt: notion?.createdAt ?? Date.now(),
          });
        }}
      >
        {formError && (
          <p className="bf-form-error" id="n-name-error" role="alert">
            {formError}
          </p>
        )}
        <div className="bf-field">
          <label htmlFor="n-name">Nom de la notion</label>
          <input
            id="n-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Ex: Théorème de Pythagore"
            aria-invalid={!!formError}
            aria-describedby={formError ? "n-name-error" : undefined}
          />
        </div>
        <div className="bf-form-row">
          <div className="bf-field">
            <label htmlFor="n-subject">Matière</label>
            <CustomSelect
              id="n-subject"
              value={subjectId}
              onChange={setSubjectId}
              options={[{ value: "", label: "Aucune" }, ...subjects.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </div>
          <div className="bf-field">
            <label htmlFor="n-chapter">Chapitre (optionnel)</label>
            <input id="n-chapter" type="text" value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="Ex: Géométrie" />
          </div>
        </div>
        <div className="bf-form-row">
          <div className="bf-field">
            <label htmlFor="n-status">Statut</label>
            <CustomSelect
              id="n-status"
              value={status}
              onChange={(v) => setStatus(v as NotionStatus)}
              options={(Object.keys(NOTION_STATUS_LABEL) as NotionStatus[]).map((st) => ({
                value: st,
                label: NOTION_STATUS_LABEL[st],
              }))}
            />
          </div>
          <div className="bf-field">
            <label htmlFor="n-next">Prochaine révision (optionnel)</label>
            <input id="n-next" type="date" value={nextReviewAt} onChange={(e) => setNextReviewAt(e.target.value)} />
          </div>
        </div>
        <div className="bf-field">
          <label htmlFor="n-note">Note personnelle (optionnel)</label>
          <textarea id="n-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="bf-field">
          <label htmlFor="n-source">Source (optionnel)</label>
          <input id="n-source" type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Ex: Chapitre 4 du manuel, cours du 12/03…" />
        </div>
        <div className="bf-modal__actions">
          <button type="button" className="bf-btn ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="bf-btn primary">
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ===========================================================================
// Section : Bibliothèque de méthodes
// ===========================================================================

function EventFormModal({
  event,
  subjects,
  prefillDate,
  onClose,
  onSave,
}: {
  event: CalendarEvent | null;
  subjects: Subject[];
  prefillDate?: string;
  onClose: () => void;
  onSave: (e: CalendarEvent) => void;
}) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event?.date ?? prefillDate ?? isoDateDaysAgo(0));
  const [type, setType] = useState<CalendarEventType>(event?.type ?? "exam");
  const [subjectId, setSubjectId] = useState(event?.subjectId ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <Modal title={event ? "Modifier l'événement" : "Nouvel événement"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) {
            setFormError("Merci de renseigner un titre pour cet événement.");
            return;
          }
          if (!date) {
            setFormError("Merci de renseigner une date.");
            return;
          }
          setFormError(null);
          onSave({
            id: event?.id ?? makeId("event"),
            title: title.trim(),
            date,
            type,
            subjectId: subjectId || null,
            notes: notes.trim(),
            createdAt: event?.createdAt ?? Date.now(),
          });
        }}
      >
        {formError && (
          <p className="bf-form-error" id="ev-title-error" role="alert">
            {formError}
          </p>
        )}
        <div className="bf-field">
          <label htmlFor="ev-title">Titre</label>
          <input
            id="ev-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            placeholder="Ex: Contrôle de mathématiques"
            aria-invalid={!!formError}
            aria-describedby={formError ? "ev-title-error" : undefined}
          />
        </div>
        <div className="bf-form-row">
          <div className="bf-field">
            <label htmlFor="ev-date">Date</label>
            <input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="bf-field">
            <label htmlFor="ev-type">Type</label>
            <CustomSelect
              id="ev-type"
              value={type}
              onChange={(v) => setType(v as CalendarEventType)}
              options={[
                { value: "exam", label: "Examen / contrôle" },
                { value: "other", label: "Autre" },
              ]}
            />
          </div>
        </div>
        <div className="bf-field">
          <label htmlFor="ev-subject">Matière (optionnel)</label>
          <CustomSelect
            id="ev-subject"
            value={subjectId}
            onChange={setSubjectId}
            options={[{ value: "", label: "Aucune matière" }, ...subjects.map((s) => ({ value: s.id, label: s.name }))]}
          />
        </div>
        <div className="bf-field">
          <label htmlFor="ev-notes">Notes (optionnel)</label>
          <textarea id="ev-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="bf-modal__actions">
          <button type="button" className="bf-btn ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="bf-btn primary">
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ===========================================================================
// Section : Bibliothèque de méthodes
// ===========================================================================

function MethodsSection({
  favoriteIds,
  onToggleFavorite,
}: {
  favoriteIds: string[];
  onToggleFavorite: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MethodCategory | "favoris" | "all">("all");
  const [openMethod, setOpenMethod] = useState<StudyMethod | null>(null);

  const filtered = STUDY_METHODS.filter((m) => {
    if (category === "favoris" && !favoriteIds.includes(m.id)) return false;
    if (category !== "all" && category !== "favoris" && !m.categories.includes(category)) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      if (!m.name.toLowerCase().includes(q) && !m.shortDescription.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <>
      <div className="bf-page-heading">
        <h1>Bibliothèque de méthodes</h1>
        <p>Apprends à apprendre : des méthodes concrètes pour mémoriser, comprendre et réviser plus efficacement.</p>
      </div>

      <div className="bf-panel">
        <div className="bf-method-toolbar">
          <input
            type="text"
            className="bf-method-search"
            placeholder="Rechercher une méthode…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="bf-method-chips">
          <button className={`bf-chip ${category === "all" ? "active" : ""}`} onClick={() => setCategory("all")}>
            Toutes
          </button>
          <button className={`bf-chip ${category === "favoris" ? "active" : ""}`} onClick={() => setCategory("favoris")}>
            <Star size={13} fill={category === "favoris" ? "currentColor" : "none"} /> Favoris
          </button>
          {METHOD_CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`bf-chip ${category === c.id ? "active" : ""}`}
              onClick={() => setCategory(c.id)}
            >
              <CategoryIcon iconKey={c.icon} size={13} /> {c.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bf-empty">Aucune méthode ne correspond à ta recherche.</div>
        ) : (
          <div className="bf-method-grid">
            {filtered.map((m) => {
              const isFav = favoriteIds.includes(m.id);
              return (
                <button key={m.id} className="bf-method-card" onClick={() => setOpenMethod(m)}>
                  <div className="bf-method-card__top">
                    <span className={`bf-method-card__icon swatch-${categoryColor(m.categories[0])}`}>
                      <CategoryIcon
                        iconKey={METHOD_CATEGORIES.find((c) => c.id === m.categories[0])?.icon ?? ""}
                        size={17}
                      />
                    </span>
                    <span
                      className={`bf-method-card__fav ${isFav ? "active" : ""}`}
                      role="button"
                      aria-label="Ajouter aux favoris"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(m.id);
                      }}
                    >
                      <Star size={17} fill={isFav ? "currentColor" : "none"} />
                    </span>
                  </div>
                  <div className="bf-method-card__name">{m.name}</div>
                  <div className="bf-method-card__desc">{m.shortDescription}</div>
                  <div className="bf-method-card__tags">
                    <span className={`bf-tag-diff ${m.difficulty}`}>{DIFFICULTY_LABEL[m.difficulty]}</span>
                    {m.recommendedDuration && (
                      <span className="bf-method-card__duration">
                        <Clock size={12} /> {m.recommendedDuration}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {openMethod && (
        <MethodDetailModal
          method={openMethod}
          isFavorite={favoriteIds.includes(openMethod.id)}
          onToggleFavorite={() => onToggleFavorite(openMethod.id)}
          onClose={() => setOpenMethod(null)}
        />
      )}
    </>
  );
}

const DIFFICULTY_LABEL: Record<MethodDifficulty, string> = {
  facile: "Facile",
  moyen: "Intermédiaire",
  exigeant: "Exigeant",
};

// Réutilise la palette de couleurs déjà utilisée pour les matières, pour
// rester visuellement cohérent avec le reste de l'application.
const CATEGORY_COLORS: Record<MethodCategory, SubjectColor> = {
  memorisation: "purple",
  comprehension: "blue",
  organisation: "orange",
  revision: "teal",
  concentration: "red",
  examens: "pink",
  prise_de_notes: "green",
};

function categoryColor(c: MethodCategory): SubjectColor {
  return CATEGORY_COLORS[c] ?? "teal";
}

function MethodDetailModal({
  method,
  isFavorite,
  onToggleFavorite,
  onClose,
}: {
  method: StudyMethod;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={method.name} onClose={onClose}>
      <div className="bf-method-detail">
        <div className="bf-method-detail__tags">
          {method.categories.map((c) => (
            <span key={c} className={`bf-tag-cat swatch-${categoryColor(c)}`}>
              {METHOD_CATEGORIES.find((cat) => cat.id === c)?.label}
            </span>
          ))}
          <span className={`bf-tag-diff ${method.difficulty}`}>{DIFFICULTY_LABEL[method.difficulty]}</span>
          {method.recommendedDuration && (
            <span className="bf-method-card__duration">
              <Clock size={12} /> {method.recommendedDuration}
            </span>
          )}
        </div>

        <p className="bf-method-detail__desc">{method.shortDescription}</p>

        <div className="bf-method-detail__block">
          <h3>
            <Target size={15} /> Objectif
          </h3>
          <p>{method.objective}</p>
        </div>

        <div className="bf-method-detail__block">
          <h3>
            <Clock size={15} /> Quand l'utiliser
          </h3>
          <p>{method.whenToUse}</p>
        </div>

        <div className="bf-method-detail__block">
          <h3>
            <ClipboardList size={15} /> Comment l'utiliser
          </h3>
          <ol className="bf-method-detail__steps">
            {method.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>

        {method.usefulSubjects.length > 0 && (
          <div className="bf-method-detail__block">
            <h3>
              <BookOpen size={15} /> Particulièrement utile pour
            </h3>
            <div className="bf-method-detail__subjects">
              {method.usefulSubjects.map((s) => (
                <span key={s} className="bf-tag status-in_progress">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="bf-modal__actions">
          <button type="button" className="bf-btn ghost" onClick={onClose}>
            Fermer
          </button>
          <button type="button" className={`bf-btn ${isFavorite ? "danger" : "primary"}`} onClick={onToggleFavorite}>
            <Star size={15} fill={isFavorite ? "currentColor" : "none"} />
            {isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ===========================================================================
// Section : Planning
// ===========================================================================

function PlanningSection({
  homework,
  subjects,
  studySessions,
  ownerName,
  onToast,
}: {
  homework: Homework[];
  subjects: Subject[];
  studySessions: StudySession[];
  ownerName: string;
  onToast: (message: string, tone?: "success" | "info" | "danger") => void;
}) {
  const withDates = homework
    .filter((h) => h.dueDate && h.status !== "done")
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));

  const grouped = withDates.reduce<Record<string, Homework[]>>((acc, h) => {
    const key = h.dueDate as string;
    if (!acc[key]) acc[key] = [];
    acc[key].push(h);
    return acc;
  }, {});

  const dates = Object.keys(grouped).sort();

  return (
    <>
      <div className="bf-page-heading bf-page-heading--with-action">
        <div>
          <h1>Planning</h1>
          <p>Vue chronologique de tes devoirs à venir.</p>
        </div>
        <SharePlanningButton homework={homework} subjects={subjects} studySessions={studySessions} ownerName={ownerName} onToast={onToast} />
      </div>
      <div className="bf-panel">
        {dates.length === 0 ? (
          <div className="bf-empty">Aucune échéance planifiée. Ajoute une date à tes devoirs pour les voir ici.</div>
        ) : (
          <div className="bf-list">
            {dates.map((date) => (
              <div key={date}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--bf-text-muted)", margin: "10px 0 6px" }}>
                  {formatDateFR(date)}
                </div>
                {grouped[date].map((h) => {
                  const subject = subjectById(subjects, h.subjectId);
                  return (
                    <div className="bf-item-row" key={h.id}>
                      <div className="bf-item-row__main">
                        <div className="bf-item-row__title">{h.title}</div>
                        <div className="bf-item-row__meta">
                          {subject && <span className="bf-inline-icon"><SubjectIcon iconKey={subject.icon} size={12} /> {subject.name}</span>}
                        </div>
                      </div>
                      <span className={`bf-tag status-${h.status}`}>{STATUS_LABEL[h.status]}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ===========================================================================
// Section : Calendrier
// ===========================================================================

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function isoOfLocalDate(d: Date): string {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

function buildMonthGrid(year: number, month: number): { date: string; inMonth: boolean }[] {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells: { date: string; inMonth: boolean }[] = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push({ date: isoOfLocalDate(new Date(year, month - 1, daysInPrevMonth - i)), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: isoOfLocalDate(new Date(year, month, d)), inMonth: true });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: isoOfLocalDate(new Date(year, month + 1, nextDay)), inMonth: false });
    nextDay++;
  }
  return cells;
}

function CalendarSection({
  homework,
  goals,
  notions,
  studySessions,
  events,
  subjects,
  onAddHomeworkOn,
  onEditHomework,
  onAddEventOn,
  onEditEvent,
  onDeleteEvent,
}: {
  homework: Homework[];
  goals: Goal[];
  notions: Notion[];
  studySessions: StudySession[];
  events: CalendarEvent[];
  subjects: Subject[];
  onAddHomeworkOn: (date: string) => void;
  onEditHomework: (h: Homework) => void;
  onAddEventOn: (date: string) => void;
  onEditEvent: (e: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
}) {
  const today = isoOfLocalDate(new Date());
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(today);

  const grid = buildMonthGrid(cursor.year, cursor.month);

  const homeworkByDate = new Map<string, Homework[]>();
  for (const h of homework) {
    if (!h.dueDate) continue;
    if (!homeworkByDate.has(h.dueDate)) homeworkByDate.set(h.dueDate, []);
    homeworkByDate.get(h.dueDate)!.push(h);
  }
  const goalsByDate = new Map<string, Goal[]>();
  for (const g of goals) {
    if (!g.targetDate) continue;
    if (!goalsByDate.has(g.targetDate)) goalsByDate.set(g.targetDate, []);
    goalsByDate.get(g.targetDate)!.push(g);
  }
  const sessionsByDate = new Map<string, StudySession[]>();
  for (const s of studySessions) {
    if (!sessionsByDate.has(s.date)) sessionsByDate.set(s.date, []);
    sessionsByDate.get(s.date)!.push(s);
  }
  const notionsByDate = new Map<string, Notion[]>();
  for (const n of notions) {
    if (!n.nextReviewAt) continue;
    if (!notionsByDate.has(n.nextReviewAt)) notionsByDate.set(n.nextReviewAt, []);
    notionsByDate.get(n.nextReviewAt)!.push(n);
  }
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    if (!eventsByDate.has(e.date)) eventsByDate.set(e.date, []);
    eventsByDate.get(e.date)!.push(e);
  }

  function goToMonth(delta: number) {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  const selected = selectedDate
    ? {
        homework: homeworkByDate.get(selectedDate) ?? [],
        goals: goalsByDate.get(selectedDate) ?? [],
        sessions: sessionsByDate.get(selectedDate) ?? [],
        notions: notionsByDate.get(selectedDate) ?? [],
        events: eventsByDate.get(selectedDate) ?? [],
      }
    : null;
  const selectedIsEmpty =
    selected &&
    selected.homework.length === 0 &&
    selected.goals.length === 0 &&
    selected.sessions.length === 0 &&
    selected.notions.length === 0 &&
    selected.events.length === 0;

  return (
    <>
      <div className="bf-page-heading">
        <h1>Calendrier</h1>
        <p>Devoirs, objectifs, révisions, sessions passées et examens, tous au même endroit.</p>
      </div>

      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>
            {MONTH_LABELS[cursor.month]} {cursor.year}
          </h2>
          <div className="bf-panel__toolbar">
            <button type="button" className="bf-btn ghost small" onClick={() => goToMonth(-1)} aria-label="Mois précédent">
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              className="bf-btn ghost small"
              onClick={() => {
                const d = new Date();
                setCursor({ year: d.getFullYear(), month: d.getMonth() });
                setSelectedDate(today);
              }}
            >
              Aujourd'hui
            </button>
            <button type="button" className="bf-btn ghost small" onClick={() => goToMonth(1)} aria-label="Mois suivant">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div className="bf-calendar-weekdays" role="row">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="bf-calendar-weekday">
              {w}
            </div>
          ))}
        </div>

        <div className="bf-calendar-grid" role="grid" aria-label="Calendrier mensuel">
          {grid.map((cell) => {
            const hw = homeworkByDate.get(cell.date) ?? [];
            const gl = goalsByDate.get(cell.date) ?? [];
            const ss = sessionsByDate.get(cell.date) ?? [];
            const nt = notionsByDate.get(cell.date) ?? [];
            const ev = eventsByDate.get(cell.date) ?? [];
            const hasAny = hw.length + gl.length + ss.length + nt.length + ev.length > 0;
            const dayNumber = Number(cell.date.slice(8, 10));
            return (
              <button
                type="button"
                key={cell.date}
                className={`bf-calendar-cell ${cell.inMonth ? "" : "outside"} ${cell.date === today ? "today" : ""} ${
                  cell.date === selectedDate ? "selected" : ""
                }`}
                onClick={() => setSelectedDate(cell.date)}
                aria-label={`${dayNumber} ${MONTH_LABELS[cursor.month]}${hasAny ? ", contient des éléments" : ""}`}
                aria-pressed={cell.date === selectedDate}
              >
                <span className="bf-calendar-cell__day">{dayNumber}</span>
                {hasAny && (
                  <span className="bf-calendar-cell__dots">
                    {hw.length > 0 && <span className="bf-calendar-dot dot-homework" />}
                    {ev.some((e) => e.type === "exam") && <span className="bf-calendar-dot dot-exam" />}
                    {ev.some((e) => e.type === "other") && <span className="bf-calendar-dot dot-event" />}
                    {gl.length > 0 && <span className="bf-calendar-dot dot-goal" />}
                    {nt.length > 0 && <span className="bf-calendar-dot dot-notion" />}
                    {ss.length > 0 && <span className="bf-calendar-dot dot-session" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selected && selectedDate && (
        <div className="bf-panel">
          <div className="bf-panel__header">
            <h2>{formatDateFR(selectedDate)}</h2>
            <div className="bf-panel__toolbar">
              <button type="button" className="bf-btn ghost small" onClick={() => onAddHomeworkOn(selectedDate)}>
                + Devoir
              </button>
              <button type="button" className="bf-btn ghost small" onClick={() => onAddEventOn(selectedDate)}>
                + Examen / Événement
              </button>
            </div>
          </div>

          {selectedIsEmpty ? (
            <div className="bf-empty">Rien de prévu ce jour-là.</div>
          ) : (
            <div className="bf-list" role="list">
              {selected.homework.map((h) => {
                const subject = subjectById(subjects, h.subjectId);
                return (
                  <div className="bf-item-row" role="listitem" key={`hw-${h.id}`}>
                    <div className="bf-item-row__main">
                      <div className="bf-item-row__title">
                        <ClipboardList size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
                        {h.title}
                      </div>
                      <div className="bf-item-row__meta">
                        {subject && <span className="bf-inline-icon"><SubjectIcon iconKey={subject.icon} size={12} /> {subject.name}</span>}
                      </div>
                    </div>
                    <span className={`bf-tag status-${h.status}`}>{STATUS_LABEL[h.status]}</span>
                    <div className="bf-item-row__actions">
                      <button className="bf-btn ghost small" onClick={() => onEditHomework(h)} aria-label={`Modifier « ${h.title} »`}>
                        Modifier
                      </button>
                    </div>
                  </div>
                );
              })}

              {selected.events.map((e) => {
                const subject = subjectById(subjects, e.subjectId);
                return (
                  <div className="bf-item-row" role="listitem" key={`ev-${e.id}`}>
                    <div className="bf-item-row__main">
                      <div className="bf-item-row__title">
                        {e.type === "exam" ? (
                          <GraduationCap size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
                        ) : (
                          <CalendarRange size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
                        )}
                        {e.title}
                      </div>
                      <div className="bf-item-row__meta">
                        {subject && <span className="bf-inline-icon"><SubjectIcon iconKey={subject.icon} size={12} /> {subject.name}</span>}
                        <span>{e.type === "exam" ? "Examen" : "Événement"}</span>
                      </div>
                    </div>
                    <div className="bf-item-row__actions">
                      <button className="bf-btn ghost small" onClick={() => onEditEvent(e)} aria-label={`Modifier « ${e.title} »`}>
                        Modifier
                      </button>
                      <button className="bf-btn danger small" onClick={() => onDeleteEvent(e.id)} aria-label={`Supprimer « ${e.title} »`}>
                        Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}

              {selected.goals.map((g) => {
                const subject = subjectById(subjects, g.subjectId);
                return (
                  <div className="bf-item-row" role="listitem" key={`goal-${g.id}`}>
                    <div className="bf-item-row__main">
                      <div className="bf-item-row__title">
                        <Target size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
                        {g.title}
                      </div>
                      <div className="bf-item-row__meta">
                        {subject && <span className="bf-inline-icon"><SubjectIcon iconKey={subject.icon} size={12} /> {subject.name}</span>}
                        <span>{g.progress}% atteint</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {selected.notions.map((n) => {
                const subject = subjectById(subjects, n.subjectId);
                return (
                  <div className="bf-item-row" role="listitem" key={`notion-${n.id}`}>
                    <div className="bf-item-row__main">
                      <div className="bf-item-row__title">
                        <Puzzle size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
                        {n.name}
                      </div>
                      <div className="bf-item-row__meta">
                        {subject && <span className="bf-inline-icon"><SubjectIcon iconKey={subject.icon} size={12} /> {subject.name}</span>}
                        <span>À réviser</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {selected.sessions.map((s) => {
                const subject = subjectById(subjects, s.subjectId);
                return (
                  <div className="bf-item-row" role="listitem" key={`session-${s.id}`}>
                    <div className="bf-item-row__main">
                      <div className="bf-item-row__title">
                        <Clock size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
                        {s.minutes} min d'étude
                      </div>
                      <div className="bf-item-row__meta">
                        {subject && <span className="bf-inline-icon"><SubjectIcon iconKey={subject.icon} size={12} /> {subject.name}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ===========================================================================
// Section : Progression
// ===========================================================================

function ProgressSection({
  subjects,
  homework,
  goals,
  notions,
  studySessions,
  studyStreak,
  onAddStudySession,
}: {
  subjects: Subject[];
  homework: Homework[];
  goals: Goal[];
  notions: Notion[];
  studySessions: StudySession[];
  studyStreak: { current: number; best: number };
  onAddStudySession: (s: StudySession) => void;
}) {
  const totalHw = homework.length;
  const doneHw = homework.filter((h) => h.status === "done").length;
  const hwRate = totalHw === 0 ? 0 : Math.round((doneHw / totalHw) * 100);
  const lateHw = homework.filter((h) => h.status !== "done" && h.dueDate && (daysUntil(h.dueDate) ?? 0) < 0);
  const soonHw = homework.filter((h) => {
    if (h.status === "done" || !h.dueDate) return false;
    const d = daysUntil(h.dueDate);
    return d !== null && d >= 0 && d <= 3;
  });
  const pendingHw = homework.filter((h) => h.status !== "done");

  const doneGoals = goals.filter((g) => g.done).length;
  const activeGoals = goals.filter((g) => !g.done);
  const lateGoals = activeGoals.filter((g) => g.targetDate && (daysUntil(g.targetDate) ?? 0) < 0);
  const goalRate = goals.length === 0 ? 0 : Math.round((doneGoals / goals.length) * 100);

  // --- Temps d'étude -----------------------------------------------------
  const todayStr = new Date().toISOString().slice(0, 10);
  const minutesOn = (day: string) => studySessions.filter((s) => s.date === day).reduce((sum, s) => sum + s.minutes, 0);
  const minutesBetween = (fromDaysAgo: number, toDaysAgoExclusive: number) => {
    const from = isoDateDaysAgo(fromDaysAgo - 1); // inclus
    const to = isoDateDaysAgo(toDaysAgoExclusive);
    return studySessions
      .filter((s) => s.date >= to && s.date <= from)
      .reduce((sum, s) => sum + s.minutes, 0);
  };
  const todayMinutes = minutesOn(todayStr);
  const weekMinutes = minutesBetween(7, 0);
  const prevWeekMinutes = minutesBetween(14, 7);
  const monthMinutes = minutesBetween(30, 0);
  const prevMonthMinutes = minutesBetween(60, 30);

  function trendLabel(current: number, previous: number): string | null {
    if (previous === 0) return null;
    const diff = Math.round(((current - previous) / previous) * 100);
    if (diff === 0) return "stable";
    return diff > 0 ? `+${diff}% vs période précédente` : `${diff}% vs période précédente`;
  }

  const timeBySubject = subjects
    .map((s) => ({
      subject: s,
      minutes: studySessions.filter((sess) => sess.subjectId === s.id).reduce((sum, sess) => sum + sess.minutes, 0),
    }))
    .filter((x) => x.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
  const maxSubjectMinutes = timeBySubject[0]?.minutes ?? 0;

  // --- Notions -------------------------------------------------------------
  const notionCounts: Record<NotionStatus, number> = {
    non_etudiee: 0,
    a_apprendre: 0,
    en_cours: 0,
    a_revoir: 0,
    maitrisee: 0,
  };
  notions.forEach((n) => notionCounts[n.status]++);
  const toReviewNotions = notions.filter((n) => n.status === "a_revoir").slice(0, 6);

  // --- Formulaire rapide d'ajout de session ---------------------------------
  const [sessionMinutes, setSessionMinutes] = useState(30);
  const [sessionSubjectId, setSessionSubjectId] = useState("");
  const [sessionDate, setSessionDate] = useState(todayStr);

  function handleAddSession(e: FormEvent) {
    e.preventDefault();
    if (sessionMinutes <= 0) return;
    onAddStudySession({
      id: makeId("study"),
      subjectId: sessionSubjectId || null,
      minutes: sessionMinutes,
      date: sessionDate,
      createdAt: Date.now(),
    });
    setSessionMinutes(30);
  }

  return (
    <>
      <div className="bf-page-heading">
        <h1>Progression</h1>
        <p>Une vue d'ensemble de ton avancement : temps d'étude, devoirs, objectifs et notions.</p>
      </div>

      <div className="bf-info-cards">
        <InfoCard icon={CheckCircle2} tone="success" label="Devoirs terminés" value={`${doneHw}/${totalHw}`} />
        <InfoCard icon={TrendingUp} tone="primary" label="Taux de complétion" value={`${hwRate}%`} />
        <InfoCard icon={Target} tone="accent" label="Objectifs atteints" value={`${doneGoals}/${goals.length}`} />
        <InfoCard icon={Clock} tone="info" label="Étude aujourd'hui" value={`${todayMinutes} min`} />
      </div>

      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Temps d'étude</h2>
        </div>
        <div className="bf-stat-row">
          <div className="bf-stat-block">
            <span className="bf-stat-block__label">Aujourd'hui</span>
            <span className="bf-stat-block__value">{todayMinutes} min</span>
          </div>
          <div className="bf-stat-block">
            <span className="bf-stat-block__label">Cette semaine</span>
            <span className="bf-stat-block__value">{weekMinutes} min</span>
            {trendLabel(weekMinutes, prevWeekMinutes) && (
              <span className="bf-stat-block__trend">{trendLabel(weekMinutes, prevWeekMinutes)}</span>
            )}
          </div>
          <div className="bf-stat-block">
            <span className="bf-stat-block__label">Ce mois</span>
            <span className="bf-stat-block__value">{monthMinutes} min</span>
            {trendLabel(monthMinutes, prevMonthMinutes) && (
              <span className="bf-stat-block__trend">{trendLabel(monthMinutes, prevMonthMinutes)}</span>
            )}
          </div>
          <div className="bf-stat-block">
            <span className="bf-stat-block__label">Série actuelle</span>
            <span className="bf-stat-block__value">
              <Flame size={15} strokeWidth={2.2} style={{ verticalAlign: -2, marginRight: 4 }} />
              {studyStreak.current} jour{studyStreak.current > 1 ? "s" : ""}
            </span>
            {studyStreak.best > studyStreak.current && (
              <span className="bf-stat-block__trend">Record : {studyStreak.best} jours</span>
            )}
          </div>
        </div>

        <form className="bf-session-form" onSubmit={handleAddSession}>
          <div className="bf-field">
            <label htmlFor="ss-minutes">Minutes étudiées</label>
            <input
              id="ss-minutes"
              type="number"
              min={1}
              max={600}
              value={sessionMinutes}
              onChange={(e) => setSessionMinutes(Number(e.target.value))}
            />
          </div>
          <div className="bf-field">
            <label htmlFor="ss-subject">Matière (optionnel)</label>
            <CustomSelect
              id="ss-subject"
              value={sessionSubjectId}
              onChange={setSessionSubjectId}
              options={[{ value: "", label: "Aucune" }, ...subjects.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </div>
          <div className="bf-field">
            <label htmlFor="ss-date">Date</label>
            <input id="ss-date" type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} max={todayStr} />
          </div>
          <button className="bf-btn primary" type="submit">
            + Enregistrer la session
          </button>
        </form>
      </div>

      {timeBySubject.length > 0 && (
        <div className="bf-panel">
          <div className="bf-panel__header">
            <h2>Temps par matière</h2>
          </div>
          <div className="bf-list">
            {timeBySubject.map(({ subject, minutes }) => (
              <div key={subject.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 4 }}>
                  <span className="bf-inline-icon"><SubjectIcon iconKey={subject.icon} size={13} /> {subject.name}</span>
                  <span style={{ color: "var(--bf-text-muted)" }}>{minutes} min</span>
                </div>
                <div className="bf-progress-bar">
                  <div
                    className="bf-progress-bar__fill"
                    style={{ width: `${maxSubjectMinutes === 0 ? 0 : Math.round((minutes / maxSubjectMinutes) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bf-two-col">
        <div className="bf-panel">
          <div className="bf-panel__header">
            <h2>Objectifs</h2>
          </div>
          <div className="bf-mini-stats">
            <span><CheckCircle2 size={14} /> {doneGoals} terminés</span>
            <span><Clock size={14} /> {activeGoals.length} en cours</span>
            <span><AlertTriangle size={14} /> {lateGoals.length} en retard</span>
            {goals.length > 0 && <span><BarChart3 size={14} /> {goalRate}% de réussite</span>}
          </div>
        </div>

        <div className="bf-panel">
          <div className="bf-panel__header">
            <h2>Devoirs</h2>
          </div>
          <div className="bf-mini-stats">
            <span><CheckCircle2 size={14} /> {doneHw} terminés</span>
            <span><Clock size={14} /> {pendingHw.length} en attente</span>
            <span><AlertTriangle size={14} /> {lateHw.length} en retard</span>
            <span><Clock size={14} /> {soonHw.length} proches (≤ 3 j)</span>
          </div>
        </div>
      </div>

      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Notions à revoir</h2>
        </div>
        <div className="bf-mini-stats" style={{ marginBottom: notions.length > 0 ? 12 : 0 }}>
          <span><Sparkles size={14} /> {notionCounts.non_etudiee} non étudiées</span>
          <span><BookOpen size={14} /> {notionCounts.a_apprendre} à apprendre</span>
          <span><Repeat size={14} /> {notionCounts.en_cours} en cours</span>
          <span><Clock size={14} /> {notionCounts.a_revoir} à revoir</span>
          <span><Trophy size={14} /> {notionCounts.maitrisee} maîtrisées</span>
        </div>
        {toReviewNotions.length > 0 ? (
          <div className="bf-list">
            {toReviewNotions.map((n) => {
              const subject = subjectById(subjects, n.subjectId);
              return (
                <div className="bf-item-row" key={n.id}>
                  <div className="bf-item-row__main">
                    <div className="bf-item-row__title">{n.name}</div>
                    <div className="bf-item-row__meta">
                      {subject && <span className="bf-inline-icon"><SubjectIcon iconKey={subject.icon} size={12} /> {subject.name}</span>}
                      {n.chapter && <span>{n.chapter}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          notions.length === 0 && (
            <div className="bf-empty">
              Ajoute tes premières notions depuis la section « Notions » pour suivre ce que tu maîtrises.
            </div>
          )
        )}
      </div>

      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Progression par matière (devoirs)</h2>
        </div>
        {subjects.length === 0 ? (
          <div className="bf-empty">Ajoute des matières pour suivre ta progression.</div>
        ) : (
          <div className="bf-list">
            {subjects.map((s) => {
              const subjHw = homework.filter((h) => h.subjectId === s.id);
              const subjDone = subjHw.filter((h) => h.status === "done").length;
              const pct = subjHw.length === 0 ? 0 : Math.round((subjDone / subjHw.length) * 100);
              return (
                <div key={s.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 4 }}>
                    <span className="bf-inline-icon"><SubjectIcon iconKey={s.icon} size={13} /> {s.name}</span>
                    <span style={{ color: "var(--bf-text-muted)" }}>{subjDone}/{subjHw.length} · {pct}%</span>
                  </div>
                  <div className="bf-progress-bar">
                    <div className="bf-progress-bar__fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ===========================================================================
// Section : Historique
// ===========================================================================

function HistorySection({ history }: { history: HistoryEntry[] }) {
  return (
    <>
      <div className="bf-page-heading">
        <h1>Historique</h1>
        <p>Retrouve toutes les actions récentes de ton espace.</p>
      </div>
      <div className="bf-panel">
        {history.length === 0 ? (
          <div className="bf-empty">Aucune activité enregistrée pour le moment.</div>
        ) : (
          <div className="bf-list">
            {history.map((h) => (
              <div className="bf-item-row" key={h.id}>
                <div className="bf-item-row__main">
                  <div className="bf-item-row__title">{h.label}</div>
                  <div className="bf-item-row__meta">{new Date(h.date).toLocaleString("fr-FR")}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ===========================================================================
// Section : Assistant IA
// ===========================================================================

function ChatSection({
  messages,
  onSend,
  onClear,
  onConfirmAction,
  onCancelAction,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => Promise<void>;
  onClear: () => void;
  onConfirmAction: (messageId: string, actionId: string) => void;
  onCancelAction: (messageId: string, actionId: string) => void;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, busy]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    try {
      await onSend(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "L'assistant est momentanément indisponible.");
    } finally {
      setBusy(false);
    }
  }

  // Regroupe les messages consécutifs du même auteur (comme Discord) :
  // avatar + nom + heure uniquement sur le premier message d'une rafale.
  const grouped = messages.map((m, i) => {
    const prev = messages[i - 1];
    const startsGroup = !prev || prev.role !== m.role || m.createdAt - prev.createdAt > 5 * 60 * 1000;
    return { ...m, startsGroup };
  });

  return (
    <>
      <div className="bf-page-heading">
        <h1>Benkyō IA</h1>
        <p>Pose une question, demande de l'aide pour organiser ton travail ou comprendre une notion.</p>
      </div>

      <div className="bf-panel bf-chat-panel">
        <div className="bf-panel__header">
          <h2>Conversation</h2>
          {messages.length > 0 && (
            <button className="bf-btn ghost small" onClick={onClear}>
              Vider la conversation
            </button>
          )}
        </div>

        <div className="bf-chat__messages" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="bf-chat__empty">
              <div className="bf-chat__empty-icon">
                <Bot size={30} strokeWidth={1.8} />
              </div>
              <p>C'est ici que commence la conversation.</p>
              <p className="bf-chat__empty-hint">
                Essaie : « Aide-moi à organiser ma semaine de révisions » ou « Explique-moi les fractions ».
              </p>
            </div>
          ) : (
            grouped.map((m) => (
              <div key={m.id} className={`bf-chat__row ${m.role} ${m.startsGroup ? "" : "grouped"}`}>
                {m.startsGroup ? (
                  <div className={`bf-chat__avatar ${m.role}`}>
                    {m.role === "assistant" ? <Bot size={16} /> : <User size={16} />}
                  </div>
                ) : (
                  <div className="bf-chat__avatar-spacer" />
                )}
                <div className="bf-chat__row-body">
                  {m.startsGroup && (
                    <div className="bf-chat__row-header">
                      <span className="bf-chat__row-name">
                        {m.role === "assistant" ? "Benkyō IA" : "Moi"}
                      </span>
                      <span className="bf-chat__row-time">
                        {new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  )}
                  <div className="bf-chat__bubble">{m.content}</div>
                  {m.actions && m.actions.length > 0 && (
                    <div className="bf-action-list">
                      {m.actions.map((a) => (
                        <div key={a.id} className={`bf-action-card status-${a.status}`}>
                          <div className="bf-action-card__desc">
                            <span className="bf-action-card__icon">
                              {a.operation === "create" ? (
                                <Plus size={15} />
                              ) : a.operation === "delete" ? (
                                <Trash2 size={15} />
                              ) : (
                                <Pencil size={15} />
                              )}
                            </span>
                            {a.description}
                          </div>
                          {a.status === "pending" && (
                            <div className="bf-action-card__buttons">
                              <button
                                type="button"
                                className="bf-btn ghost small"
                                onClick={() => onCancelAction(m.id, a.id)}
                              >
                                Ignorer
                              </button>
                              <button
                                type="button"
                                className="bf-btn primary small"
                                onClick={() => onConfirmAction(m.id, a.id)}
                              >
                                Confirmer
                              </button>
                            </div>
                          )}
                          {a.status === "done" && (
                            <div className="bf-action-card__result">
                              <CheckCircle2 size={13} /> {a.resultLabel}
                            </div>
                          )}
                          {a.status === "error" && (
                            <div className="bf-action-card__result error">
                              <AlertTriangle size={13} /> {a.resultLabel}
                            </div>
                          )}
                          {a.status === "cancelled" && (
                            <div className="bf-action-card__result">{a.resultLabel ?? "Ignoré."}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {busy && (
            <div className="bf-chat__row assistant">
              <div className="bf-chat__avatar assistant">
                <Bot size={16} />
              </div>
              <div className="bf-chat__row-body">
                <div className="bf-chat__row-header">
                  <span className="bf-chat__row-name">Benkyō IA</span>
                </div>
                <div className="bf-chat__bubble bf-chat__typing">
                  <span className="bf-chat__dot" />
                  <span className="bf-chat__dot" />
                  <span className="bf-chat__dot" />
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="bf-auth__error" style={{ marginTop: 4, marginBottom: 4, padding: "0 4px" }}>
            {error}
          </p>
        )}

        <form className="bf-chat__form" onSubmit={handleSend}>
          <input
            type="text"
            placeholder="Écris ta question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
          />
          <button className="bf-chat__send" type="submit" disabled={busy || !input.trim()} aria-label="Envoyer">
            <Send size={16} />
          </button>
        </form>
      </div>
    </>
  );
}

// ===========================================================================
// Panneau : Notifications (dans Paramètres)
// ===========================================================================

function NotificationsSettingsPanel({
  settings,
  onSettingsChange,
}: {
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
}) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(getNotificationPermission());
  const [requesting, setRequesting] = useState(false);

  async function handleEnable() {
    setRequesting(true);
    const result = await requestNotificationPermission();
    setPermission(result);
    setRequesting(false);
    if (result === "granted") {
      onSettingsChange({ ...settings, notificationsEnabled: true });
      registerPeriodicNotificationSync().catch(() => {});
    }
  }

  function handleToggle(checked: boolean) {
    if (checked && permission !== "granted") {
      handleEnable();
      return;
    }
    onSettingsChange({ ...settings, notificationsEnabled: checked });
  }

  return (
    <div className="bf-panel">
      <div className="bf-panel__header">
        <h2>Notifications</h2>
      </div>

      {permission === "unsupported" ? (
        <p style={{ fontSize: 13.5, color: "var(--bf-text-muted)" }}>
          Les notifications ne sont pas prises en charge par ce navigateur.
        </p>
      ) : (
        <>
          <div className="bf-toggle-row">
            <div>
              <div className="bf-toggle-row__label">
                {settings.notificationsEnabled && permission === "granted" ? <Bell size={15} /> : <BellOff size={15} />}
                Rappels de devoirs et de révisions
              </div>
              <p className="bf-toggle-row__hint">
                Un rappel la veille de l'échéance d'un devoir, et le jour même pour les notions à réviser.
              </p>
            </div>
            <label className="bf-switch">
              <input
                type="checkbox"
                checked={settings.notificationsEnabled && permission === "granted"}
                onChange={(e) => handleToggle(e.target.checked)}
              />
              <span className="bf-switch__track" />
            </label>
          </div>

          {permission !== "granted" && (
            <button className="bf-btn primary small" onClick={handleEnable} disabled={requesting} style={{ marginTop: 10 }}>
              <Bell size={14} /> {requesting ? "Un instant…" : "Autoriser les notifications"}
            </button>
          )}
          {permission === "denied" && (
            <p style={{ fontSize: 12.5, color: "var(--bf-text-muted)", marginTop: 8 }}>
              Les notifications ont été refusées. Autorise-les depuis les réglages de ton navigateur pour ce site si tu
              changes d'avis.
            </p>
          )}

          <p style={{ fontSize: 12, color: "var(--bf-text-muted)", marginTop: 14, lineHeight: 1.5 }}>
            Ces rappels fonctionnent de façon fiable tant que Benkyō Flow reste ouvert, même en arrière-plan. Sur
            certains navigateurs (Chrome sur Android, une fois l'app installée), ils peuvent aussi apparaître app
            fermée — mais ce n'est pas garanti partout (notamment sur iPhone/iPad).
          </p>
        </>
      )}
    </div>
  );
}

// ===========================================================================
// Section : Paramètres
// ===========================================================================

function SettingsSection({
  authMode,
  authUser,
  user,
  theme,
  settings,
  onThemeChange,
  onSettingsChange,
  onRenameUser,
  installAvailable,
  isStandalone,
  isIOS,
  onInstallClick,
  onResetData,
  onExportData,
  onImportData,
  onToast,
}: {
  authMode: "checking" | "guest" | "account";
  authUser: AuthUser | null;
  user: UserProfile;
  theme: ThemeMode;
  settings: AppSettings;
  onThemeChange: (t: ThemeMode) => void;
  onSettingsChange: (s: AppSettings) => void;
  onRenameUser: (name: string) => void;
  installAvailable: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  onInstallClick: () => void;
  onResetData?: () => void;
  onExportData: () => void;
  onImportData: (raw: unknown) => void;
  onToast: (message: string, tone?: "success" | "info" | "danger") => void;
}) {
  const [name, setName] = useState(user.name);
  const isAccount = authMode === "account";
  const importInputRef = useRef<HTMLInputElement | null>(null);

  function handleImportFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de réimporter le même fichier deux fois de suite
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        onImportData(parsed);
      } catch {
        onToast("Ce fichier n'a pas pu être lu — vérifie qu'il s'agit bien d'une sauvegarde Benkyō Flow.", "danger");
      }
    };
    reader.onerror = () => onToast("Impossible de lire ce fichier.", "danger");
    reader.readAsText(file);
  }

  return (
    <>
      <div className="bf-page-heading">
        <h1>Paramètres</h1>
        <p>Personnalise Benkyō Flow selon tes préférences.</p>
      </div>

      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Profil</h2>
        </div>
        {isAccount ? (
          <div style={{ fontSize: 13.5, color: "var(--bf-text-muted)" }}>
            <p style={{ marginBottom: 4 }}>
              Connecté avec le compte <strong style={{ color: "var(--bf-text)" }}>{authUser?.email}</strong>
            </p>
            <p>Prénom : {authUser?.name}</p>
          </div>
        ) : (
          <>
            <div className="bf-field" style={{ maxWidth: 320 }}>
              <label htmlFor="settings-name">Prénom affiché</label>
              <input id="settings-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <button className="bf-btn primary small" onClick={() => onRenameUser(name.trim() || user.name)}>
              Enregistrer le prénom
            </button>
          </>
        )}
      </div>

      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Me contacter</h2>
        </div>
        <p style={{ fontSize: 13.5, color: "var(--bf-text-muted)", marginBottom: 14 }}>
          Benkyō Flow est un projet personnel — n'hésite pas à me suivre ou à me faire signe.
        </p>
        <ContactLinks />
      </div>

      <NotificationsSettingsPanel settings={settings} onSettingsChange={onSettingsChange} />

      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Apparence</h2>
        </div>
        <p style={{ fontSize: 13.5, color: "var(--bf-text-muted)", marginBottom: 10 }}>
          Choisis le thème de l'application.
        </p>
        <ThemeSwitch theme={theme} onChange={onThemeChange} />

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--bf-border)" }}>
          <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Ambiances complètes</p>
          <p style={{ fontSize: 13, color: "var(--bf-text-muted)", marginBottom: 12 }}>
            Change le fond, les surfaces, le texte et les couleurs d'un coup.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginBottom: 8 }}>
            {fullPalettes.map((p) => {
              const active = settings.themePaletteId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  title={p.description}
                  onClick={() =>
                    onSettingsChange({
                      ...settings,
                      themePaletteId: active ? null : p.id,
                      customPrimaryColor: null,
                      customAccentColor: null,
                    })
                  }
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: 8,
                    borderRadius: 12,
                    border: active ? "2px solid var(--bf-primary)" : "1px solid var(--bf-border)",
                    background: p.bg,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", gap: 4 }}>
                    {[p.surface ?? p.bg, p.primary, p.accent ?? p.primary, p.text].map((sw, i) => (
                      <span
                        key={i}
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: sw,
                          border: "1px solid rgba(0,0,0,0.15)",
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: p.text }}>{p.label}</span>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--bf-border)" }}>
            <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Duos rapides (garde le mode jour/nuit)</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              {colorPresets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.label}
                  onClick={() =>
                    onSettingsChange({
                      ...settings,
                      themePaletteId: null,
                      customPrimaryColor: p.primary,
                      customAccentColor: p.accent,
                    })
                  }
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    border:
                      !settings.themePaletteId &&
                      settings.customPrimaryColor === p.primary &&
                      settings.customAccentColor === p.accent
                        ? "2px solid var(--bf-text)"
                        : "2px solid transparent",
                    padding: 0,
                    cursor: "pointer",
                    background: `linear-gradient(135deg, ${p.primary} 50%, ${p.accent} 50%)`,
                  }}
                />
              ))}
            </div>

            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                Principale
                <input
                  type="color"
                  value={settings.customPrimaryColor ?? "#1e3a5f"}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, themePaletteId: null, customPrimaryColor: e.target.value })
                  }
                  style={{ width: 34, height: 34, border: "none", borderRadius: 8, cursor: "pointer" }}
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                Accent
                <input
                  type="color"
                  value={settings.customAccentColor ?? "#f4820c"}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, themePaletteId: null, customAccentColor: e.target.value })
                  }
                  style={{ width: 34, height: 34, border: "none", borderRadius: 8, cursor: "pointer" }}
                />
              </label>
              {(settings.themePaletteId || settings.customPrimaryColor || settings.customAccentColor) && (
                <button
                  className="bf-btn ghost small"
                  onClick={() =>
                    onSettingsChange({
                      ...settings,
                      themePaletteId: null,
                      customPrimaryColor: null,
                      customAccentColor: null,
                    })
                  }
                >
                  Réinitialiser les couleurs
                </button>
              )}
            </div>
          </div>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--bf-border)" }}>
            <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Arrondi de l'interface</p>
            <div style={{ display: "flex", gap: 8 }}>
              {(
                [
                  { id: "compact", label: "Anguleux" },
                  { id: "default", label: "Standard" },
                  { id: "round", label: "Arrondi" },
                ] as { id: RadiusStyle; label: string }[]
              ).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`bf-btn ${settings.radiusStyle === o.id ? "primary" : "ghost"} small`}
                  onClick={() => onSettingsChange({ ...settings, radiusStyle: o.id })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Interface</h2>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}>
          <input
            type="checkbox"
            checked={settings.sidebarCollapsed}
            onChange={(e) => onSettingsChange({ ...settings, sidebarCollapsed: e.target.checked })}
          />
          Réduire la barre latérale par défaut (ordinateur)
        </label>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--bf-border)" }}>
          <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Fond du menu</p>
          <p style={{ fontSize: 13, color: "var(--bf-text-muted)", marginBottom: 12 }}>
            Ajoute une image de fond pour le menu
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {settings.sidebarBackgroundImage && (
              <img
                src={settings.sidebarBackgroundImage}
                alt="Aperçu"
                style={{ width: 72, height: 54, objectFit: "cover", borderRadius: 10, border: "1px solid var(--bf-border)" }}
              />
            )}
            <label className="bf-btn ghost small" style={{ cursor: "pointer" }}>
              {settings.sidebarBackgroundImage ? "Changer l'image" : "Choisir une image"}
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    const compressed = await compressImageFile(file, 1200, 0.8);
                    onSettingsChange({ ...settings, sidebarBackgroundImage: compressed });
                  } catch {
                    onToast("Impossible de traiter cette image. Essaie un autre fichier.", "danger");
                  }
                }}
              />
            </label>
            {settings.sidebarBackgroundImage && (
              <button
                className="bf-btn ghost small"
                onClick={() => onSettingsChange({ ...settings, sidebarBackgroundImage: null })}
              >
                Retirer l'image
              </button>
            )}
          </div>
          {settings.sidebarBackgroundImage && (
            <div className="bf-opacity-slider">
              <div className="bf-opacity-slider__row">
                <span>Visibilité de l'image</span>
                <span className="bf-opacity-slider__value">{settings.sidebarBackgroundOpacity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={settings.sidebarBackgroundOpacity}
                style={{ "--bf-opacity-fill": `${settings.sidebarBackgroundOpacity}%` } as CSSProperties}
                onChange={(e) =>
                  onSettingsChange({ ...settings, sidebarBackgroundOpacity: Number(e.target.value) })
                }
              />
            </div>
          )}
        </div>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--bf-border)" }}>
          <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Fond de l'application</p>
          <p style={{ fontSize: 13, color: "var(--bf-text-muted)", marginBottom: 12 }}>
            Ajoute une image de fond pour toute l'application
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {settings.appBackgroundImage && (
              <img
                src={settings.appBackgroundImage}
                alt="Aperçu"
                style={{ width: 72, height: 54, objectFit: "cover", borderRadius: 10, border: "1px solid var(--bf-border)" }}
              />
            )}
            <label className="bf-btn ghost small" style={{ cursor: "pointer" }}>
              {settings.appBackgroundImage ? "Changer l'image" : "Choisir une image"}
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    const compressed = await compressImageFile(file, 1600, 0.78);
                    onSettingsChange({ ...settings, appBackgroundImage: compressed });
                  } catch {
                    onToast("Impossible de traiter cette image. Essaie un autre fichier.", "danger");
                  }
                }}
              />
            </label>
            {settings.appBackgroundImage && (
              <button
                className="bf-btn ghost small"
                onClick={() => onSettingsChange({ ...settings, appBackgroundImage: null })}
              >
                Retirer l'image
              </button>
            )}
          </div>
          {settings.appBackgroundImage && (
            <div className="bf-opacity-slider">
              <div className="bf-opacity-slider__row">
                <span>Visibilité de l'image</span>
                <span className="bf-opacity-slider__value">{settings.appBackgroundOpacity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={settings.appBackgroundOpacity}
                style={{ "--bf-opacity-fill": `${settings.appBackgroundOpacity}%` } as CSSProperties}
                onChange={(e) =>
                  onSettingsChange({ ...settings, appBackgroundOpacity: Number(e.target.value) })
                }
              />
            </div>
          )}
        </div>
      </div>

      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Installation</h2>
        </div>
        {isStandalone ? (
          <p style={{ fontSize: 13.5, color: "var(--bf-text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={15} /> Benkyō Flow est déjà installée sur cet appareil.
          </p>
        ) : installAvailable ? (
          <>
            <p style={{ fontSize: 13.5, color: "var(--bf-text-muted)", marginBottom: 10 }}>
              Installe Benkyō Flow comme une application : icône sur l'écran d'accueil, lancement en plein
              écran, sans la barre d'adresse du navigateur.
            </p>
            <button className="bf-btn primary" onClick={onInstallClick}>
              <Download size={15} /> Installer Benkyō Flow
            </button>
          </>
        ) : isIOS ? (
          <p style={{ fontSize: 13.5, color: "var(--bf-text-muted)" }}>
            Sur iPhone/iPad, l'installation se fait à la main : appuie sur le bouton{" "}
            <strong style={{ color: "var(--bf-text)" }}>Partager</strong> dans Safari (le carré avec une
            flèche vers le haut), puis choisis{" "}
            <strong style={{ color: "var(--bf-text)" }}>« Sur l'écran d'accueil »</strong>.
          </p>
        ) : (
          <p style={{ fontSize: 13.5, color: "var(--bf-text-muted)" }}>
            Ce navigateur ne propose pas encore l'installation automatique. Regarde dans son menu (⋮ ou
            ...) une option du type « Installer l'application » ou « Ajouter à l'écran d'accueil ».
          </p>
        )}
      </div>

      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Données</h2>
        </div>

        <div className="bf-data-io">
          <p style={{ fontSize: 13.5, color: "var(--bf-text-muted)", marginBottom: 10 }}>
            Garde une copie de toutes tes données dans un fichier, pour la conserver ou la retrouver plus
            tard — par exemple si tu changes d'appareil. Tu peux aussi recharger un fichier précédemment
            sauvegardé : rien n'est jamais effacé au passage, ce qui existe déjà est simplement mis à jour
            et le reste est ajouté.
          </p>
          <div className="bf-data-io__actions">
            <button type="button" className="bf-btn ghost small" onClick={onExportData}>
              <Download size={14} /> Sauvegarder mes données
            </button>
            <button type="button" className="bf-btn ghost small" onClick={() => importInputRef.current?.click()}>
              <Upload size={14} /> Recharger une sauvegarde
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFileChange}
              style={{ display: "none" }}
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>
        </div>

        {isAccount ? (
          <p style={{ fontSize: 13.5, color: "var(--bf-text-muted)" }}>
            Tes données sont synchronisées avec ton compte. La réinitialisation en masse n'est pas encore
            disponible en mode compte — supprime tes matières, devoirs et objectifs un par un si besoin.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 13.5, color: "var(--bf-text-muted)", marginBottom: 10 }}>
              Tes données sont stockées localement sur cet appareil. Cette action supprime toutes tes
              matières, devoirs, objectifs et historique.
            </p>
            <button
              className="bf-btn danger"
              onClick={() => {
                if (window.confirm("Réinitialiser toutes les données ? Cette action est irréversible.")) {
                  onResetData?.();
                }
              }}
            >
                Réinitialiser les données
            </button>
          </>
        )}
      </div>
    </>
  );
}

// ===========================================================================
// Section : À propos
// ===========================================================================
//
// Le centre de gravité visuel de cette section n'est pas une pile de blocs
// à émoji (trop générique, se démode mal), mais une seule pièce animée :
// une ligne de "flux" en SVG qui relie 学ぶ → 整える → 進む, avec un motif
// de tirets qui défile en continu (le "courant") et quelques particules qui
// voyagent dessus. C'est littéralement une représentation du mot "Flow" du
// nom de l'app plutôt qu'une décoration arbitraire — et ça coûte zéro image
// externe, zéro dépendance : juste du SVG + CSS, cohérent avec les
// variables de thème existantes (clair/sombre inclus).

const ABOUT_FLOW_STEPS = [
  { kanji: "学", romaji: "Manabu", label: "Apprendre", tone: "cyan" as const, cx: 60 },
  { kanji: "整", romaji: "Totonoeru", label: "Organiser", tone: "violet" as const, cx: 300 },
  { kanji: "進", romaji: "Susumu", label: "Avancer", tone: "accent" as const, cx: 540 },
];

function AboutFlowHero() {
  return (
    <div className="bf-about-hero">
      <div className="bf-about-hero__kanji">
        <BrushUnderline>学ぶ</BrushUnderline>
        <span className="bf-about-hero__dot">・</span>
        <BrushUnderline>整える</BrushUnderline>
        <span className="bf-about-hero__dot">・</span>
        <BrushUnderline>進む</BrushUnderline>
      </div>
      <p className="bf-about-hero__sub">Apprendre &nbsp;•&nbsp; Organiser &nbsp;•&nbsp; Avancer</p>

      <svg
        className="bf-about-flow"
        viewBox="0 0 600 170"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Schéma illustrant le flux apprendre, organiser, avancer"
      >
        <defs>
          <linearGradient id="bf-flow-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--bf-cyan)" />
            <stop offset="50%" stopColor="var(--bf-violet)" />
            <stop offset="100%" stopColor="var(--bf-accent)" />
          </linearGradient>
        </defs>

        {/* Trait de fond, discret, pour donner une assise à la ligne animée */}
        <path
          d="M60,90 C 160,30 220,30 300,90 S 460,150 540,90"
          className="bf-about-flow__base"
          fill="none"
          pathLength={1}
        />
        {/* La ligne de "courant" : dashes qui défilent en boucle */}
        <path
          d="M60,90 C 160,30 220,30 300,90 S 460,150 540,90"
          className="bf-about-flow__stream"
          fill="none"
          stroke="url(#bf-flow-gradient)"
          pathLength={1}
        />

        {/* Particules qui voyagent le long du courant, décalées dans le temps */}
        {[0, 1, 2].map((i) => (
          <circle key={i} r="3.2" className={`bf-about-flow__spark spark-${i}`}>
            <animateMotion
              dur="4.5s"
              begin={`${i * 1.5}s`}
              repeatCount="indefinite"
              path="M60,90 C 160,30 220,30 300,90 S 460,150 540,90"
            />
          </circle>
        ))}

        {ABOUT_FLOW_STEPS.map((step) => (
          <g key={step.label} transform={`translate(${step.cx}, 90)`} className={`bf-about-flow__node tone-${step.tone}`}>
            <circle r="27" className="bf-about-flow__node-ring" />
            <text textAnchor="middle" dominantBaseline="central" dy="1" className="bf-about-flow__node-kanji">
              {step.kanji}
            </text>
            <text textAnchor="middle" y="48" className="bf-about-flow__node-label">
              {step.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// Petit soulignement façon coup de pinceau, dessiné au montage plutôt que
// simplement affiché — sert la même idée que le flux ci-dessus (mouvement
// qui a un sens), sans jamais recourir à un émoji.
function BrushUnderline({ children }: { children: string }) {
  return (
    <span className="bf-about-brush">
      {children}
      <svg viewBox="0 0 100 14" preserveAspectRatio="none" className="bf-about-brush__svg" aria-hidden="true">
        <path d="M2,7 C 20,2 35,11 50,6 S 80,2 98,7" pathLength={1} />
      </svg>
    </span>
  );
}

function AboutFeature({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: LucideIcon;
  tone: "primary" | "accent" | "success" | "info" | "violet";
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="bf-about-feature">
      <div className={`bf-about-feature__icon tone-${tone}`}>
        <Icon size={20} strokeWidth={2.1} />
      </div>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </div>
  );
}

function AboutSection() {
  return (
    <>
      <div className="bf-page-heading">
        <h1>À propos de Benkyō Flow</h1>
        <p>D'où vient l'application, et ce qu'elle essaie de faire.</p>
      </div>

      <div className="bf-panel bf-about-panel">
        <AboutFlowHero />

        <div className="bf-about-intro">
          <p>
            Apprendre quelque chose de nouveau, c'est rarement aussi simple que « commencer et
            continuer ». Il faut se souvenir de ce qu'on a appris, savoir quoi revoir, ne pas oublier ce
            qu'on doit faire, trouver du temps pour travailler et, parfois, simplement savoir par où
            commencer.
          </p>
          <p>
            <strong>Benkyō Flow</strong> est né de cette idée : rendre tout cela plus simple. Que vous
            appreniez une langue, prépariez un examen, développiez une nouvelle compétence, suiviez une
            formation ou appreniez simplement par curiosité, Benkyō Flow vous aide à donner une structure
            à votre apprentissage.
          </p>
        </div>
      </div>

      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Votre apprentissage, au même endroit</h2>
        </div>
        <p className="bf-about-lead">
          Avec Benkyō Flow, vous pouvez organiser vos matières et notions, suivre vos tâches et
          échéances, planifier vos révisions, enregistrer vos sessions d'apprentissage et garder un œil
          sur votre progression. Benkyō IA peut également vous aider à organiser votre espace : créer ou
          ajouter des matières, notions et devoirs à partir de vos demandes, mais aussi modifier ou
          supprimer des éléments lorsque vous en avez besoin.
        </p>
        <p className="bf-about-lead bf-about-lead--emphasis">
          L'idée n'est pas de vous dire comment apprendre. C'est de vous aider à ne pas perdre le fil.
        </p>
      </div>

      <div className="bf-about-features">
        <AboutFeature icon={Sprout} tone="success" title="Votre apprentissage, au même endroit">
          Matières, notions, devoirs, sessions et progression réunis dans un seul espace, plutôt qu'éparpillés
          entre plusieurs outils.
        </AboutFeature>
        <AboutFeature icon={Brain} tone="primary" title="Apprendre, puis revenir">
          Une notion apprise aujourd'hui peut facilement disparaître demain. Benkyō Flow planifie vos
          révisions pour revenir au bon moment sur ce que vous avez appris — parce que la mémoire humaine
          a visiblement décidé de ne pas être livrée avec une fonction « sauvegarde automatique ».
        </AboutFeature>
        <AboutFeature icon={Timer} tone="accent" title="Suivre son temps">
          Le temps consacré à l'apprentissage peut parfois passer inaperçu. Les sessions d'étude
          enregistrent le temps passé à apprendre et gardent une trace de vos habitudes au fil du temps.
        </AboutFeature>
        <AboutFeature icon={CalendarDays} tone="info" title="Savoir quoi faire">
          Entre les devoirs, les révisions et les sessions prévues, Benkyō Flow les organise dans le temps
          pour savoir ce qui est prévu et ce qui reste à faire. Moins de « qu'est-ce que je devais faire
          déjà ? ». Plus de « voilà ce que je fais maintenant ».
        </AboutFeature>
        <AboutFeature icon={Smartphone} tone="violet" title="Toujours à portée de main">
          Benkyō Flow est pensé pour être utilisé simplement sur différents appareils, et installé comme
          une application.
        </AboutFeature>
      </div>

      <div className="bf-about-quote">
        <p className="bf-about-quote__title">Pourquoi « Benkyō Flow » ?</p>
        <p>
          <strong>Benkyō</strong> (勉強) signifie étude, apprentissage en japonais. <strong>Flow</strong>{" "}
          évoque le mouvement, la continuité, et cette sensation de progresser sans perdre son rythme.
        </p>
        <p className="bf-about-quote__motto">Apprendre. Organiser. Avancer.</p>
        <p>
          Pas pour apprendre plus vite à tout prix. Pas pour transformer chaque journée en compétition.
          Simplement pour rendre le chemin un peu plus clair.
        </p>
        <p className="bf-about-quote__kanji-line">学ぶ・整える・進む</p>
        <p className="bf-about-quote__brand">Benkyō Flow</p>
      </div>
    </>
  );
}
