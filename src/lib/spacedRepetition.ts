// ---------------------------------------------------------------------------
// Benkyo Flow — Répétition espacée (utilisée par le panneau « Aujourd'hui »)
// ---------------------------------------------------------------------------
// Schéma volontairement simple, inspiré de la méthode « Répétition espacée »
// déjà décrite dans lib/methods.ts (lendemain → 3 jours → 1 semaine →
// 2-3 semaines...). Pas d'algorithme de type SM-2 avec facteurs de facilité :
// juste de quoi faire avancer intelligemment `nextReviewAt` et `status`
// quand l'utilisateur révise une notion depuis l'écran d'accueil.
// ---------------------------------------------------------------------------

import type { Notion, NotionStatus } from "./storage";

export type ReviewOutcome = "remembered" | "forgot";

// Intervalle (en jours) appliqué après une révision réussie, selon le statut
// courant de la notion — plus la notion est maîtrisée, plus l'intervalle
// s'allonge.
const SUCCESS_INTERVAL_DAYS: Record<NotionStatus, number> = {
  non_etudiee: 1,
  a_apprendre: 3,
  en_cours: 7,
  a_revoir: 16,
  maitrisee: 30,
};

// Statut suivant en cas de succès (progression d'un cran).
const SUCCESS_NEXT_STATUS: Record<NotionStatus, NotionStatus> = {
  non_etudiee: "a_apprendre",
  a_apprendre: "en_cours",
  en_cours: "a_revoir",
  a_revoir: "maitrisee",
  maitrisee: "maitrisee",
};

// Statut suivant en cas d'oubli (léger recul, jamais de retour à zéro).
const FORGOT_NEXT_STATUS: Record<NotionStatus, NotionStatus> = {
  non_etudiee: "a_apprendre",
  a_apprendre: "a_apprendre",
  en_cours: "a_apprendre",
  a_revoir: "en_cours",
  maitrisee: "a_revoir",
};

const FORGOT_INTERVAL_DAYS = 1;

export function isoDatePlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

// Retourne une nouvelle Notion avec statut et prochaine date de révision mis
// à jour — ne mute jamais l'objet reçu.
export function reviewNotion(notion: Notion, outcome: ReviewOutcome): Notion {
  const nextStatus = outcome === "remembered" ? SUCCESS_NEXT_STATUS[notion.status] : FORGOT_NEXT_STATUS[notion.status];
  const days = outcome === "remembered" ? SUCCESS_INTERVAL_DAYS[notion.status] : FORGOT_INTERVAL_DAYS;
  return {
    ...notion,
    status: nextStatus,
    lastReviewedAt: Date.now(),
    nextReviewAt: isoDatePlusDays(days),
  };
}

// Une notion est « due » si une date de révision est fixée et qu'elle est
// arrivée ou dépassée (on inclut volontairement le retard, comme sur les
// apps de type Anki : mieux vaut le montrer que le faire disparaître).
export function isNotionDueToday(notion: Notion, today: string = todayISODate()): boolean {
  return !!notion.nextReviewAt && notion.nextReviewAt <= today;
}
