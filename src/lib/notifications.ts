// ---------------------------------------------------------------------------
// Benkyo Flow — Notifications locales
// ---------------------------------------------------------------------------
// Deux niveaux, honnêtes sur ce qu'ils garantissent :
//
// 1) Vérification en tâche de fond pendant que l'app est ouverte (onglet au
//    premier plan ou en arrière-plan) : fiable, fonctionne partout où les
//    notifications sont supportées.
//
// 2) Web Push / Periodic Background Sync, pour les rappels quand l'app est
//    complètement fermée : uniquement disponible sur navigateurs Chromium
//    installés en PWA (Android, desktop), jamais garanti dans le temps,
//    absent sur iOS Safari. On l'enregistre en best-effort, sans jamais
//    faire croire qu'il est garanti.
//
// Dans les deux cas, on déduplique via localStorage pour ne jamais notifier
// deux fois le même devoir/notion pour la même échéance.
// ---------------------------------------------------------------------------

import type { Homework, Notion } from "./storage";

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export async function showLocalNotification(title: string, options: NotificationOptions = {}): Promise<void> {
  if (!isNotificationSupported() || Notification.permission !== "granted") return;
  const opts: NotificationOptions = {
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    ...options,
  };
  // On passe par le service worker quand c'est possible : les notifications
  // affichées ainsi survivent à la fermeture de l'onglet et gèrent mieux le
  // clic (réouverture de l'app) qu'un `new Notification()` classique.
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && "showNotification" in reg) {
        await reg.showNotification(title, opts);
        return;
      }
    }
  } catch {
    // on retombe sur la notification directe ci-dessous
  }
  try {
    new Notification(title, opts);
  } catch {
    // best-effort : navigateur qui refuse silencieusement, on n'affiche rien
  }
}

// --- Déduplication (ne jamais notifier deux fois la même échéance) ---------

const NOTIFIED_PREFIX = "benkyo-flow:notified:";

function alreadyNotified(key: string): boolean {
  try {
    return window.localStorage.getItem(NOTIFIED_PREFIX + key) !== null;
  } catch {
    return false;
  }
}

function markNotified(key: string): void {
  try {
    window.localStorage.setItem(NOTIFIED_PREFIX + key, String(Date.now()));
  } catch {
    // ignoré
  }
}

// À appeler de temps en temps (ex. au chargement de l'app) pour éviter que
// les petites clés de déduplication s'accumulent indéfiniment.
export function pruneOldNotifiedMarks(): void {
  try {
    const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(NOTIFIED_PREFIX)) continue;
      const stamp = Number(window.localStorage.getItem(key));
      if (!stamp || stamp < cutoff) toRemove.push(key);
    }
    toRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // ignoré
  }
}

function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Vérifie les devoirs et notions du jour / de demain, et déclenche les
// notifications correspondantes (une seule fois par échéance). Sûr à
// appeler souvent : ne fait rien si la permission n'est pas accordée.
export async function checkDueReminders(homework: Homework[], notions: Notion[]): Promise<void> {
  if (getNotificationPermission() !== "granted") return;

  const today = isoPlusDays(0);
  const tomorrow = isoPlusDays(1);

  for (const h of homework) {
    if (h.status === "done" || !h.dueDate) continue;
    if (h.dueDate === tomorrow) {
      const key = `hw-tomorrow-${h.id}-${tomorrow}`;
      if (!alreadyNotified(key)) {
        await showLocalNotification("Devoir à rendre demain", {
          body: h.title,
          tag: key,
          data: { section: "homework" },
        });
        markNotified(key);
      }
    } else if (h.dueDate === today) {
      const key = `hw-today-${h.id}-${today}`;
      if (!alreadyNotified(key)) {
        await showLocalNotification("Devoir à rendre aujourd'hui", {
          body: h.title,
          tag: key,
          data: { section: "homework" },
        });
        markNotified(key);
      }
    }
  }

  for (const n of notions) {
    if (n.nextReviewAt !== today) continue;
    const key = `rev-${n.id}-${today}`;
    if (!alreadyNotified(key)) {
      await showLocalNotification("Notion à réviser aujourd'hui", {
        body: n.name,
        tag: key,
        data: { section: "notions" },
      });
      markNotified(key);
    }
  }
}

// --- Rappels même app fermée (best-effort, PWA installée sur Chromium) -----
//
// Le service worker ne peut pas lire localStorage : on lui dépose donc un
// petit instantané des échéances à venir dans IndexedDB, qu'il consultera
// lors d'un évènement `periodicsync`. Aucune garantie de déclenchement (ni
// l'intervalle, ni même le support du tout, ne sont sous notre contrôle),
// mais c'est la seule voie disponible sans backend de push.

const IDB_NAME = "benkyo-flow-notify";
const IDB_STORE = "due";

function openDueStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB indisponible"));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface DueSnapshotItem {
  key: string;
  title: string;
  body: string;
}

// À appeler chaque fois que devoirs/notions changent (ou périodiquement) :
// dépose la liste des échéances de demain/aujourd'hui pour que le service
// worker puisse notifier même si l'app n'est plus ouverte du tout.
export async function persistDueSnapshotForServiceWorker(homework: Homework[], notions: Notion[]): Promise<void> {
  try {
    const today = isoPlusDays(0);
    const tomorrow = isoPlusDays(1);
    const items: DueSnapshotItem[] = [];

    homework.forEach((h) => {
      if (h.status === "done" || !h.dueDate) return;
      if (h.dueDate === tomorrow) {
        items.push({ key: `hw-tomorrow-${h.id}-${tomorrow}`, title: "Devoir à rendre demain", body: h.title });
      } else if (h.dueDate === today) {
        items.push({ key: `hw-today-${h.id}-${today}`, title: "Devoir à rendre aujourd'hui", body: h.title });
      }
    });
    notions.forEach((n) => {
      if (n.nextReviewAt === today) {
        items.push({ key: `rev-${n.id}-${today}`, title: "Notion à réviser aujourd'hui", body: n.name });
      }
    });

    const db = await openDueStore();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(items, "snapshot");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // best-effort : si IndexedDB échoue, seul le rappel « app ouverte » jouera
  }
}

// Tente d'enregistrer une synchronisation périodique. Renvoie `true` si
// effectivement pris en charge et accordé, `false` sinon (cas très
// fréquent : c'est normal, pas une erreur).
export async function registerPeriodicNotificationSync(): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator)) return false;
    const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
    };
    if (!reg.periodicSync) return false;
    const permissions = (navigator as any).permissions;
    if (permissions?.query) {
      const status = await permissions.query({ name: "periodic-background-sync" as PermissionName }).catch(() => null);
      if (status && status.state !== "granted") return false;
    }
    await reg.periodicSync.register("bf-daily-check", { minInterval: 12 * 60 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}
