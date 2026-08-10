import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, FormEvent } from "react";
import {
  loadAppData,
  saveUser,
  saveSubjects,
  saveHomework,
  saveGoals,
  saveHistory,
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
  loadChatHistory,
  saveChatHistory,
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
  loadFavoriteMethods,
  saveFavoriteMethods,
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
} from "./lib/storage";
import { STUDY_METHODS, METHOD_CATEGORIES } from "./lib/methods";
import type { StudyMethod, MethodCategory, MethodDifficulty } from "./lib/methods";

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

const SECTIONS: { id: SectionId; label: string; icon: string }[] = [
  { id: "home", label: "Accueil", icon: "🏠" },
  { id: "subjects", label: "Matières", icon: "📘" },
  { id: "homework", label: "Devoirs", icon: "📝" },
  { id: "goals", label: "Objectifs", icon: "🎯" },
  { id: "notions", label: "Notions", icon: "🧩" },
  { id: "methods", label: "Méthodes", icon: "✨" },
  { id: "planning", label: "Planning", icon: "🗓️" },
  { id: "progress", label: "Progression", icon: "📊" },
  { id: "history", label: "Historique", icon: "🕒" },
  { id: "assistant", label: "Benkyō IA", icon: "💬" },
  { id: "settings", label: "Paramètres", icon: "⚙️" },
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

function subjectById(subjects: Subject[], id: string | null): Subject | undefined {
  if (!id) return undefined;
  return subjects.find((s) => s.id === id);
}

// ===========================================================================
// Petits composants réutilisables
// ===========================================================================

function InfoCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: string;
  tone: "primary" | "accent" | "success" | "info";
  label: string;
  value: string | number;
}) {
  return (
    <div className="bf-card">
      <div className={`bf-card__icon tone-${tone}`}>{icon}</div>
      <div className="bf-card__info">
        <h3>{label}</h3>
        <p>{value}</p>
      </div>
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

  const [subjects, setSubjects] = useState<Subject[]>(initial.subjects);
  const [homework, setHomework] = useState<Homework[]>(initial.homework);
  const [goals, setGoals] = useState<Goal[]>(initial.goals);
  const [history, setHistory] = useState<HistoryEntry[]>(initial.history);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => loadChatHistory());
  const [notions, setNotions] = useState<Notion[]>(() => loadNotions());
  const [studySessions, setStudySessions] = useState<StudySession[]>(() => loadStudySessions());
  const [favoriteMethodIds, setFavoriteMethodIds] = useState<string[]>(() => loadFavoriteMethods());

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

  // --- Application du thème sur <html data-theme="..."> --------------------
  useEffect(() => {
    const apply = () => {
      const prefersDark =
        window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      const isDark = theme === "dark" || (theme === "system" && prefersDark);
      document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    };
    apply();
    if (theme === "system" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  // --- Persistance locale : sert de cache et de mode de secours -------------
  useEffect(() => saveUser(user), [user]);
  useEffect(() => saveTheme(theme), [theme]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveSubjects(subjects), [subjects]);
  useEffect(() => saveHomework(homework), [homework]);
  useEffect(() => saveGoals(goals), [goals]);
  useEffect(() => saveHistory(history), [history]);
  useEffect(() => saveChatHistory(chatMessages), [chatMessages]);
  useEffect(() => saveNotions(notions), [notions]);
  useEffect(() => saveStudySessions(studySessions), [studySessions]);
  useEffect(() => saveFavoriteMethods(favoriteMethodIds), [favoriteMethodIds]);

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
        if (s.length === 0) {
          for (const sub of starterSubjects) {
            await apiUpsertSubject(sub).catch(() => {});
          }
          setSubjects(starterSubjects);
        } else {
          setSubjects(s);
        }
        setHomework(h);
        setGoals(g);
        setNotions(n);
        setStudySessions(ss);
        setCloudAvailable(true);
      } catch {
        setCloudAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authMode]);

  function logEvent(label: string) {
    setHistory((prev) => [{ id: makeId("hist"), label, date: Date.now() }, ...prev].slice(0, 100));
  }

  // --- Fonctions de mutation : mettent à jour l'état local ET, si un compte
  //     est actif, synchronisent avec D1 en tâche de fond (best-effort). -----

  function persistSubject(s: Subject) {
    setSubjects((prev) => {
      const exists = prev.some((p) => p.id === s.id);
      return exists ? prev.map((p) => (p.id === s.id ? s : p)) : [...prev, s];
    });
    logEvent(`Matière enregistrée : ${s.name}`);
    if (authMode === "account") apiUpsertSubject(s).catch(() => setCloudAvailable(false));
  }

  function removeSubject(id: string) {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
    setHomework((prev) => prev.map((h) => (h.subjectId === id ? { ...h, subjectId: null } : h)));
    setGoals((prev) => prev.map((g) => (g.subjectId === id ? { ...g, subjectId: null } : g)));
    logEvent("Matière supprimée");
    if (authMode === "account") apiDeleteSubject(id).catch(() => setCloudAvailable(false));
  }

  function persistHomework(h: Homework) {
    setHomework((prev) => {
      const exists = prev.some((p) => p.id === h.id);
      return exists ? prev.map((p) => (p.id === h.id ? h : p)) : [h, ...prev];
    });
    logEvent(`Devoir enregistré : ${h.title}`);
    if (authMode === "account") apiUpsertHomework(h).catch(() => setCloudAvailable(false));
  }

  function removeHomework(id: string) {
    setHomework((prev) => prev.filter((h) => h.id !== id));
    logEvent("Devoir supprimé");
    if (authMode === "account") apiDeleteHomework(id).catch(() => setCloudAvailable(false));
  }

  function cycleHomeworkStatus(id: string) {
    setHomework((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const next: HomeworkStatus =
          h.status === "todo" ? "in_progress" : h.status === "in_progress" ? "done" : "todo";
        const updated = { ...h, status: next };
        if (next === "done") logEvent(`Devoir terminé : ${h.title}`);
        if (authMode === "account") apiUpsertHomework(updated).catch(() => setCloudAvailable(false));
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
    if (authMode === "account") apiUpsertGoal(g).catch(() => setCloudAvailable(false));
  }

  function removeGoal(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    logEvent("Objectif supprimé");
    if (authMode === "account") apiDeleteGoal(id).catch(() => setCloudAvailable(false));
  }

  function toggleGoalDone(id: string) {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const done = !g.done;
        const updated = { ...g, done, progress: done ? 100 : g.progress };
        if (done) logEvent(`Objectif atteint : ${g.title}`);
        if (authMode === "account") apiUpsertGoal(updated).catch(() => setCloudAvailable(false));
        return updated;
      })
    );
  }

  function changeGoalProgress(id: string, progress: number) {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const updated = { ...g, progress, done: progress >= 100 };
        if (authMode === "account") apiUpsertGoal(updated).catch(() => setCloudAvailable(false));
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
    if (authMode === "account") apiUpsertNotion(n).catch(() => setCloudAvailable(false));
  }

  function removeNotion(id: string) {
    setNotions((prev) => prev.filter((n) => n.id !== id));
    logEvent("Notion supprimée");
    if (authMode === "account") apiDeleteNotion(id).catch(() => setCloudAvailable(false));
  }

  function markNotionReviewed(id: string, nextStatus?: NotionStatus) {
    setNotions((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const updated: Notion = { ...n, lastReviewedAt: Date.now(), status: nextStatus ?? n.status };
        if (authMode === "account") apiUpsertNotion(updated).catch(() => setCloudAvailable(false));
        return updated;
      })
    );
  }

  // --- Sessions d'étude --------------------------------------------------------

  function addStudySession(s: StudySession) {
    setStudySessions((prev) => [s, ...prev]);
    logEvent(`Session d'étude enregistrée (${s.minutes} min)`);
    if (authMode === "account") apiUpsertStudySession(s).catch(() => setCloudAvailable(false));
  }

  function removeStudySession(id: string) {
    setStudySessions((prev) => prev.filter((s) => s.id !== id));
    if (authMode === "account") apiDeleteStudySession(id).catch(() => setCloudAvailable(false));
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

  async function sendChatMessage(text: string) {
    const userMessage: ChatMessage = { id: makeId("msg"), role: "user", content: text, createdAt: Date.now() };
    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);

    const reply = await apiChatSend(
      nextMessages.map((m) => ({ role: m.role, content: m.content })),
      buildAiContext()
    );

    setChatMessages((prev) => [
      ...prev,
      { id: makeId("msg"), role: "assistant", content: reply, createdAt: Date.now() },
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
    } else {
      setUser((u) => ({ ...u, loggedIn: false }));
    }
  }

  // --- Ecran de chargement (vérification de session) -------------------------
  if (authMode === "checking") {
    return (
      <div className="bf-auth">
        <div className="bf-auth__card">
          <div className="bf-auth__brand">Benkyō Flow</div>
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
      <aside className={`bf-sidebar ${settings.sidebarCollapsed ? "collapsed" : ""} ${mobileSidebarOpen ? "expanded" : ""}`}>
        <div className="bf-sidebar__header">
          <div className="bf-sidebar__brand">
            <span className="bf-sidebar__brand-mark">🌱</span>
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
            {mobileSidebarOpen ? "✕" : "☰"}
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
                <span className="bf-menu__icon">{s.icon}</span>
                <span className="bf-menu__label">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="bf-sidebar__footer">
          <span className="bf-sidebar__footer-text">Benkyō Flow · V1</span>
        </div>
      </aside>

      <div
        className={`bf-sidebar-backdrop ${mobileSidebarOpen ? "visible" : ""}`}
        onClick={() => setMobileSidebarOpen(false)}
        aria-hidden="true"
      />

      <div className="bf-content">
        <div className="bf-topbar">
          <button
            type="button"
            className="bf-mobile-menu-btn"
            aria-label="Ouvrir le menu"
            onClick={() => setMobileSidebarOpen(true)}
          >
            ☰
          </button>
          <div className="bf-topbar__title">{SECTIONS.find((s) => s.id === section)?.label}</div>
          <div className="bf-topbar__actions">
            <ThemeSwitch theme={theme} onChange={setTheme} />
            {installAvailable && !isStandalone && (
              <button className="bf-btn primary small bf-install-btn" onClick={handleInstallClick}>
                📲 <span className="bf-btn-label">Installer</span>
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
              {authMode === "account" ? (cloudAvailable ? "☁️ Compte" : "⚠️ Compte") : "💾 Local"}
            </span>
            <div className="bf-user">
              <div className="bf-user__avatar">{displayName.slice(0, 1).toUpperCase()}</div>
              <span className="bf-user__name">{displayName}</span>
            </div>
            <button className="bf-logout" onClick={handleLogout} aria-label="Déconnexion">
              <span className="bf-btn-label">Déconnexion</span>
              <span className="bf-logout__icon">🌐</span>
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
        <div className="bf-auth__brand">Benkyō Flow</div>
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
  const options: { id: ThemeMode; icon: string; label: string }[] = [
    { id: "light", icon: "☀️", label: "Mode jour" },
    { id: "dark", icon: "🌙", label: "Mode nuit" },
    { id: "system", icon: "🖥️", label: "Mode système" },
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
          {o.icon}
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
        <h1>Bonjour {userName} 👋</h1>
        <p>Voici un aperçu de ton espace d'étude.</p>
      </div>

      <div className="bf-info-cards">
        <InfoCard icon="📘" tone="primary" label="Matières" value={subjects.length} />
        <InfoCard icon="📝" tone="accent" label="Devoirs à faire" value={todoCount} />
        <InfoCard icon="🎯" tone="success" label="Objectifs en cours" value={activeGoalsCount} />
        <InfoCard icon="📊" tone="info" label="Progression générale" value={`${overallProgress}%`} />
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
                        {subject && <span>{subject.icon} {subject.name}</span>}
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
          <div className="bf-empty">Aucune matière pour l'instant. Ajoute ta première matière !</div>
        ) : (
          <div className="bf-subject-grid">
            {subjects.map((s) => {
              const count = homework.filter((h) => h.subjectId === s.id && h.status !== "done").length;
              return (
                <div className="bf-subject-card" key={s.id}>
                  <div className="bf-subject-card__top">
                    <div className={`bf-subject-dot swatch-${s.color}`}>{s.icon}</div>
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
  const [icon, setIcon] = useState(subject?.icon ?? "📘");

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
            icon: icon.trim() || "📘",
            createdAt: subject?.createdAt ?? Date.now(),
          });
        }}
      >
        <div className="bf-field">
          <label htmlFor="s-name">Nom de la matière</label>
          <input id="s-name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="bf-field">
          <label htmlFor="s-icon">Icône (emoji)</label>
          <input id="s-icon" type="text" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={filter} onChange={(e) => setFilter(e.target.value as any)} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--bf-border)", background: "var(--bf-bg-elevated)", color: "var(--bf-text)" }}>
              <option value="all">Tous</option>
              <option value="todo">À faire</option>
              <option value="in_progress">En cours</option>
              <option value="done">Terminé</option>
            </select>
            <button className="bf-btn primary small" onClick={onAdd}>
              + Nouveau devoir
            </button>
          </div>
        </div>
        {sorted.length === 0 ? (
          <div className="bf-empty">Aucun devoir ici. Ajoute-en un pour t'organiser.</div>
        ) : (
          <div className="bf-list">
            {sorted.map((h) => {
              const subject = subjectById(subjects, h.subjectId);
              return (
                <div className="bf-item-row" key={h.id}>
                  <div className="bf-item-row__main">
                    <div className="bf-item-row__title">{h.title}</div>
                    <div className="bf-item-row__meta">
                      {subject && <span>{subject.icon} {subject.name}</span>}
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
            <select id="hw-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Aucune</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="bf-field">
            <label htmlFor="hw-due">Échéance</label>
            <input id="hw-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="bf-field">
          <label htmlFor="hw-status">Statut</label>
          <select id="hw-status" value={status} onChange={(e) => setStatus(e.target.value as HomeworkStatus)}>
            <option value="todo">À faire</option>
            <option value="in_progress">En cours</option>
            <option value="done">Terminé</option>
          </select>
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
          <div className="bf-empty">Aucun objectif pour le moment. Crée ton premier objectif !</div>
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
                        {subject && <span>{subject.icon} {subject.name}</span>}
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
            <select id="g-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Aucune</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
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
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--bf-border)", background: "var(--bf-bg-elevated)", color: "var(--bf-text)" }}
            >
              <option value="">Toutes les matières</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--bf-border)", background: "var(--bf-bg-elevated)", color: "var(--bf-text)" }}
            >
              <option value="all">Tous les statuts</option>
              {(Object.keys(NOTION_STATUS_LABEL) as NotionStatus[]).map((st) => (
                <option key={st} value={st}>
                  {NOTION_STATUS_LABEL[st]}
                </option>
              ))}
            </select>
            <button className="bf-btn primary small" onClick={onAdd}>
              + Nouvelle notion
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bf-empty">
            {notions.length === 0
              ? "Aucune notion pour l'instant. Ajoute les notions importantes de tes cours pour suivre ce que tu maîtrises."
              : "Aucune notion ne correspond à ces filtres."}
          </div>
        ) : (
          <div className="bf-list">
            {filtered.map((n) => {
              const subject = subjectById(subjects, n.subjectId);
              return (
                <div className="bf-item-row" key={n.id}>
                  <div className="bf-item-row__main">
                    <div className="bf-item-row__title">{n.name}</div>
                    <div className="bf-item-row__meta">
                      {subject && <span>{subject.icon} {subject.name}</span>}
                      {n.chapter && <span>{n.chapter}</span>}
                      {n.lastReviewedAt && <span>Révisée le {new Date(n.lastReviewedAt).toLocaleDateString("fr-FR")}</span>}
                    </div>
                  </div>
                  <select
                    value={n.status}
                    onChange={(e) => onMarkReviewed(n.id, e.target.value as NotionStatus)}
                    className={`bf-tag status-${n.status === "maitrisee" ? "done" : n.status === "a_revoir" ? "todo" : "in_progress"}`}
                    style={{ border: "none", cursor: "pointer" }}
                  >
                    {(Object.keys(NOTION_STATUS_LABEL) as NotionStatus[]).map((st) => (
                      <option key={st} value={st}>
                        {NOTION_STATUS_LABEL[st]}
                      </option>
                    ))}
                  </select>
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
            <select id="n-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Aucune</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="bf-field">
            <label htmlFor="n-chapter">Chapitre (optionnel)</label>
            <input id="n-chapter" type="text" value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="Ex: Géométrie" />
          </div>
        </div>
        <div className="bf-form-row">
          <div className="bf-field">
            <label htmlFor="n-status">Statut</label>
            <select id="n-status" value={status} onChange={(e) => setStatus(e.target.value as NotionStatus)}>
              {(Object.keys(NOTION_STATUS_LABEL) as NotionStatus[]).map((st) => (
                <option key={st} value={st}>
                  {NOTION_STATUS_LABEL[st]}
                </option>
              ))}
            </select>
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
            ⭐ Favoris
          </button>
          {METHOD_CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`bf-chip ${category === c.id ? "active" : ""}`}
              onClick={() => setCategory(c.id)}
            >
              {c.icon} {c.label}
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
                      {METHOD_CATEGORIES.find((c) => c.id === m.categories[0])?.icon ?? "✨"}
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
                      {isFav ? "★" : "☆"}
                    </span>
                  </div>
                  <div className="bf-method-card__name">{m.name}</div>
                  <div className="bf-method-card__desc">{m.shortDescription}</div>
                  <div className="bf-method-card__tags">
                    <span className={`bf-tag-diff ${m.difficulty}`}>{DIFFICULTY_LABEL[m.difficulty]}</span>
                    {m.recommendedDuration && <span className="bf-method-card__duration">⏱ {m.recommendedDuration}</span>}
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
          {method.recommendedDuration && <span className="bf-method-card__duration">⏱ {method.recommendedDuration}</span>}
        </div>

        <p className="bf-method-detail__desc">{method.shortDescription}</p>

        <div className="bf-method-detail__block">
          <h3>🎯 Objectif</h3>
          <p>{method.objective}</p>
        </div>

        <div className="bf-method-detail__block">
          <h3>🕐 Quand l'utiliser</h3>
          <p>{method.whenToUse}</p>
        </div>

        <div className="bf-method-detail__block">
          <h3>📋 Comment l'utiliser</h3>
          <ol className="bf-method-detail__steps">
            {method.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>

        {method.usefulSubjects.length > 0 && (
          <div className="bf-method-detail__block">
            <h3>📘 Particulièrement utile pour</h3>
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
            {isFavorite ? "★ Retirer des favoris" : "☆ Ajouter aux favoris"}
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
                          {subject && <span>{subject.icon} {subject.name}</span>}
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
        <InfoCard icon="✅" tone="success" label="Devoirs terminés" value={`${doneHw}/${totalHw}`} />
        <InfoCard icon="📈" tone="primary" label="Taux de complétion" value={`${hwRate}%`} />
        <InfoCard icon="🎯" tone="accent" label="Objectifs atteints" value={`${doneGoals}/${goals.length}`} />
        <InfoCard icon="⏱️" tone="info" label="Étude aujourd'hui" value={`${todayMinutes} min`} />
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
            <select id="ss-subject" value={sessionSubjectId} onChange={(e) => setSessionSubjectId(e.target.value)}>
              <option value="">Aucune</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
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
                  <span>{subject.icon} {subject.name}</span>
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
            <span>✅ {doneGoals} terminés</span>
            <span>🕓 {activeGoals.length} en cours</span>
            <span>⚠️ {lateGoals.length} en retard</span>
            {goals.length > 0 && <span>📊 {goalRate}% de réussite</span>}
          </div>
        </div>

        <div className="bf-panel">
          <div className="bf-panel__header">
            <h2>Devoirs</h2>
          </div>
          <div className="bf-mini-stats">
            <span>✅ {doneHw} terminés</span>
            <span>🕓 {pendingHw.length} en attente</span>
            <span>⚠️ {lateHw.length} en retard</span>
            <span>⏳ {soonHw.length} proches (≤ 3 j)</span>
          </div>
        </div>
      </div>

      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Notions à revoir</h2>
        </div>
        <div className="bf-mini-stats" style={{ marginBottom: notions.length > 0 ? 12 : 0 }}>
          <span>🆕 {notionCounts.non_etudiee} non étudiées</span>
          <span>📖 {notionCounts.a_apprendre} à apprendre</span>
          <span>🔄 {notionCounts.en_cours} en cours</span>
          <span>⏰ {notionCounts.a_revoir} à revoir</span>
          <span>🏆 {notionCounts.maitrisee} maîtrisées</span>
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
                      {subject && <span>{subject.icon} {subject.name}</span>}
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
                    <span>{s.icon} {s.name}</span>
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
}: {
  messages: ChatMessage[];
  onSend: (text: string) => Promise<void>;
  onClear: () => void;
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
        <h1>Partenaire</h1>
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
              <div className="bf-chat__empty-icon">🤖</div>
              <p>C'est ici que commence la conversation.</p>
              <p className="bf-chat__empty-hint">
                Essaie : « Aide-moi à organiser ma semaine de révisions » ou « Explique-moi les fractions ».
              </p>
            </div>
          ) : (
            grouped.map((m) => (
              <div key={m.id} className={`bf-chat__row ${m.role} ${m.startsGroup ? "" : "grouped"}`}>
                {m.startsGroup ? (
                  <div className={`bf-chat__avatar ${m.role}`}>{m.role === "assistant" ? "🤖" : "🙂"}</div>
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
                </div>
              </div>
            ))
          )}
          {busy && (
            <div className="bf-chat__row assistant">
              <div className="bf-chat__avatar assistant">🤖</div>
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
            ➤
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
          <h2>Apparence</h2>
        </div>
        <p style={{ fontSize: 13.5, color: "var(--bf-text-muted)", marginBottom: 10 }}>
          Choisis le thème de l'application.
        </p>
        <ThemeSwitch theme={theme} onChange={onThemeChange} />
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
      </div>

      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Installation</h2>
        </div>
        {isStandalone ? (
          <p style={{ fontSize: 13.5, color: "var(--bf-text-muted)" }}>
            ✅ Benkyō Flow est déjà installée sur cet appareil.
          </p>
        ) : installAvailable ? (
          <>
            <p style={{ fontSize: 13.5, color: "var(--bf-text-muted)", marginBottom: 10 }}>
              Installe Benkyō Flow comme une application : icône sur l'écran d'accueil, lancement en plein
              écran, sans la barre d'adresse du navigateur.
            </p>
            <button className="bf-btn primary" onClick={onInstallClick}>
              📲 Installer Benkyō Flow
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
