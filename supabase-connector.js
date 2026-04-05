/**
 * ADSL-2EF — Connecteur Supabase
 * ────────────────────────────────
 * Ce fichier active la connexion aux vraies tables Supabase
 * sans modifier app.js. Il enrichit l'objet window.ADSL2EF_SUPABASE
 * avec des fonctions utilitaires et installe des hooks sur les
 * événements DOM pour déclencher les synchronisations au bon moment.
 *
 * INSTALLATION
 * ────────────
 * Dans index.html, ajouter APRÈS le tag Supabase CDN et AVANT app.js :
 *
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   <script src="./supabase-connector.js"></script>
 *   <script src="./app.js"></script>
 *
 * ACTIVATION
 * ──────────
 * Dans le LMS → Paramètres du site → Mode de persistance : Supabase
 * Renseigner :
 *   - URL Supabase (ex: https://xxxx.supabase.co)
 *   - Clé anonyme
 *   - Activer Supabase : ✓
 *
 * FONCTIONNALITÉS
 * ───────────────
 * 1. Surveillance de la configuration Supabase dans le localStorage
 * 2. Reconnexion automatique si la session expire
 * 3. Synchronisation en temps réel des cours et notifications
 *    via les Realtime Channels de Supabase
 * 4. Retry automatique avec backoff exponentiel pour les erreurs réseau
 * 5. Tableau de bord de diagnostic accessible via ADSL2EF_SUPABASE.status()
 */

