// ---------------------------------------------------------------------------
// Tests pour src/lib/dateUtils.ts (logique d'échéances et de streak).
// Aucune dépendance ajoutée : utilise node:test / node:assert, fournis par
// Node.js lui-même (18+). Lancer avec :
//   node --experimental-strip-types --test tests/*.test.ts
// (le flag n'est plus nécessaire à partir de Node 23.6, où le décapage de
// types TypeScript est activé par défaut).
// ---------------------------------------------------------------------------

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { daysUntil, isWithinDays, isoDateDaysAgo, computeStudyStreak } from "../src/lib/dateUtils.ts";
import type { StudySession } from "../src/lib/storage.ts";

describe("daysUntil", () => {
  test("renvoie null si aucune date", () => {
    assert.equal(daysUntil(null), null);
  });

  test("renvoie null pour une date invalide", () => {
    assert.equal(daysUntil("pas-une-date"), null);
  });

  test("renvoie 0 pour aujourd'hui", () => {
    assert.equal(daysUntil(isoDateDaysAgo(0)), 0);
  });

  test("renvoie un nombre négatif pour une date passée", () => {
    assert.equal(daysUntil(isoDateDaysAgo(3)), -3);
  });

  test("renvoie un nombre positif pour une date future", () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    assert.equal(daysUntil(future.toISOString().slice(0, 10)), 5);
  });
});

describe("isWithinDays", () => {
  test("aujourd'hui est toujours dans la fenêtre", () => {
    assert.equal(isWithinDays(isoDateDaysAgo(0), 7), true);
  });

  test("la borne inférieure (days-1 jours) est incluse", () => {
    assert.equal(isWithinDays(isoDateDaysAgo(6), 7), true);
  });

  test("la borne supérieure (days jours) est exclue", () => {
    assert.equal(isWithinDays(isoDateDaysAgo(7), 7), false);
  });

  test("une date future n'est jamais dans la fenêtre", () => {
    const future = new Date();
    future.setDate(future.getDate() + 1);
    assert.equal(isWithinDays(future.toISOString().slice(0, 10), 7), false);
  });

  test("une date invalide renvoie false plutôt que de lever une exception", () => {
    assert.equal(isWithinDays("nawak", 7), false);
  });
});

function session(date: string, minutes = 30): StudySession {
  return { id: `s-${date}`, subjectId: null, minutes, date, createdAt: Date.now() };
}

describe("computeStudyStreak", () => {
  test("aucune session → streak à 0", () => {
    assert.deepEqual(computeStudyStreak([]), { current: 0, best: 0 });
  });

  test("une session sans minutes (0) ne compte pas", () => {
    assert.deepEqual(computeStudyStreak([session(isoDateDaysAgo(0), 0)]), { current: 0, best: 0 });
  });

  test("une session aujourd'hui → streak de 1", () => {
    const result = computeStudyStreak([session(isoDateDaysAgo(0))]);
    assert.equal(result.current, 1);
    assert.equal(result.best, 1);
  });

  test("pas de session aujourd'hui mais une hier → streak toujours vivant à 1", () => {
    // Comportement volontaire : la série ne casse qu'après une journée
    // ENTIÈRE sans activité, jamais juste parce qu'on n'a pas encore
    // ouvert l'app aujourd'hui (voir le commentaire dans dateUtils.ts).
    const result = computeStudyStreak([session(isoDateDaysAgo(1))]);
    assert.equal(result.current, 1);
  });

  test("un jour manqué il y a 2 jours casse la série", () => {
    // Session aujourd'hui + hier, mais rien avant-hier : streak de 2, pas plus.
    const result = computeStudyStreak([session(isoDateDaysAgo(0)), session(isoDateDaysAgo(1))]);
    assert.equal(result.current, 2);
  });

  test("un trou dans le passé ne casse pas la série en cours", () => {
    const sessions = [
      session(isoDateDaysAgo(0)),
      session(isoDateDaysAgo(1)),
      // trou à isoDateDaysAgo(2)
      session(isoDateDaysAgo(3)),
      session(isoDateDaysAgo(4)),
    ];
    const result = computeStudyStreak(sessions);
    assert.equal(result.current, 2); // aujourd'hui + hier seulement
    assert.equal(result.best, 2); // le run le plus long est aussi 2
  });

  test("le record (best) peut être plus grand que la série en cours", () => {
    const sessions = [
      // Ancienne série de 4 jours consécutifs, plus longue que la série
      // actuelle de 1 jour.
      session(isoDateDaysAgo(10)),
      session(isoDateDaysAgo(11)),
      session(isoDateDaysAgo(12)),
      session(isoDateDaysAgo(13)),
      session(isoDateDaysAgo(0)),
    ];
    const result = computeStudyStreak(sessions);
    assert.equal(result.current, 1);
    assert.equal(result.best, 4);
  });

  test("plusieurs sessions le même jour ne comptent que pour un seul jour de série", () => {
    const sessions = [session(isoDateDaysAgo(0), 20), session(isoDateDaysAgo(0), 10)];
    const result = computeStudyStreak(sessions);
    assert.equal(result.current, 1);
  });
});
