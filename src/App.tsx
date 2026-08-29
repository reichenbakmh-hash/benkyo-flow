import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, FormEvent } from "react";
import {
  loadAppData,
  saveUser,
  saveSubjects,
  saveHomework,
  saveGoals,
  loadHistoryFor,
  saveHistoryFor,
  saveSettings,
  saveTheme,
  makeId,
  starterSubjects,
  apiMe,
  apiRegister,
  apiLogin,
  apiLogout,
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
  apiListNotions,
  apiUpsertNotion,
  apiDeleteNotion,
  loadStudySessions,
  saveStudySessions,
  apiListStudySessions,
  apiUpsertStudySession,
  apiDeleteStudySession,
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
  FullPalette,
  RadiusStyle,
  AiAction,
  AiActionEntity,
  AiActionOperation,
  RawAiAction,
} from "./lib/storage";
import { STUDY_METHODS, METHOD_CATEGORIES } from "./lib/methods";
import type { StudyMethod, MethodCategory, MethodDifficulty } from "./lib/methods";
import {
  Home,
  BookOpen,
  ClipboardList,
  Target,
  Puzzle,
  Brain,
  CalendarDays,
  BarChart3,
  History as HistoryIcon,
  MessageCircle,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Monitor,
  Download,
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
} from "lucide-react";
import { SiWhatsapp, SiX, SiDiscord } from "react-icons/si";
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
  | "planning"
  | "progress"
  | "history"
  | "assistant"
  | "settings";

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Accueil", icon: Home },
  { id: "subjects", label: "Matières", icon: BookOpen },
  { id: "homework", label: "Devoirs", icon: ClipboardList },
  { id: "goals", label: "Objectifs", icon: Target },
  { id: "notions", label: "Notions", icon: Puzzle },
  { id: "methods", label: "Méthodes", icon: Brain },
  { id: "planning", label: "Planning", icon: CalendarDays },
  { id: "progress", label: "Progression", icon: BarChart3 },
  { id: "history", label: "Historique", icon: HistoryIcon },
  { id: "assistant", label: "Benkyō IA", icon: MessageCircle },
  { id: "settings", label: "Paramètres", icon: SettingsIcon },
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

