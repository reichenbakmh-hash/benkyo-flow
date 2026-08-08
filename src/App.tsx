import { useEffect, useMemo, useState } from "react";
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
} from "./lib/storage";

// ===========================================================================
// Constantes & petites aides
// ===========================================================================

type SectionId =
  | "home"
  | "subjects"
  | "homework"
  | "goals"
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
  { id: "planning", label: "Planning", icon: "🗓️" },
  { id: "progress", label: "Progression", icon: "📊" },
  { id: "history", label: "Historique", icon: "🕒" },
  { id: "assistant", label: "Assistant IA", icon: "💬" },
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

  const [subjectModal, setSubjectModal] = useState<Subject | "new" | null>(null);
  const [homeworkModal, setHomeworkModal] = useState<Homework | "new" | null>(null);
  const [goalModal, setGoalModal] = useState<Goal | "new" | null>(null);

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
        const [s, h, g] = await Promise.all([apiListSubjects(), apiListHomework(), apiListGoals()]);
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

  async function sendChatMessage(text: string) {
    const userMessage: ChatMessage = { id: makeId("msg"), role: "user", content: text, createdAt: Date.now() };
    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);

    const reply = await apiChatSend(nextMessages.map((m) => ({ role: m.role, content: m.content })));

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
            aria-label="Réduire ou agrandir le menu"
            onClick={() => {
              if (window.innerWidth <= 860) {
                setMobileSidebarOpen((v) => !v);
              } else {
                setSettings((s) => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }));
              }
            }}
          >
            ☰
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

      <div className="bf-content">
        <div className="bf-topbar">
          <div className="bf-topbar__title">{SECTIONS.find((s) => s.id === section)?.label}</div>
          <div className="bf-topbar__actions">
            <ThemeSwitch theme={theme} onChange={setTheme} />
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
            <button className="bf-logout" onClick={handleLogout}>
              Déconnexion
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

        {section === "planning" && <PlanningSection homework={homework} subjects={subjects} />}

        {section === "progress" && (
          <ProgressSection subjects={subjects} homework={homework} goals={goals} />
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
            createdAt: goal?.createdAt ?? Date.now(),
          });
        }}
      >
        <div className="bf-field">
          <label htmlFor="g-title">Titre de l'objectif</label>
          <input id="g-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="Ex: Réviser les mathématiques" />
        </div>
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
}: {
  subjects: Subject[];
  homework: Homework[];
  goals: Goal[];
}) {
  const totalHw = homework.length;
  const doneHw = homework.filter((h) => h.status === "done").length;
  const hwRate = totalHw === 0 ? 0 : Math.round((doneHw / totalHw) * 100);

  return (
    <>
      <div className="bf-page-heading">
        <h1>Progression</h1>
        <p>Une vue d'ensemble de ton avancement, matière par matière.</p>
      </div>

      <div className="bf-info-cards">
        <InfoCard icon="✅" tone="success" label="Devoirs terminés" value={`${doneHw}/${totalHw}`} />
        <InfoCard icon="📈" tone="primary" label="Taux de complétion" value={`${hwRate}%`} />
        <InfoCard icon="🎯" tone="accent" label="Objectifs atteints" value={`${goals.filter((g) => g.done).length}/${goals.length}`} />
        <InfoCard icon="📘" tone="info" label="Matières actives" value={subjects.length} />
      </div>

      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Progression par matière</h2>
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

  return (
    <>
      <div className="bf-page-heading">
        <h1>Benkyō IA</h1>
        <p>Pose une question, demande de l'aide pour organiser ton travail ou comprendre une notion.</p>
      </div>

      <div className="bf-panel">
        <div className="bf-panel__header">
          <h2>Conversation</h2>
          {messages.length > 0 && (
            <button className="bf-btn ghost small" onClick={onClear}>
              Vider la conversation
            </button>
          )}
        </div>

        <div className="bf-chat__messages">
          {messages.length === 0 ? (
            <div className="bf-empty">
              Pose ta question — par exemple « Aide-moi à organiser ma semaine de révisions »
              ou « Explique-moi les fractions ».
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`bf-chat__bubble ${m.role}`}>
                {m.content}
              </div>
            ))
          )}
          {busy && <div className="bf-chat__bubble assistant bf-chat__typing">Je réfléchis…</div>}
        </div>

        {error && (
          <p className="bf-auth__error" style={{ marginTop: 4, marginBottom: 8 }}>
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
          <button className="bf-btn primary" type="submit" disabled={busy || !input.trim()}>
            Envoyer
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
