import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// ---------------------------------------------------------------------------
// Capture de l'invite d'installation PWA (beforeinstallprompt).
// Placé tout en haut du fichier, avant le rendu React, car Chrome peut
// déclencher cet évènement très tôt : si on l'écoute trop tard, il est perdu.
// L'évènement est stocké sur window pour que App.tsx puisse le récupérer et
// déclencher l'invite depuis un vrai bouton dans l'interface.
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    __bfGetInstallPrompt?: () => any;
    __bfClearInstallPrompt?: () => void;
  }
}

let deferredInstallPrompt: any = null;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  window.dispatchEvent(new CustomEvent("bf:install-available"));
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  window.dispatchEvent(new CustomEvent("bf:install-installed"));
});

window.__bfGetInstallPrompt = () => deferredInstallPrompt;
window.__bfClearInstallPrompt = () => {
  deferredInstallPrompt = null;
};

const rootElement = document.getElementById("root");

if (!rootElement) {
  // Filet de sécurité : si jamais la balise #root est absente,
  // on affiche un message clair plutôt qu'un écran blanc silencieux.
  document.body.innerHTML =
    '<div style="padding:24px;font-family:sans-serif">Erreur : élément #root introuvable.</div>';
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  // Enregistrement du service worker pour le fonctionnement PWA.
  // Protégé par des vérifications pour ne jamais bloquer le rendu.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Echec silencieux : l'app fonctionne sans le worker (juste pas hors-ligne).
      });
    });
  }
}