function formatDateFR(iso: string | null): string {
  if (!iso) return "Sans échéance";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "Sans échéance";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso + "T00:00:00").getTime();
  if (Number.isNaN(target)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Vrai si la date (YYYY-MM-DD) tombe dans les `days` derniers jours (bornes incluses).
function isWithinDays(iso: string, days: number): boolean {
  const target = new Date(iso + "T00:00:00").getTime();
  if (Number.isNaN(target)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - target) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays < days;
}

// Renvoie la date du jour et celle d'il y a `daysAgo` jours, au format YYYY-MM-DD.
function isoDateDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
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

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="bf-modal-backdrop" onClick={onClose}>
      <div className="bf-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// Liens "Me contacter" : affichés dans Paramètres. Icônes de marque réelles
// (react-icons/si) sur un badge aux couleurs du thème — juste l'icône,
// aucun numéro ni identifiant affiché à l'écran.
const CONTACT_LINKS = [
  { label: "WhatsApp", href: "https://wa.me/261383089721", icon: SiWhatsapp, tone: "whatsapp" as const },
  { label: "X", href: "https://x.com/AzhellZettour", icon: SiX, tone: "x" as const },
  { label: "Discord", href: "https://discord.gg/vD7C8Ng4", icon: SiDiscord, tone: "discord" as const },
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

// Menu déroulant stylé "maison" — remplace les <select> natifs, dont le
// menu ouvert est rendu par le système d'exploitation et ne peut pas être
// mis en forme (d'où le look décalé/terne sur mobile).
function CustomSelect({
  id,
  value,
  onChange,
  options,
  className,
  buttonClassName,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  buttonClassName?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div className={`bf-select ${className ?? ""}`} ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`bf-select__button ${buttonClassName ?? ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="bf-select__value">{current?.label ?? "—"}</span>
        <ChevronDown size={15} className={`bf-select__chevron ${open ? "open" : ""}`} />
      </button>
      {open && (
        <div className="bf-select__menu" role="listbox">
          {options.map((o) => (
            <button
              type="button"
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`bf-select__option ${o.value === value ? "selected" : ""}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span className="bf-select__option-check">{o.value === value && <Check size={14} />}</span>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Application principale
// ===========================================================================

type AuthMode = "checking" | "guest" | "account";

export default function App() {
  const initial = useMemo(() => loadAppData(), []);

  // --- Authentification : compte cloud (D1) ou mode local (invité) ----------
  const [authMode, setAuthMode] = useState<AuthMode>("checking");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [cloudAvailable, setCloudAvailable] = useState(true);

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
  const [favoriteMethodIds, setFavoriteMethodIds] = useState<string[]>(() => loadFavoriteMethodsFor(null));
  const [toasts, setToasts] = useState<{ id: string; message: string; tone: "success" | "info" | "danger" }[]>([]);

  const [subjectModal, setSubjectModal] = useState<Subject | "new" | null>(null);
  const [homeworkModal, setHomeworkModal] = useState<Homework | "new" | null>(null);
  const [goalModal, setGoalModal] = useState<Goal | "new" | null>(null);
  const [notionModal, setNotionModal] = useState<Notion | "new" | null>(null);

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
  useEffect(() => saveTheme(theme), [theme]);
  useEffect(() => {
    const ok = saveSettings(settings);
    if (!ok) {
      window.alert(
        "Certains réglages (souvent une image de fond trop lourde) n'ont pas pu être enregistrés sur cet appareil. Essaie une image plus légère ou libère de l'espace de stockage."
      );
    }
  }, [settings]);
  useEffect(() => saveSubjects(subjects), [subjects]);
  useEffect(() => saveHomework(homework), [homework]);
  useEffect(() => saveGoals(goals), [goals]);
  useEffect(() => {
    saveHistoryFor(authMode === "account" ? authUser?.id ?? null : null, history);
  }, [history, authMode, authUser?.id]);
  useEffect(() => {
    saveChatHistoryFor(authMode === "account" ? authUser?.id ?? null : null, chatMessages);
  }, [chatMessages, authMode, authUser?.id]);
  useEffect(() => saveNotions(notions), [notions]);
  useEffect(() => saveStudySessions(studySessions), [studySessions]);
  useEffect(() => {
    saveFavoriteMethodsFor(authMode === "account" ? authUser?.id ?? null : null, favoriteMethodIds);
  }, [favoriteMethodIds, authMode, authUser?.id]);

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
    // L'historique, le chat et les favoris restent locaux (pas de synchro
    // D1), mais doivent être propres à CE compte sur CET appareil — jamais
    // ceux du compte précédent ni du mode invité.
    setHistory(loadHistoryFor(authUser?.id ?? null));
    setChatMessages(loadChatHistoryFor(authUser?.id ?? null));
    setFavoriteMethodIds(loadFavoriteMethodsFor(authUser?.id ?? null));
    let cancelled = false;
    (async () => {
      try {
        const [s, h, g, n, ss] = await Promise.all([
          apiListSubjects(),
          apiListHomework(),
          apiListGoals(),
          apiListNotions(),
          apiListStudySessions(),
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
        setCloudAvailable(true);
      } catch (err) {
        if (!cancelled) handleCloudError(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authMode, authUser?.id]);

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
    if (authMode === "account") apiUpsertSubject(s).catch(handleCloudError);
  }

  function removeSubject(id: string) {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
    setHomework((prev) => prev.map((h) => (h.subjectId === id ? { ...h, subjectId: null } : h)));
    setGoals((prev) => prev.map((g) => (g.subjectId === id ? { ...g, subjectId: null } : g)));
    logEvent("Matière supprimée");
    if (authMode === "account") apiDeleteSubject(id).catch(handleCloudError);
  }

  function persistHomework(h: Homework) {
    setHomework((prev) => {
      const exists = prev.some((p) => p.id === h.id);
      return exists ? prev.map((p) => (p.id === h.id ? h : p)) : [h, ...prev];
    });
    logEvent(`Devoir enregistré : ${h.title}`);
    if (authMode === "account") apiUpsertHomework(h).catch(handleCloudError);
  }

  function removeHomework(id: string) {
    setHomework((prev) => prev.filter((h) => h.id !== id));
    logEvent("Devoir supprimé");
    if (authMode === "account") apiDeleteHomework(id).catch(handleCloudError);
  }

  function cycleHomeworkStatus(id: string) {
    setHomework((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const next: HomeworkStatus =
          h.status === "todo" ? "in_progress" : h.status === "in_progress" ? "done" : "todo";
        const updated = { ...h, status: next };
        if (next === "done") logEvent(`Devoir terminé : ${h.title}`);
        if (authMode === "account") apiUpsertHomework(updated).catch(handleCloudError);
        return updated;
      })
    );
  }

  function persistGoal(g: Goal) {
    setGoals((prev) => {
      const exists = prev.some((p) => p.id === g.id);
      return exists ? prev.map((p) => (p.id === g.id ? g : p)) : [g, ...prev];
    });
    logEvent(`Objectif enregistré : ${g.title}`);
    if (authMode === "account") apiUpsertGoal(g).catch(handleCloudError);
  }

  function removeGoal(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    logEvent("Objectif supprimé");
    if (authMode === "account") apiDeleteGoal(id).catch(handleCloudError);
  }

  function toggleGoalDone(id: string) {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const done = !g.done;
        const updated = { ...g, done, progress: done ? 100 : g.progress };
        if (done) logEvent(`Objectif atteint : ${g.title}`);
        if (authMode === "account") apiUpsertGoal(updated).catch(handleCloudError);
        return updated;
      })
    );
  }

  function changeGoalProgress(id: string, progress: number) {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const updated = { ...g, progress, done: progress >= 100 };
        if (authMode === "account") apiUpsertGoal(updated).catch(handleCloudError);
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
    if (authMode === "account") apiUpsertNotion(n).catch(handleCloudError);
  }

  function removeNotion(id: string) {
    setNotions((prev) => prev.filter((n) => n.id !== id));
    logEvent("Notion supprimée");
    if (authMode === "account") apiDeleteNotion(id).catch(handleCloudError);
  }

  function markNotionReviewed(id: string, nextStatus?: NotionStatus) {
    setNotions((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const updated: Notion = { ...n, lastReviewedAt: Date.now(), status: nextStatus ?? n.status };
        if (authMode === "account") apiUpsertNotion(updated).catch(handleCloudError);
        return updated;
      })
    );
  }

  // --- Sessions d'étude --------------------------------------------------------

  function addStudySession(s: StudySession) {
    setStudySessions((prev) => [s, ...prev]);
    logEvent(`Session d'étude enregistrée (${s.minutes} min)`);
    if (authMode === "account") apiUpsertStudySession(s).catch(handleCloudError);
  }

  function removeStudySession(id: string) {
    setStudySessions((prev) => prev.filter((s) => s.id !== id));
    if (authMode === "account") apiDeleteStudySession(id).catch(handleCloudError);
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
      setSubjects(starterSubjects);
      setHomework([]);
      setGoals([]);
      setNotions([]);
      setStudySessions([]);
      setHistory(loadHistoryFor(null));
      setChatMessages(loadChatHistoryFor(null));
      setFavoriteMethodIds(loadFavoriteMethodsFor(null));
    } else {
      setUser((u) => ({ ...u, loggedIn: false }));
    }
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

  const activeGoals = goals.filter((g) => !g.done);
  const overallProgress =
    goals.length === 0 ? 0 : Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length);

  return (
    <div className="bf-app">
      <aside
        className={`bf-sidebar ${settings.sidebarCollapsed ? "collapsed" : ""} ${mobileSidebarOpen ? "expanded" : ""}`}
        style={
          settings.sidebarBackgroundImage
            ? {
                backgroundImage: `linear-gradient(rgba(var(--bf-primary-rgb), 0.82), rgba(var(--bf-primary-rgb), 0.82)), url(${settings.sidebarBackgroundImage})`,
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
                backgroundImage: `linear-gradient(rgba(var(--bf-bg-rgb), 0.93), rgba(var(--bf-bg-rgb), 0.93)), url(${settings.appBackgroundImage})`,
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
              className="bf-sync-badge"
              title={
                authMode === "account"
                  ? cloudAvailable
                    ? "Compte synchronisé avec le cloud"
                    : "Compte — synchronisation momentanément indisponible"
                  : "Stockage local uniquement (cet appareil)"
              }
            >
              {authMode === "account" ? (
                cloudAvailable ? <Cloud size={13} /> : <AlertTriangle size={13} />
              ) : (
                <HardDrive size={13} />
              )}
              {authMode === "account" ? "Compte" : "Local"}
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
            onGoTo={setSection}
          />
        )}

        {section === "subjects" && (
          <SubjectsSection
            subjects={subjects}
            homework={homework}
            onAdd={() => setSubjectModal("new")}
            onEdit={(s) => setSubjectModal(s)}
            onDelete={removeSubject}
          />
        )}

        {section === "homework" && (
          <HomeworkSection
            homework={homework}
            subjects={subjects}
            onAdd={() => setHomeworkModal("new")}
            onEdit={(h) => setHomeworkModal(h)}
            onDelete={removeHomework}
            onCycleStatus={cycleHomeworkStatus}
          />
        )}

        {section === "goals" && (
          <GoalsSection
            goals={goals}
            subjects={subjects}
            onAdd={() => setGoalModal("new")}
            onEdit={(g) => setGoalModal(g)}
            onDelete={removeGoal}
            onToggleDone={toggleGoalDone}
            onProgressChange={changeGoalProgress}
          />
        )}

        {section === "notions" && (
          <NotionsSection
            notions={notions}
            subjects={subjects}
            onAdd={() => setNotionModal("new")}
            onEdit={(n) => setNotionModal(n)}
            onDelete={removeNotion}
            onMarkReviewed={markNotionReviewed}
          />
        )}

        {section === "methods" && (
          <MethodsSection favoriteIds={favoriteMethodIds} onToggleFavorite={toggleFavoriteMethod} />
        )}

        {section === "planning" && <PlanningSection homework={homework} subjects={subjects} />}

        {section === "progress" && (
          <ProgressSection
            subjects={subjects}
            homework={homework}
            goals={goals}
            notions={notions}
            studySessions={studySessions}
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
          onClose={() => setHomeworkModal(null)}
          onSave={(h) => {
            persistHomework(h);
            setHomeworkModal(null);
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
  onRegister,
  onLogin,
  onGuestContinue,
}: {
  cloudAvailable: boolean;
  onRegister: (email: string, password: string, name: string) => Promise<void>;
  onLogin: (email: string, password: string) => Promise<void>;
  onGuestContinue: (name: string) => void;
}) {
  const [mode, setMode] = useState<"login" | "register" | "guest">(cloudAvailable ? "login" : "guest");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "guest") {
      if (!name.trim()) return;
      onGuestContinue(name.trim());
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
            : "Ton espace d'organisation scolaire, synchronisé entre tes appareils."}
        </p>

        {cloudAvailable && (
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

        <form onSubmit={submit}>
          {mode === "register" && (
            <div className="bf-field">
              <label htmlFor="auth-name">Prénom</label>
              <input id="auth-name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
          )}

          {mode !== "guest" && (
            <>
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
              : "Continuer sans compte"}
          </button>
        </form>

        {mode !== "guest" ? (
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
  onGoTo: (s: SectionId) => void;
}) {
  const todoCount = homework.filter((h) => h.status !== "done").length;

  return (
    <>
      <div className="bf-page-heading">
        <h1>Bonjour {userName}</h1>
        <p>Voici un aperçu de ton espace d'étude.</p>
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
  onAdd,
  onEdit,
  onDelete,
}: {
  subjects: Subject[];
  homework: Homework[];
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
        {subjects.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            tone="primary"
            title="Aucune matière pour l'instant"
            hint="Ajoute ta première matière pour commencer."
          />
        ) : (
          <div className="bf-subject-grid">
            {subjects.map((s) => {
              const count = homework.filter((h) => h.subjectId === s.id && h.status !== "done").length;
              return (
                <div className="bf-subject-card" key={s.id}>
                  <div className="bf-subject-card__top">
                    <div className={`bf-subject-dot swatch-${s.color}`}><SubjectIcon iconKey={s.icon} size={17} /></div>
                    <div style={{ minWidth: 0 }}>
                      <div className="bf-subject-card__name">{s.name}</div>
                      <div className="bf-subject-card__meta">{count} devoir(s) en attente</div>
                    </div>
                  </div>
                  <div className="bf-subject-card__actions">
                    <button className="bf-btn ghost small" onClick={() => onEdit(s)}>
                      Modifier
                    </button>
                    <button className="bf-btn danger small" onClick={() => onDelete(s.id)}>
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

  return (
    <Modal title={subject ? "Modifier la matière" : "Nouvelle matière"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSave({
            id: subject?.id ?? makeId("sub"),
            name: name.trim(),
            color,
            icon,
            createdAt: subject?.createdAt ?? Date.now(),
          });
        }}
      >
        <div className="bf-field">
          <label htmlFor="s-name">Nom de la matière</label>
          <input id="s-name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
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

function HomeworkSection({
  homework,
  subjects,
  onAdd,
  onEdit,
  onDelete,
  onCycleStatus,
}: {
  homework: Homework[];
  subjects: Subject[];
  onAdd: () => void;
  onEdit: (h: Homework) => void;
  onDelete: (id: string) => void;
  onCycleStatus: (id: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | HomeworkStatus>("all");
  const filtered = filter === "all" ? homework : homework.filter((h) => h.status === filter);
  const sorted = [...filtered].sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  });

  return (
    <>
      <div className="bf-page-heading">
        <h1>Devoirs</h1>
        <p>Suis l'avancement de tes devoirs, du premier brouillon jusqu'au rendu.</p>
      </div>
      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Liste des devoirs ({homework.length})</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div className="bf-filter-chips">
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
                  onClick={() => setFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button className="bf-btn primary small" onClick={onAdd}>
              + Nouveau devoir
            </button>
          </div>
        </div>
        {sorted.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            tone="accent"
            title="Aucun devoir ici"
            hint="Ajoute-en un pour t'organiser."
          />
        ) : (
          <div className="bf-list">
            {sorted.map((h) => {
              const subject = subjectById(subjects, h.subjectId);
              return (
                <div className="bf-item-row" key={h.id}>
                  <div className="bf-item-row__main">
                    <div className="bf-item-row__title">{h.title}</div>
                    <div className="bf-item-row__meta">
                      {subject && <span className="bf-inline-icon"><SubjectIcon iconKey={subject.icon} size={12} /> {subject.name}</span>}
                      <span>{formatDateFR(h.dueDate)}</span>
                    </div>
                  </div>
                  <button className={`bf-tag status-${h.status}`} style={{ border: "none", cursor: "pointer" }} onClick={() => onCycleStatus(h.id)} title="Changer le statut">
                    {STATUS_LABEL[h.status]}
                  </button>
                  <div className="bf-item-row__actions">
                    <button className="bf-btn ghost small" onClick={() => onEdit(h)}>
                      Modifier
                    </button>
                    <button className="bf-btn danger small" onClick={() => onDelete(h.id)}>
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

function HomeworkFormModal({
  homework,
  subjects,
  onClose,
  onSave,
}: {
  homework: Homework | null;
  subjects: Subject[];
  onClose: () => void;
  onSave: (h: Homework) => void;
}) {
  const [title, setTitle] = useState(homework?.title ?? "");
  const [subjectId, setSubjectId] = useState<string>(homework?.subjectId ?? "");
  const [dueDate, setDueDate] = useState(homework?.dueDate ?? "");
  const [status, setStatus] = useState<HomeworkStatus>(homework?.status ?? "todo");
  const [notes, setNotes] = useState(homework?.notes ?? "");

  return (
    <Modal title={homework ? "Modifier le devoir" : "Nouveau devoir"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onSave({
            id: homework?.id ?? makeId("hw"),
            title: title.trim(),
            subjectId: subjectId || null,
            dueDate: dueDate || null,
            status,
            notes: notes.trim(),
            createdAt: homework?.createdAt ?? Date.now(),
          });
        }}
      >
        <div className="bf-field">
          <label htmlFor="hw-title">Titre</label>
          <input id="hw-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
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
  onAdd,
  onEdit,
  onDelete,
  onToggleDone,
  onProgressChange,
}: {
  goals: Goal[];
  subjects: Subject[];
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
        {goals.length === 0 ? (
          <EmptyState
            icon={Target}
            tone="cyan"
            title="Aucun objectif pour le moment"
            hint="Fixe-toi un premier objectif !"
          />
        ) : (
          <div className="bf-list">
            {goals.map((g) => {
              const subject = subjectById(subjects, g.subjectId);
              const isLate = !g.done && !!g.targetDate && (daysUntil(g.targetDate) ?? 0) < 0;
              return (
                <div className="bf-item-row" key={g.id} style={{ flexDirection: "column", alignItems: "stretch" }}>
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
                      <button className="bf-btn ghost small" onClick={() => onToggleDone(g.id)}>
                        {g.done ? "Rouvrir" : "Marquer terminé"}
                      </button>
                      <button className="bf-btn ghost small" onClick={() => onEdit(g)}>
                        Modifier
                      </button>
                      <button className="bf-btn danger small" onClick={() => onDelete(g.id)}>
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

  return (
    <Modal title={goal ? "Modifier l'objectif" : "Nouvel objectif"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
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
        <div className="bf-field">
          <label htmlFor="g-title">Titre de l'objectif</label>
          <input id="g-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="Ex: Réviser les mathématiques" />
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

function NotionsSection({
  notions,
  subjects,
  onAdd,
  onEdit,
  onDelete,
  onMarkReviewed,
}: {
  notions: Notion[];
  subjects: Subject[];
  onAdd: () => void;
  onEdit: (n: Notion) => void;
  onDelete: (id: string) => void;
  onMarkReviewed: (id: string, nextStatus?: NotionStatus) => void;
}) {
  const [filterSubject, setFilterSubject] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | NotionStatus>("all");

  const filtered = notions.filter((n) => {
    if (filterSubject && n.subjectId !== filterSubject) return false;
    if (filterStatus !== "all" && n.status !== filterStatus) return false;
    return true;
  });

  return (
    <>
      <div className="bf-page-heading">
        <h1>Notions</h1>
        <p>Suis ce que tu maîtrises, matière par matière, chapitre par chapitre.</p>
      </div>

      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Toutes les notions ({notions.length})</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
            <button className="bf-btn primary small" onClick={onAdd}>
              + Nouvelle notion
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
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
          <div className="bf-list">
            {filtered.map((n) => {
              const subject = subjectById(subjects, n.subjectId);
              return (
                <div className="bf-item-row" key={n.id}>
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
                    <button className="bf-btn ghost small" onClick={() => onMarkReviewed(n.id)}>
                      Révisée aujourd'hui
                    </button>
                    <button className="bf-btn ghost small" onClick={() => onEdit(n)}>
                      Modifier
                    </button>
                    <button className="bf-btn danger small" onClick={() => onDelete(n.id)}>
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

  return (
    <Modal title={notion ? "Modifier la notion" : "Nouvelle notion"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
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
        <div className="bf-field">
          <label htmlFor="n-name">Nom de la notion</label>
          <input id="n-name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Ex: Théorème de Pythagore" />
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

function PlanningSection({ homework, subjects }: { homework: Homework[]; subjects: Subject[] }) {
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
      <div className="bf-page-heading">
        <h1>Planning</h1>
        <p>Vue chronologique de tes devoirs à venir.</p>
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
// Section : Progression
// ===========================================================================

function ProgressSection({
  subjects,
  homework,
  goals,
  notions,
  studySessions,
  onAddStudySession,
}: {
  subjects: Subject[];
  homework: Homework[];
  goals: Goal[];
  notions: Notion[];
  studySessions: StudySession[];
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
}) {
  const [name, setName] = useState(user.name);
  const isAccount = authMode === "account";

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
            Mets une image en fond du menu (compressée automatiquement à l'enregistrement).
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {settings.sidebarBackgroundImage && (
              <img
                src={settings.sidebarBackgroundImage}
                alt="Aperçu du fond de la barre latérale"
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
                    window.alert("Impossible de traiter cette image. Essaie un autre fichier.");
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
        </div>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--bf-border)" }}>
          <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Fond de l'application</p>
          <p style={{ fontSize: 13, color: "var(--bf-text-muted)", marginBottom: 12 }}>
            Mets une image en fond de toute la zone de contenu, derrière le menu (compressée automatiquement).
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {settings.appBackgroundImage && (
              <img
                src={settings.appBackgroundImage}
                alt="Aperçu du fond de l'application"
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
                    window.alert("Impossible de traiter cette image. Essaie un autre fichier.");
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
