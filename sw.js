/**
 * ADSL-2EF — Service Worker (PWA / Mode hors ligne)
 * ───────────────────────────────────────────────────
 * Stratégie : Cache First pour les assets statiques,
 * Network First pour les appels API, puis fallback offline.
 *
 * VERSION : 1.0.0
 */

const CACHE_NAME = "adsl2ef-v1";
const OFFLINE_URL = "/offline.html";

// Assets statiques à mettre en cache immédiatement
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/app.js",
  "/styles.css",
  "/logo-adsl2ef.svg",
  "/offline.html",
  "/manifest.json",
  "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
];

// Domaines dont les requêtes doivent passer par le réseau en priorité
const NETWORK_FIRST_DOMAINS = [
  "supabase.co",
  "api.jsonbin.io",
  "fonts.gstatic.com",
];

// ─── Installation ─────────────────────────────────────────────────────────

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(
        PRECACHE_ASSETS.filter((url) => !url.startsWith("https://fonts."))
      );
    })
  );
  // Prendre le contrôle immédiatement sans attendre rechargement
  self.skipWaiting();
});

// ─── Activation ───────────────────────────────────────────────────────────

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ─── Interception des requêtes ────────────────────────────────────────────

self.addEventListener("fetch", function (event) {
  const url = new URL(event.request.url);

  // Ne pas intercepter les requêtes non-GET
  if (event.request.method !== "GET") return;

  // Ne pas intercepter les extensions Chrome
  if (url.protocol === "chrome-extension:") return;

  // Requêtes API / Supabase → Network First
  const isNetworkFirst = NETWORK_FIRST_DOMAINS.some((domain) =>
    url.hostname.includes(domain)
  );

  if (isNetworkFirst) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Assets statiques → Cache First
  event.respondWith(cacheFirst(event.request));
});

// ─── Stratégie Cache First ────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Fallback offline pour les pages HTML
    if (request.headers.get("Accept")?.includes("text/html")) {
      const offlinePage = await caches.match(OFFLINE_URL);
      if (offlinePage) return offlinePage;
    }
    return new Response("Hors ligne — ressource non disponible", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

// ─── Stratégie Network First ──────────────────────────────────────────────

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: "Hors ligne", offline: true }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// ─── Notifications push (préparation future) ──────────────────────────────

self.addEventListener("push", function (event) {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "ADSL-2EF", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "ADSL-2EF", {
      body: data.body || "Vous avez une nouvelle notification.",
      icon: "/logo-adsl2ef.svg",
      badge: "/logo-adsl2ef.svg",
      tag: data.tag || "adsl2ef-notif",
      data: data.url || "/",
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || "/")
  );
});
