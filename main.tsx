import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

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
