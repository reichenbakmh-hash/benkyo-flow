// Service worker de Benkyo Flow.
// Volontairement simple : cache l'app shell, réseau prioritaire pour le HTML
// (pour toujours avoir la dernière version quand la connexion est dispo),
// cache prioritaire pour les assets statiques.
//
// Gère aussi, en best-effort, les notifications locales : le clic sur une
// notification (voir "notificationclick" plus bas) et une tentative de
// rappel même app fermée via Periodic Background Sync (voir "periodicsync"),
// disponible uniquement sur certains navigateurs Chromium en PWA installée.

const CACHE_NAME = "benkyo-flow-cache-v4";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {
        // Si un des fichiers manque, on n'échoue pas l'installation complète.
      })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Jamais de cache pour l'API : les données (comptes, matières, devoirs...)
  // doivent toujours venir du réseau, sinon un GET mis en cache une première
  // fois (ex. juste après inscription, liste encore vide) resterait figé à
  // chaque rechargement suivant, masquant toutes les données réellement
  // enregistrées côté serveur.
  if (url.pathname.startsWith("/api/")) return;

  // Navigation (chargement de page) : réseau d'abord, cache en secours.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Assets statiques : cache d'abord, réseau en secours.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});

// ---------------------------------------------------------------------------
// Clic sur une notification : réactive un onglet existant si possible,
// sinon en ouvre un nouveau.
// ---------------------------------------------------------------------------
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});

// ---------------------------------------------------------------------------
// Periodic Background Sync (best-effort, app fermée) : lit l'instantané des
// échéances déposé par la page (voir lib/notifications.ts →
// persistDueSnapshotForServiceWorker) et notifie chaque élément non encore
// envoyé. Le service worker ne peut pas lire localStorage, d'où le passage
// par IndexedDB comme canal de transmission entre la page et le worker.
// ---------------------------------------------------------------------------

const IDB_NAME = "benkyo-flow-notify";
const IDB_STORE = "due";

function openDueStoreInSW() {
  return new Promise((resolve, reject) => {
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

async function notifyFromDueSnapshot() {
  try {
    const db = await openDueStoreInSW();
    const items = await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get("snapshot");
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    for (const item of items) {
      await self.registration.showNotification(item.title, {
        body: item.body,
        tag: item.key,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
      });
    }

    // On vide l'instantané après envoi pour éviter de renotifier les mêmes
    // échéances à chaque déclenchement périodique suivant ; la page en
    // redéposera un nouveau dès qu'elle rouvrira ou que les données changent.
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put([], "snapshot");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // best-effort : IndexedDB indisponible, ou aucun instantané déposé
  }
}

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "bf-daily-check") {
    event.waitUntil(notifyFromDueSnapshot());
  }
});
