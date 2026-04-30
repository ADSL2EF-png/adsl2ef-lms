/**
 * ADSL-2EF — Enregistrement PWA
 * ──────────────────────────────
 * Ce fichier enregistre le Service Worker et gère les mises à jour.
 *
 * INSTALLATION
 * ────────────
 * Dans index.html, ajouter AVANT </body> :
 *
 *   <script src="./pwa-register.js"></script>
 *
 * C'est tout. Le fichier gère tout automatiquement.
 */

(function () {
  "use strict";

  if (!("serviceWorker" in navigator)) {
    console.info("[PWA] Service Workers non supportés sur ce navigateur.");
    return;
  }

  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(function (registration) {
        console.info("[PWA] Service Worker enregistré :", registration.scope);

        // Détecter les mises à jour disponibles
        registration.addEventListener("updatefound", function () {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", function () {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // Une nouvelle version est disponible
              showUpdateBanner();
            }
          });
        });
      })
      .catch(function (err) {
        console.warn("[PWA] Enregistrement Service Worker échoué :", err);
      });

    // Écouter les messages du Service Worker
    navigator.serviceWorker.addEventListener("message", function (event) {
      if (event.data?.type === "CACHE_UPDATED") {
        console.info("[PWA] Cache mis à jour.");
      }
    });
  });

  // ─── Bannière de mise à jour ─────────────────────────────────────────────

  function showUpdateBanner() {
    // Éviter les doublons
    if (document.getElementById("pwa-update-banner")) return;

    const banner = document.createElement("div");
    banner.id = "pwa-update-banner";
    banner.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #1747a6;
      color: #fff;
      padding: 14px 20px;
      border-radius: 14px;
      font-family: Manrope, system-ui, sans-serif;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 8px 32px rgba(18,44,95,0.25);
      z-index: 9999;
      max-width: 92vw;
    `;
    banner.innerHTML = `
      <span>🔄 Une nouvelle version est disponible.</span>
      <button onclick="window.location.reload()" style="
        background: #fff;
        color: #1747a6;
        border: none;
        border-radius: 8px;
        padding: 6px 14px;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
        white-space: nowrap;
      ">Mettre à jour</button>
      <button onclick="this.parentElement.remove()" style="
        background: none;
        border: none;
        color: rgba(255,255,255,0.7);
        font-size: 18px;
        cursor: pointer;
        line-height: 1;
        padding: 0 4px;
      ">×</button>
    `;
    document.body.appendChild(banner);

    // Masquer automatiquement après 15 secondes
    setTimeout(function () {
      banner.remove();
    }, 15_000);
  }

  // ─── Indicateur de connectivité ───────────────────────────────────────────

  function showOfflineIndicator() {
    let indicator = document.getElementById("pwa-offline-indicator");
    if (!indicator) {
      indicator = document.createElement("div");
      indicator.id = "pwa-offline-indicator";
      indicator.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #d48513;
        color: #fff;
        text-align: center;
        padding: 8px;
        font-family: Manrope, system-ui, sans-serif;
        font-size: 13px;
        font-weight: 600;
        z-index: 9998;
        transition: opacity .3s;
      `;
      indicator.textContent = "⚠️ Vous êtes hors ligne — vos données sont sauvegardées localement";
      document.body.prepend(indicator);
    }
  }

  function hideOfflineIndicator() {
    const indicator = document.getElementById("pwa-offline-indicator");
    if (indicator) {
      indicator.style.opacity = "0";
      setTimeout(() => indicator.remove(), 300);
    }
  }

  window.addEventListener("offline", showOfflineIndicator);
  window.addEventListener("online", hideOfflineIndicator);

  // Vérifier l'état initial
  if (!navigator.onLine) {
    window.addEventListener("DOMContentLoaded", showOfflineIndicator);
  }

  console.info("[PWA] pwa-register.js chargé.");
})();
