// ---------------------------------------------------------------------------
// Tests pour src/lib/spacedRepetition.ts — le cœur du panneau « Aujourd'hui »
// (progression du statut d'une notion et de sa prochaine date de révision).
// Aucune dépendance ajoutée, voir tests/dateUtils.test.ts pour la commande.
// ---------------------------------------------------------------------------

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { reviewNotion, isNotionDueToday, isoDatePlusDays, todayISODate } from "../src/lib/spacedRepetition.ts";
import type { Notion, NotionStatus } from "../src/lib/storage.ts";

function notion(status: NotionStatus, overrides: Partial<Notion> = {}): Notion {
  return {
    id: "n-1",
    subjectId: null,
    chapter: "",
    name: "Test",
    status,
    lastReviewedAt: null,
    nextReviewAt: null,
    note: "",
    source: "",
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("reviewNotion — succès (remembered)", () => {
  // La progression doit être strictement celle documentée dans
  // spacedRepetition.ts : chaque statut avance d'un cran, sauf
  // "maitrisee" qui est un plafond.
  const expectedNextStatus: Record<NotionStatus, NotionStatus> = {
    non_etudiee: "a_apprendre",
    a_apprendre: "en_cours",
    en_cours: "a_revoir",
    a_revoir: "maitrisee",
    maitrisee: "maitrisee",
  };

  for (const [current, expected] of Object.entries(expectedNextStatus) as [NotionStatus, NotionStatus][]) {
    test(`${current} → ${expected}`, () => {
      const result = reviewNotion(notion(current), "remembered");
      assert.equal(result.status, expected);
    });
  }

  test("maitrisee reste à maitrisee (plafond, jamais d'erreur)", () => {
    const result = reviewNotion(notion("maitrisee"), "remembered");
    assert.equal(result.status, "maitrisee");
  });

  test("met à jour lastReviewedAt et programme une prochaine révision future", () => {
    const before = Date.now();
    const result = reviewNotion(notion("non_etudiee"), "remembered");
    assert.ok(result.lastReviewedAt !== null && result.lastReviewedAt >= before);
    assert.ok(result.nextReviewAt !== null && result.nextReviewAt! > todayISODate());
  });

  test("ne mute pas l'objet original", () => {
    const original = notion("en_cours");
    const originalCopy = { ...original };
    reviewNotion(original, "remembered");
    assert.deepEqual(original, originalCopy);
  });
});

describe("reviewNotion — oubli (forgot)", () => {
  // En cas d'oubli : léger recul, mais jamais de retour à "non_etudiee"
  // depuis un statut plus avancé — voir FORGOT_NEXT_STATUS.
  const expectedNextStatus: Record<NotionStatus, NotionStatus> = {
    non_etudiee: "a_apprendre",
    a_apprendre: "a_apprendre",
    en_cours: "a_apprendre",
    a_revoir: "en_cours",
    maitrisee: "a_revoir",
  };

  for (const [current, expected] of Object.entries(expectedNextStatus) as [NotionStatus, NotionStatus][]) {
    test(`${current} → ${expected}`, () => {
      const result = reviewNotion(notion(current), "forgot");
      assert.equal(result.status, expected);
    });
  }

  test("reprogramme systématiquement à demain (intervalle court)", () => {
    const result = reviewNotion(notion("maitrisee"), "forgot");
    assert.equal(result.nextReviewAt, isoDatePlusDays(1));
  });
});

describe("isNotionDueToday", () => {
  test("faux si aucune date de révision programmée", () => {
    assert.equal(isNotionDueToday(notion("a_apprendre", { nextReviewAt: null })), false);
  });

  test("vrai si la date de révision est aujourd'hui", () => {
    const today = todayISODate();
    assert.equal(isNotionDueToday(notion("a_apprendre", { nextReviewAt: today }), today), true);
  });

  test("vrai si la date de révision est dépassée (en retard)", () => {
    assert.equal(
      isNotionDueToday(notion("a_apprendre", { nextReviewAt: "2000-01-01" }), todayISODate()),
      true
    );
  });

  test("faux si la date de révision est dans le futur", () => {
    assert.equal(
      isNotionDueToday(notion("a_apprendre", { nextReviewAt: isoDatePlusDays(3) }), todayISODate()),
      false
    );
  });
});
