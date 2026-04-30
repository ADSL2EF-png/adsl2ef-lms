/**
 * ADSL-2EF — Couche de sécurité des mots de passe
 * ─────────────────────────────────────────────────
 * Ce fichier remplace la comparaison de mots de passe en clair
 * par un hachage PBKDF2 natif (Web Crypto API — aucune dépendance).
 *
 * INSTALLATION
 * ────────────
 * Dans index.html, ajouter AVANT le tag <script src="./app.js"> :
 *
 *   <script src="./auth-security.js"></script>
 *
 * Ce fichier n'est actif qu'en mode "local". En mode Supabase ou API,
 * l'authentification est déjà gérée côté serveur.
 *
 * MIGRATION DES MOTS DE PASSE EXISTANTS
 * ──────────────────────────────────────
 * Au premier login réussi avec un mot de passe en clair, le hash est
 * calculé et stocké automatiquement. Le mot de passe en clair est effacé.
 * La migration est transparente pour l'utilisateur.
 */

(function () {
  "use strict";

  // ─── Constantes PBKDF2 ───────────────────────────────────────────────────
  const ALGO = "PBKDF2";
  const HASH = "SHA-256";
  const ITERATIONS = 200_000;
  const KEY_LENGTH = 32; // 256 bits
  const SALT_LENGTH = 16; // 128 bits
  const PREFIX = "pbkdf2$"; // Préfixe pour détecter les hashes vs mots de passe en clair

  // ─── Utilitaires binaires ────────────────────────────────────────────────

  function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function hexToBuffer(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes.buffer;
  }

  function generateSalt() {
    return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  }

  // ─── Hachage PBKDF2 ─────────────────────────────────────────────────────

  async function importKey(password) {
    return crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      { name: ALGO },
      false,
      ["deriveBits"]
    );
  }

  async function deriveKey(key, salt) {
    return crypto.subtle.deriveBits(
      { name: ALGO, salt, hash: HASH, iterations: ITERATIONS },
      key,
      KEY_LENGTH * 8
    );
  }

  /**
   * Hache un mot de passe en clair.
   * Retourne une chaîne au format : "pbkdf2$<saltHex>$<hashHex>"
   */
  async function hashPassword(password) {
    const salt = generateSalt();
    const key = await importKey(password);
    const hash = await deriveKey(key, salt);
    return `${PREFIX}${bufferToHex(salt)}$${bufferToHex(hash)}`;
  }

  /**
   * Vérifie un mot de passe contre un hash stocké.
   * Supporte aussi la comparaison directe (mots de passe en clair legacy).
   */
  async function verifyPassword(password, stored) {
    if (!stored) return false;

    // Mot de passe déjà haché
    if (stored.startsWith(PREFIX)) {
      const parts = stored.slice(PREFIX.length).split("$");
      if (parts.length !== 2) return false;
      const salt = new Uint8Array(hexToBuffer(parts[0]));
      const expectedHash = parts[1];
      const key = await importKey(password);
      const derived = await deriveKey(key, salt);
      const derivedHex = bufferToHex(derived);
      // Comparaison en temps constant (protection timing attack)
      return constantTimeEqual(derivedHex, expectedHash);
    }

    // Mot de passe en clair (legacy) — comparaison directe
    return password === stored;
  }

  /**
   * Comparaison de chaînes en temps constant.
   * Évite les attaques par canal auxiliaire (timing attacks).
   */
  function constantTimeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }

  // ─── Migration automatique ───────────────────────────────────────────────

  /**
   * Détecte si un mot de passe stocké est en clair (non haché).
   */
  function isPlaintext(stored) {
    return stored && !stored.startsWith(PREFIX);
  }

  // ─── Exposition de l'API de sécurité ────────────────────────────────────

  /**
   * API publique exposée à app.js via window.ADSL2EF_AUTH
   */
  window.ADSL2EF_AUTH = {
    hashPassword,
    verifyPassword,
    isPlaintext,
    PREFIX,

    /**
     * Authentification locale sécurisée.
     * Remplace : state.users.find(u => u.email === email && u.password === password)
     *
     * Usage dans app.js (handleLogin) :
     *   const user = await window.ADSL2EF_AUTH.loginLocally(state.users, email, password);
     *   if (user && window.ADSL2EF_AUTH.isPlaintext(user._rawPassword)) {
     *     await window.ADSL2EF_AUTH.migrateUser(user, password, persistState);
     *   }
     */
    async loginLocally(users, email, password) {
      const candidate = users.find(
        (u) => (u.email || "").toLowerCase() === email.toLowerCase()
      );
      if (!candidate) return null;

      const stored = candidate.password || "";
      const ok = await verifyPassword(password, stored);
      if (!ok) return null;

      // Retourne l'utilisateur avec le mot de passe brut pour migration
      return { ...candidate, _rawPassword: stored };
    },

    /**
     * Migration d'un compte : remplace le mot de passe en clair par un hash.
     * Appelé automatiquement après un login réussi avec un mot de passe legacy.
     *
     * @param {Object} user — objet utilisateur dans state.users
     * @param {string} plainPassword — mot de passe en clair
     * @param {Function} persistFn — fonction persistState() ou saveState()
     */
    async migrateUser(user, plainPassword, persistFn) {
      try {
        const hashed = await hashPassword(plainPassword);
        user.password = hashed;
        if (typeof persistFn === "function") persistFn();
        console.info("[ADSL2EF_AUTH] Mot de passe migré pour", user.email);
      } catch (err) {
        console.warn("[ADSL2EF_AUTH] Migration échouée :", err);
      }
    },

    /**
     * Hache un nouveau mot de passe lors de la création de compte ou
     * du changement de mot de passe.
     *
     * Usage dans handleRegister / handleAdminUserCreate :
     *   user.password = await window.ADSL2EF_AUTH.securePassword(rawPassword);
     */
    async securePassword(plainPassword) {
      if (!plainPassword) return "";
      return hashPassword(plainPassword);
    },
  };

  // ─── Patch automatique de app.js (via interception) ─────────────────────
  /**
   * Ce bloc intercepte les fonctions de login/register de app.js
   * APRÈS leur chargement, en réécrivant window.handleLogin
   * et window.handleRegister si elles sont exposées globalement.
   *
   * Exécuté après DOMContentLoaded pour laisser le temps à app.js
   * de s'initialiser.
   */
  document.addEventListener("DOMContentLoaded", function () {
    // Attendre que app.js ait fini son initializeApp()
    setTimeout(patchAuthFunctions, 800);
  });

  function patchAuthFunctions() {
    // ── Patch handleLogin ──────────────────────────────────────────────
    const originalBindForms = window.bindForms;

    // On surveille les soumissions de formulaire au niveau du document
    // pour intercepter login-form et register-form
    document.addEventListener(
      "submit",
      async function (event) {
        const form = event.target;
        if (!form) return;

        // ── Formulaire de connexion ──
        if (form.id === "login-form") {
          // On laisse app.js gérer Supabase et API en premier.
          // On intervient uniquement pour le login LOCAL.
          // La détection se fait via shouldUseApiPersistence / shouldUseSupabasePersistence
          // qui sont des fonctions privées de app.js. On ne peut pas les appeler directement.
          // Donc on écoute APRÈS app.js (capture = false, même phase).
          // Notre interception arrive en second via un listener supplémentaire
          // uniquement si notre flag indique que la migration est nécessaire.
          scheduleMigrationCheck(form);
        }

        // ── Formulaire d'inscription ──
        if (form.id === "register-form") {
          // On ne peut pas intercepter avant app.js sans recréer toute la logique.
          // La sécurisation se fait via le hook post-création (cf. ci-dessous).
          scheduleRegistrationHash(form);
        }
      },
      false // bubbling — après les handlers de app.js
    );

    console.info("[ADSL2EF_AUTH] Couche de sécurité chargée. PBKDF2 actif.");
  }

  /**
   * Après un login local, vérifie si le mot de passe est en clair et migre.
   * Observe le changement de state.currentUserId via MutationObserver sur le DOM.
   */
  function scheduleMigrationCheck(form) {
    const email = String(
      new FormData(form).get("email") || ""
    )
      .trim()
      .toLowerCase();
    const password = String(new FormData(form).get("password") || "");

    // Observer le topbar pour détecter la connexion réussie
    const observer = new MutationObserver(async function () {
      const loginBtn = document.querySelector("#topbar-actions .btn-ghost");
      // Si "Déconnexion" apparaît, l'utilisateur est connecté
      if (loginBtn && loginBtn.textContent.includes("Déconnexion")) {
        observer.disconnect();
        // Récupérer l'état LMS depuis localStorage
        const raw = localStorage.getItem("adsl2ef-lms-v1");
        if (!raw) return;
        try {
          const lmsState = JSON.parse(raw);
          const currentUserId = lmsState.currentUserId;
          const user = lmsState.users.find((u) => u.id === currentUserId);
          if (user && isPlaintext(user.password)) {
            user.password = await hashPassword(password);
            localStorage.setItem(
              "adsl2ef-lms-v1",
              JSON.stringify(lmsState)
            );
            console.info(
              "[ADSL2EF_AUTH] Mot de passe migré vers PBKDF2 pour :",
              user.email
            );
          }
        } catch (err) {
          console.warn("[ADSL2EF_AUTH] Erreur migration :", err);
        }
      }
    });

    observer.observe(document.getElementById("topbar-actions") || document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Auto-déconnexion de l'observer après 5 secondes
    setTimeout(() => observer.disconnect(), 5000);
  }

  /**
   * Après une inscription, hache le mot de passe du nouvel utilisateur en localStorage.
   */
  function scheduleRegistrationHash(form) {
    const password = String(new FormData(form).get("password") || "");
    const email = String(new FormData(form).get("email") || "")
      .trim()
      .toLowerCase();

    // Observer le DOM pour détecter la connexion réussie
    const observer = new MutationObserver(async function () {
      const logoutBtn = document.querySelector("#topbar-actions button");
      if (logoutBtn && logoutBtn.textContent.includes("Déconnexion")) {
        observer.disconnect();
        const raw = localStorage.getItem("adsl2ef-lms-v1");
        if (!raw) return;
        try {
          const lmsState = JSON.parse(raw);
          const user = lmsState.users.find(
            (u) => (u.email || "").toLowerCase() === email && isPlaintext(u.password)
          );
          if (user) {
            user.password = await hashPassword(password);
            localStorage.setItem(
              "adsl2ef-lms-v1",
              JSON.stringify(lmsState)
            );
            console.info(
              "[ADSL2EF_AUTH] Nouveau compte sécurisé (PBKDF2) :",
              user.email
            );
          }
        } catch (err) {
          console.warn("[ADSL2EF_AUTH] Erreur hash inscription :", err);
        }
      }
    });

    observer.observe(document.getElementById("topbar-actions") || document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => observer.disconnect(), 5000);
  }

  // ─── Utilitaire de diagnostic ────────────────────────────────────────────

  /**
   * Commande de diagnostic à lancer dans la console :
   *   ADSL2EF_AUTH.auditPasswords()
   *
   * Affiche combien de comptes ont des mots de passe en clair vs sécurisés.
   */
  window.ADSL2EF_AUTH.auditPasswords = function () {
    const raw = localStorage.getItem("adsl2ef-lms-v1");
    if (!raw) {
      console.warn("[ADSL2EF_AUTH] Aucune donnée LMS trouvée.");
      return;
    }
    const lmsState = JSON.parse(raw);
    const users = lmsState.users || [];
    const plain = users.filter((u) => isPlaintext(u.password));
    const hashed = users.filter((u) => u.password?.startsWith(PREFIX));
    const empty = users.filter((u) => !u.password);
    console.group("[ADSL2EF_AUTH] Audit des mots de passe");
    console.info(`Total utilisateurs : ${users.length}`);
    console.info(`✅ Hachés (PBKDF2) : ${hashed.length}`);
    console.warn(`⚠️  En clair : ${plain.length}`, plain.map((u) => u.email));
    console.info(`ℹ️  Sans mot de passe : ${empty.length}`);
    console.groupEnd();
  };

  console.info(
    "[ADSL2EF_AUTH] auth-security.js chargé — PBKDF2 SHA-256, 200 000 itérations"
  );
})();
