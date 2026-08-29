// Service worker de Benkyo Flow.
// Volontairement simple : cache l'app shell, réseau prioritaire pour le HTML
// (pour toujours avoir la dernière version quand la connexion est dispo),
// cache prioritaire pour les assets statiques.

const CACHE_NAME = "benkyo-flow-cache-v3";
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
