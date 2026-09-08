// ---------------------------------------------------------------------------
// Benkyo Flow — Logique de dates (échéances, streaks)
// ---------------------------------------------------------------------------
// Extrait de App.tsx pour pouvoir être testé indépendamment : ce sont des
// fonctions pures, sans dépendance React/DOM, qui pilotent des affichages
// sensibles (retards de devoirs/objectifs, série de régularité) — des
// erreurs de calcul ici (ex. décalage d'un jour) seraient visibles et
// trompeuses pour l'utilisateur. Voir tests/dateUtils.test.ts.
// ---------------------------------------------------------------------------

import type { StudySession, HomeworkRecurrence } from "./storage";

// Nombre de jours entre aujourd'hui et une date ISO (YYYY-MM-DD), négatif si
// la date est passée. `null` si aucune date ou date invalide.
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso + "T00:00:00").getTime();
  if (Number.isNaN(target)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Vrai si la date (YYYY-MM-DD) tombe dans les `days` derniers jours (bornes incluses).
export function isWithinDays(iso: string, days: number): boolean {
  const target = new Date(iso + "T00:00:00").getTime();
  if (Number.isNaN(target)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - target) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays < days;
}

// Renvoie la date du jour et celle d'il y a `daysAgo` jours, au format YYYY-MM-DD.
export function isoDateDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// Streak de régularité : nombre de jours consécutifs avec au moins une
// session d'étude enregistrée (minutes > 0), jusqu'à aujourd'hui inclus.
// Si aucune session n'a encore été loguée aujourd'hui, on part d'hier pour
// ne pas casser le streak avant la fin de la journée — cohérent avec ce que
// font la plupart des apps à streaks (Duolingo etc.) : la série n'est
// rompue qu'après une journée entière sans activité, jamais juste parce
// qu'on n'a pas encore ouvert l'app aujourd'hui.
// `best` est la plus longue série jamais atteinte dans tout l'historique.
export function computeStudyStreak(sessions: StudySession[]): { current: number; best: number } {
  const days = new Set(sessions.filter((s) => s.minutes > 0).map((s) => s.date));
  if (days.size === 0) return { current: 0, best: 0 };

  let current = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days.has(cursor.toISOString().slice(0, 10))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Plus longue série historique : on parcourt tous les jours étudiés triés,
  // en comptant les runs de jours consécutifs.
  const sortedDays = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const iso of sortedDays) {
    const d = new Date(iso + "T00:00:00");
    if (prev) {
      const diff = Math.round((d.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = d;
  }

  return { current, best: Math.max(best, current) };
}

export function nextRecurrenceDate(dueDateIso: string, recurrence: HomeworkRecurrence): string | null {
  const interval = Math.max(1, Math.floor(recurrence.interval));
  const d = new Date(dueDateIso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  if (recurrence.frequency === "daily") {
    d.setDate(d.getDate() + interval);
  } else if (recurrence.frequency === "weekly") {
    d.setDate(d.getDate() + interval * 7);
  } else if (recurrence.frequency === "monthly") {
    d.setMonth(d.getMonth() + interval);
  } else {
    return null;
  }
  return d.toISOString().slice(0, 10);
}
