// ---------------------------------------------------------------------------
// Benkyo Flow — Minuteur Pomodoro
// ---------------------------------------------------------------------------
// L'état de la session en cours (phase, échéance, matière choisie...) vit
// dans localStorage sous une clé dédiée, séparée des réglages (AppSettings).
// C'est un état transitoire, pas une préférence : il doit survivre à un
// rechargement de page ou à un changement de section, mais n'a pas vocation
// à se synchroniser entre appareils.
//
// Choix clé : le décompte ne repose jamais sur un simple compteur de
// secondes qu'on décrémenterait à chaque tick. On stocke `endAt` (l'horaire
// exact de fin, en millisecondes) et on calcule le temps restant par
// différence avec `Date.now()`. Ainsi, si l'onglet est mis en arrière-plan
// et que le navigateur ralentit ou suspend les timers JS, le minuteur reste
// exact dès qu'il redevient actif — pas de dérive.
// ---------------------------------------------------------------------------

export type PomodoroPhase = "work" | "short_break" | "long_break";

export interface PomodoroSettings {
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
}

export const defaultPomodoroSettings: PomodoroSettings = {
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

export const POMODORO_PRESETS: { id: string; label: string; settings: PomodoroSettings }[] = [
  {
    id: "classic",
    label: "Classique 25 / 5",
    settings: { workMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLongBreak: 4 },
  },
  {
    id: "long-focus",
    label: "Concentration longue 50 / 10",
    settings: { workMinutes: 50, breakMinutes: 10, longBreakMinutes: 20, sessionsBeforeLongBreak: 3 },
  },
  {
    id: "short-sprint",
    label: "Sprint court 15 / 3",
    settings: { workMinutes: 15, breakMinutes: 3, longBreakMinutes: 10, sessionsBeforeLongBreak: 4 },
  },
];

export const PHASE_LABEL: Record<PomodoroPhase, string> = {
  work: "Session de travail",
  short_break: "Pause courte",
  long_break: "Pause longue",
};

export interface PomodoroRunState {
  phase: PomodoroPhase;
  running: boolean;
  endAt: number | null; // horodatage (ms) de fin de la phase, présent uniquement si `running`
  remainingMs: number; // temps restant, valable quand la phase est en pause
  durationMs: number; // durée totale de la phase en cours (sert à calculer le temps écoulé)
  subjectId: string | null;
  completedWorkSessions: number; // sessions de travail terminées depuis la dernière pause longue
}

const RUN_KEY = "benkyo-flow:pomodoro-run";

export function phaseDurationMs(phase: PomodoroPhase, settings: PomodoroSettings): number {
  const minutes =
    phase === "work" ? settings.workMinutes : phase === "short_break" ? settings.breakMinutes : settings.longBreakMinutes;
  return Math.max(1, minutes) * 60 * 1000;
}

export function freshRunState(settings: PomodoroSettings, subjectId: string | null = null): PomodoroRunState {
  const durationMs = phaseDurationMs("work", settings);
  return {
    phase: "work",
    running: false,
    endAt: null,
    remainingMs: durationMs,
    durationMs,
    subjectId,
    completedWorkSessions: 0,
  };
}

export function loadPomodoroRunState(settings: PomodoroSettings): PomodoroRunState {
  try {
    const raw = window.localStorage.getItem(RUN_KEY);
    if (!raw) return freshRunState(settings);
    const parsed = JSON.parse(raw) as Partial<PomodoroRunState>;
    return { ...freshRunState(settings), ...parsed };
  } catch {
    return freshRunState(settings);
  }
}

export function savePomodoroRunState(state: PomodoroRunState): void {
  try {
    window.localStorage.setItem(RUN_KEY, JSON.stringify(state));
  } catch {
    // Best-effort : si le stockage est indisponible, le minuteur continue
    // de fonctionner pour la session en cours, simplement sans persistance.
  }
}

export function clearPomodoroRunState(): void {
  try {
    window.localStorage.removeItem(RUN_KEY);
  } catch {
    // ignoré
  }
}

// Temps restant actuel de la phase, en millisecondes — jamais négatif.
export function getRemainingMs(state: PomodoroRunState): number {
  if (!state.running || state.endAt === null) return Math.max(0, state.remainingMs);
  return Math.max(0, state.endAt - Date.now());
}

// Temps réellement écoulé dans la phase en cours (utile pour enregistrer
// une session de travail arrêtée ou passée manuellement avant son terme).
export function getElapsedMs(state: PomodoroRunState): number {
  return Math.max(0, state.durationMs - getRemainingMs(state));
}

export function formatMMSS(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Détermine la phase suivante et si elle doit être une pause longue, en
// fonction du nombre de sessions de travail déjà complétées.
export function nextPhaseAfterWork(completedWorkSessions: number, settings: PomodoroSettings): PomodoroPhase {
  const isLongBreakDue = completedWorkSessions > 0 && completedWorkSessions % settings.sessionsBeforeLongBreak === 0;
  return isLongBreakDue ? "long_break" : "short_break";
}