(function () {
  "use strict";

  const STORAGE_KEY = "adsl2ef-lms-v1";
  const LOG_PREFIX = "[ADSL2EF_SUPABASE]";

  // ─── État interne du connecteur ──────────────────────────────────────────
  const connectorState = {
    client: null,
    realtimeChannel: null,
    sessionCheckInterval: null,
    retryCount: 0,
    maxRetries: 5,
    isOnline: navigator.onLine,
    syncQueue: [],
    isSyncing: false,
    lastSyncAt: null,
    errors: [],
  };

  // ─── Utilitaires ─────────────────────────────────────────────────────────

  function log(message, ...args) {
    console.info(`${LOG_PREFIX} ${message}`, ...args);
  }

  function warn(message, ...args) {
    console.warn(`${LOG_PREFIX} ${message}`, ...args);
    connectorState.errors.push({ message, ts: new Date().toISOString() });
    if (connectorState.errors.length > 50) connectorState.errors.shift();
  }

  function getLmsState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveLmsState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      warn("Impossible de sauvegarder l'état LMS :", err.message);
    }
  }

  function getSupabaseConfig() {
    const state = getLmsState();
    if (!state) return null;
    const cfg = state.config?.supabase || {};
    const persistence = state.config?.persistence || {};
    const isActive =
      persistence.mode === "supabase" &&
      cfg.enabled === true &&
      cfg.url &&
      cfg.anonKey;
    if (!isActive) return null;
    return cfg;
  }

  // ─── Client Supabase ─────────────────────────────────────────────────────

  function getOrCreateClient() {
    const cfg = getSupabaseConfig();
    if (!cfg) return null;

    if (
      connectorState.client &&
      connectorState.client.__url === cfg.url &&
      connectorState.client.__key === cfg.anonKey
    ) {
      return connectorState.client;
    }

    if (!window.supabase?.createClient) {
      warn("SDK Supabase non chargé. Vérifiez le CDN dans index.html.");
      return null;
    }

    try {
      connectorState.client = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      });
      connectorState.client.__url = cfg.url;
      connectorState.client.__key = cfg.anonKey;
      log("Client Supabase initialisé :", cfg.url);
      return connectorState.client;
    } catch (err) {
      warn("Erreur création client Supabase :", err.message);
      return null;
    }
  }

  // ─── Retry avec backoff exponentiel ──────────────────────────────────────

  async function withRetry(fn, label = "opération") {
    let delay = 1000;
    for (let attempt = 1; attempt <= connectorState.maxRetries; attempt++) {
      try {
        const result = await fn();
        connectorState.retryCount = 0;
        return result;
      } catch (err) {
        warn(`${label} échoué (tentative ${attempt}/${connectorState.maxRetries}) :`, err.message);
        if (attempt === connectorState.maxRetries) throw err;
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, 30_000);
      }
    }
  }

  // ─── Reconnexion de session ───────────────────────────────────────────────

  async function refreshSessionIfNeeded() {
    const client = getOrCreateClient();
    if (!client) return false;

    try {
      const { data, error } = await client.auth.getSession();
      if (error) {
        warn("Erreur lecture session :", error.message);
        return false;
      }
      if (!data.session) return false;

      const expiresAt = data.session.expires_at;
      const now = Math.floor(Date.now() / 1000);
      const margin = 300; // 5 minutes avant expiration

      if (expiresAt - now < margin) {
        log("Session proche de l'expiration, renouvellement...");
        const { error: refreshError } = await client.auth.refreshSession();
        if (refreshError) {
          warn("Renouvellement session échoué :", refreshError.message);
          return false;
        }
        log("Session renouvelée.");

        // Mettre à jour le token dans le state LMS
        const { data: newSession } = await client.auth.getSession();
        if (newSession?.session?.access_token) {
          const lmsState = getLmsState();
          if (lmsState) {
            lmsState.session = {
              ...lmsState.session,
              accessToken: newSession.session.access_token,
              lastAuthAt: new Date().toISOString(),
            };
            saveLmsState(lmsState);
          }
        }
      }
      return true;
    } catch (err) {
      warn("Erreur vérification session :", err.message);
      return false;
    }
  }

  // ─── Synchronisation en temps réel (Realtime) ────────────────────────────

  function subscribeToRealtime() {
    const client = getOrCreateClient();
    if (!client) return;

    // Désabonnement propre si déjà actif
    if (connectorState.realtimeChannel) {
      client.removeChannel(connectorState.realtimeChannel);
      connectorState.realtimeChannel = null;
    }

    const lmsState = getLmsState();
    const userId = lmsState?.currentUserId;
    if (!userId) return;

    try {
      connectorState.realtimeChannel = client
        .channel("adsl2ef-realtime")

        // Nouvelles notifications pour l'utilisateur courant
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `profile_id=eq.${userId}`,
          },
          function (payload) {
            const notif = payload.new;
            if (!notif) return;
            log("Notification temps réel reçue :", notif.title);

            const state = getLmsState();
            if (!state) return;

            const alreadyExists = state.notifications.some((n) => n.id === notif.id);
            if (!alreadyExists) {
              state.notifications.unshift({
                id: notif.id,
                userId: notif.profile_id,
                title: notif.title,
                message: notif.message,
                level: notif.level || "primary",
                read: Boolean(notif.is_read),
                createdAt: notif.created_at || new Date().toISOString(),
              });
              saveLmsState(state);

              // Déclencher un re-rendu si renderApp est disponible
              if (typeof window.renderApp === "function") {
                window.renderApp();
              }
            }
          }
        )

        // Mises à jour des cours
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "courses",
          },
          function (payload) {
            log("Cours mis à jour en temps réel :", payload.eventType);
            // Déclencher une resynchronisation légère
            scheduleQuietSync();
          }
        )

        // Nouvelles annonces
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "announcements",
          },
          function (payload) {
            log("Nouvelle annonce en temps réel");
            scheduleQuietSync();
          }
        )

        .subscribe(function (status) {
          if (status === "SUBSCRIBED") {
            log("Realtime Supabase actif");
          } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
            warn("Canal Realtime fermé :", status);
          }
        });
    } catch (err) {
      warn("Erreur abonnement Realtime :", err.message);
    }
  }

  // ─── Synchronisation silencieuse ──────────────────────────────────────────

  let quietSyncTimer = null;

  function scheduleQuietSync() {
    clearTimeout(quietSyncTimer);
    quietSyncTimer = setTimeout(async function () {
      if (!connectorState.isOnline) return;
      const client = getOrCreateClient();
      if (!client) return;

      try {
        // Re-charger uniquement les notifications et annonces légères
        const [notifResult, announceResult] = await Promise.all([
          client.from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
          client.from("announcements").select("*").order("created_at", { ascending: false }).limit(20),
        ]);

        const state = getLmsState();
        if (!state) return;

        if (!notifResult.error && notifResult.data) {
          state.notifications = notifResult.data.map((n) => ({
            id: n.id,
            userId: n.profile_id,
            title: n.title,
            message: n.message,
            level: n.level || "primary",
            read: Boolean(n.is_read),
            createdAt: n.created_at || new Date().toISOString(),
          }));
        }

        if (!announceResult.error && announceResult.data) {
          state.announcements = announceResult.data.map((a) => ({
            id: a.id,
            courseId: a.course_id || null,
            title: a.title,
            body: a.body || "",
            authorId: a.author_profile_id || null,
            createdAt: a.created_at || new Date().toISOString(),
          }));
        }

        saveLmsState(state);
        connectorState.lastSyncAt = new Date().toISOString();

        if (typeof window.renderApp === "function") {
          window.renderApp();
        }
      } catch (err) {
        warn("Synchronisation silencieuse échouée :", err.message);
      }
    }, 1500);
  }

  // ─── File d'attente de synchronisation hors ligne ────────────────────────

  function queueSync(operation) {
    connectorState.syncQueue.push({
      operation,
      addedAt: new Date().toISOString(),
    });
    log(`Opération mise en file d'attente (total: ${connectorState.syncQueue.length})`);
  }

  async function flushQueue() {
    if (connectorState.isSyncing || !connectorState.syncQueue.length) return;
    if (!connectorState.isOnline) return;

    connectorState.isSyncing = true;
    log(`Vidage de la file d'attente (${connectorState.syncQueue.length} opérations)...`);

    const client = getOrCreateClient();
    if (!client) {
      connectorState.isSyncing = false;
      return;
    }

    const queue = [...connectorState.syncQueue];
    connectorState.syncQueue = [];

    for (const item of queue) {
      try {
        await item.operation(client);
        log("Opération en file exécutée avec succès");
      } catch (err) {
        warn("Opération en file échouée :", err.message);
        // Remettre en file si c'est une erreur réseau
        if (!err.message?.includes("duplicate") && !err.message?.includes("violates")) {
          connectorState.syncQueue.push(item);
        }
      }
    }

    connectorState.isSyncing = false;
    log("File d'attente vidée.");
  }

  // ─── Gestion de la connectivité ───────────────────────────────────────────

  window.addEventListener("online", function () {
    connectorState.isOnline = true;
    log("Connexion rétablie. Vidage de la file d'attente...");
    flushQueue();
    subscribeToRealtime();
  });

  window.addEventListener("offline", function () {
    connectorState.isOnline = false;
    log("Connexion perdue. Les opérations seront mises en file d'attente.");
    // Fermer le canal Realtime proprement
    const client = connectorState.client;
    if (client && connectorState.realtimeChannel) {
      client.removeChannel(connectorState.realtimeChannel);
      connectorState.realtimeChannel = null;
    }
  });

  // ─── Vérification périodique de session ──────────────────────────────────

  function startSessionMonitor() {
    // Vérifier toutes les 4 minutes
    if (connectorState.sessionCheckInterval) {
      clearInterval(connectorState.sessionCheckInterval);
    }
    connectorState.sessionCheckInterval = setInterval(async function () {
      const cfg = getSupabaseConfig();
      if (!cfg) return;
      await refreshSessionIfNeeded();
    }, 4 * 60 * 1000);
  }

  // ─── Initialisation ───────────────────────────────────────────────────────

  function initialize() {
    const cfg = getSupabaseConfig();
    if (!cfg) {
      // Pas encore configuré — re-essayer quand le localStorage change
      window.addEventListener("storage", function onStorage(e) {
        if (e.key === STORAGE_KEY) {
          const newCfg = getSupabaseConfig();
          if (newCfg) {
            window.removeEventListener("storage", onStorage);
            log("Configuration Supabase détectée, activation...");
            initialize();
          }
        }
      });
      return;
    }

    log("Initialisation du connecteur Supabase...");
    const client = getOrCreateClient();
    if (!client) return;

    // Démarrer la surveillance de session
    startSessionMonitor();

    // S'abonner au temps réel si un utilisateur est connecté
    const state = getLmsState();
    if (state?.currentUserId) {
      subscribeToRealtime();
    }

    // Observer les connexions/déconnexions pour activer/désactiver Realtime
    client.auth.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        log("Auth state:", event);
        subscribeToRealtime();
      } else if (event === "SIGNED_OUT") {
        log("Déconnexion Supabase");
        if (connectorState.realtimeChannel) {
          client.removeChannel(connectorState.realtimeChannel);
          connectorState.realtimeChannel = null;
        }
      }
    });

    // Vider la file d'attente si des opérations étaient en attente
    if (connectorState.syncQueue.length > 0) {
      flushQueue();
    }

    log("Connecteur Supabase prêt.");
  }

  // ─── API publique ─────────────────────────────────────────────────────────

  window.ADSL2EF_SUPABASE = {
    /**
     * Obtenir le client Supabase actif (ou null si non configuré).
     */
    getClient: getOrCreateClient,

    /**
     * Forcer une resynchronisation immédiate.
     */
    sync: scheduleQuietSync,

    /**
     * Mettre une opération en file d'attente pour exécution hors ligne.
     * @param {Function} operation — async function(client) { ... }
     */
    queue: queueSync,

    /**
     * Vider la file d'attente maintenant.
     */
    flushQueue,

    /**
     * Afficher l'état du connecteur dans la console.
     */
    status() {
      const cfg = getSupabaseConfig();
      console.group(`${LOG_PREFIX} État du connecteur`);
      console.info("Configuré :", Boolean(cfg));
      console.info("En ligne :", connectorState.isOnline);
      console.info("Client actif :", Boolean(connectorState.client));
      console.info("Realtime actif :", Boolean(connectorState.realtimeChannel));
      console.info("File d'attente :", connectorState.syncQueue.length, "opérations");
      console.info("Dernière sync :", connectorState.lastSyncAt || "jamais");
      console.info("Erreurs récentes :", connectorState.errors.slice(-5));
      console.groupEnd();
    },

    /**
     * Tester la connexion à Supabase et afficher le résultat dans la console.
     */
    async testConnection() {
      const client = getOrCreateClient();
      if (!client) {
        warn("Supabase non configuré. Activez le mode Supabase dans les paramètres.");
        return false;
      }
      try {
        const { error } = await client
          .from("profiles")
          .select("id", { count: "exact", head: true });
        if (error) throw error;
        log("✅ Connexion Supabase opérationnelle.");
        return true;
      } catch (err) {
        warn("❌ Connexion Supabase échouée :", err.message);
        return false;
      }
    },

    /**
     * Souscrire manuellement au Realtime (utile après une reconnexion).
     */
    subscribeRealtime: subscribeToRealtime,

    /**
     * Arrêter le connecteur proprement (utile pour les tests).
     */
    destroy() {
      clearInterval(connectorState.sessionCheckInterval);
      clearTimeout(quietSyncTimer);
      const client = connectorState.client;
      if (client && connectorState.realtimeChannel) {
        client.removeChannel(connectorState.realtimeChannel);
      }
      connectorState.client = null;
      connectorState.realtimeChannel = null;
      connectorState.sessionCheckInterval = null;
      log("Connecteur arrêté.");
    },
  };

  // ─── Lancement ────────────────────────────────────────────────────────────

  // Attendre que le DOM soit prêt et que app.js soit initialisé
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(initialize, 200);
    });
  } else {
    setTimeout(initialize, 200);
  }

  log("supabase-connector.js chargé.");
})();
