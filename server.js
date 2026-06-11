"use strict";

const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const STABLE_APP_ORIGIN = "https://adsl2ef-lms-production.up.railway.app";
const REDIRECTED_CUSTOM_HOSTS = new Set(["lms.adsl2ef.org", "www.lms.adsl2ef.org"]);
const API_TOKEN = process.env.ADSL2EF_API_TOKEN || "";
const PAYMENT_WEBHOOK_SECRET = process.env.ADSL2EF_PAYMENT_WEBHOOK_SECRET || "";
const ALLOWED_ORIGIN = process.env.ADSL2EF_ALLOWED_ORIGIN || "";
const BODY_SIZE_LIMIT = 512 * 1024; // 512 Ko max

// ─── Fichiers statiques (frontend) ────────────────────────────────────────
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico":  "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff":  "font/woff",
  ".ttf":   "font/ttf"
};

// ─── Rate limiting (brute force sur /auth/login) ───────────────────────────
const loginAttempts = new Map(); // ip → { count, resetAt }
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  if (entry.count >= LOGIN_MAX_ATTEMPTS) return false;
  entry.count++;
  return true;
}

function resetLoginRateLimit(ip) {
  loginAttempts.delete(ip);
}

// Nettoyage périodique des entrées expirées
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts.entries()) {
    if (now > entry.resetAt) loginAttempts.delete(ip);
  }
}, LOGIN_WINDOW_MS);
const MIXX_INIT_URL = process.env.ADSL2EF_MIXX_INIT_URL || "";
const MIXX_API_KEY = process.env.ADSL2EF_MIXX_API_KEY || "";
const MIXX_MERCHANT_ID = process.env.ADSL2EF_MIXX_MERCHANT_ID || "";
const MIXX_CALLBACK_URL = process.env.ADSL2EF_MIXX_CALLBACK_URL || "";
const MIXX_RETURN_URL = process.env.ADSL2EF_MIXX_RETURN_URL || "";
const MIXX_CANCEL_URL = process.env.ADSL2EF_MIXX_CANCEL_URL || "";
const FLOOZ_INIT_URL = process.env.ADSL2EF_FLOOZ_INIT_URL || "";
const FLOOZ_API_KEY = process.env.ADSL2EF_FLOOZ_API_KEY || "";
const FLOOZ_MERCHANT_ID = process.env.ADSL2EF_FLOOZ_MERCHANT_ID || "";
const FLOOZ_CALLBACK_URL = process.env.ADSL2EF_FLOOZ_CALLBACK_URL || "";
const FLOOZ_RETURN_URL = process.env.ADSL2EF_FLOOZ_RETURN_URL || "";
const FLOOZ_CANCEL_URL = process.env.ADSL2EF_FLOOZ_CANCEL_URL || "";
const PAYGATE_INIT_URL = process.env.ADSL2EF_PAYGATE_INIT_URL || "https://paygateglobal.com/api/v1/pay";
const PAYGATE_API_KEY = process.env.ADSL2EF_PAYGATE_API_KEY || "";
const PAYGATE_MERCHANT_ID = process.env.ADSL2EF_PAYGATE_MERCHANT_ID || "ADSL-2EF";
const PAYGATE_CALLBACK_URL = process.env.ADSL2EF_PAYGATE_CALLBACK_URL || "";
const PAYGATE_RETURN_URL = process.env.ADSL2EF_PAYGATE_RETURN_URL || "";
const PAYGATE_CANCEL_URL = process.env.ADSL2EF_PAYGATE_CANCEL_URL || "";

// ─── Supabase (base de données persistante) ───────────────────────────────
const SUPABASE_URL = process.env.ADSL2EF_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.ADSL2EF_SUPABASE_SERVICE_KEY || "";

async function supabaseFetch(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error("Supabase non configuré");
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Prefer": options.prefer || "return=representation",
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error ${res.status}: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Stockage de l'état LMS dans une table Supabase simple (clé/valeur)
async function loadStateFromSupabase() {
  try {
    const rows = await supabaseFetch("/lms_state?key=eq.main&select=value", { prefer: "return=representation" });
    if (rows && rows.length > 0) return JSON.parse(rows[0].value);
    return null;
  } catch (err) {
    console.warn("[Supabase] loadState failed:", err.message);
    return null;
  }
}

async function saveStateToSupabase(state) {
  try {
    await supabaseFetch("/lms_state", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ key: "main", value: JSON.stringify(state), updated_at: new Date().toISOString() })
    });
  } catch (err) {
    console.warn("[Supabase] saveState failed:", err.message);
  }
}

function encodeSupabaseFilterValue(value) {
  return encodeURIComponent(String(value || "").trim());
}

function uniqueNonEmpty(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function initials(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("") || "AA";
}

async function deleteSupabaseProfileRows({ userId, email }) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return false;
  const ids = uniqueNonEmpty([userId]);
  const deletes = [];
  ids.forEach((id) => {
    deletes.push(supabaseFetch(`/profiles?id=eq.${encodeSupabaseFilterValue(id)}`, {
      method: "DELETE",
      prefer: "return=minimal",
      headers: { "Prefer": "return=minimal" }
    }));
    deletes.push(supabaseFetch(`/profiles?auth_user_id=eq.${encodeSupabaseFilterValue(id)}`, {
      method: "DELETE",
      prefer: "return=minimal",
      headers: { "Prefer": "return=minimal" }
    }).catch((error) => {
      if (!isMissingSupabaseColumnError(error, "auth_user_id")) throw error;
    }));
  });
  if (email) {
    deletes.push(supabaseFetch(`/profiles?email=eq.${encodeSupabaseFilterValue(email)}`, {
      method: "DELETE",
      prefer: "return=minimal",
      headers: { "Prefer": "return=minimal" }
    }).catch((error) => {
      if (!isMissingSupabaseColumnError(error, "email")) throw error;
    }));
  }
  await Promise.all(deletes);
  return deletes.length > 0;
}

async function deleteSupabaseAuthUser(userId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !userId) return false;
  const deleteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });
  if (deleteRes.status === 404) return false;
  if (!deleteRes.ok) {
    const err = await deleteRes.text();
    throw new Error(`Supabase auth delete error ${deleteRes.status}: ${err}`);
  }
  return true;
}

async function deleteSupabaseCourseRows(courseId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !courseId) return false;
  try {
    await supabaseFetch(`/courses?id=eq.${encodeSupabaseFilterValue(courseId)}`, {
      method: "DELETE",
      prefer: "return=minimal",
      headers: { "Prefer": "return=minimal" }
    });
    return true;
  } catch (error) {
    console.warn("[Supabase] course delete ignored:", error.message);
    return false;
  }
}
const DATA_DIR = path.join(__dirname, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const EVENTS_FILE = path.join(DATA_DIR, "events.log");

const defaultState = {
  config: {
    schoolName: "ADSL-2EF",
    site: {
      headline: "ADSL-2EF — Excellence éducative · Togo",
      banner: "ASSOCIATION DES DIPLÔMÉS EN SCIENCES ET LETTRES ENGAGÉS POUR L'ÉDUCATION ET LA FORMATION",
      subBanner: "ADSL-2EF · Association éducative agréée · République Togolaise",
      contactPhone: "+228 93 76 76 21",
      contactEmail: "contact@adsl2ef.tg",
      contactAddress: "Lomé, République Togolaise",
      whatsappUrl: "https://wa.me/22893767621"
    },
    payments: {
      mixxEnabled: false,
      floozEnabled: false,
      paygateEnabled: true,
      mode: "manual",
      callbackUrl: "",
      merchantMixx: "",
      merchantFlooz: "",
      merchantPaygate: ""
    },
    persistence: {
      mode: "api",
      apiBaseUrl: "",
      apiToken: "",
      healthPath: "/health",
      apiSnapshotPath: "/lms/state",
      authMePath: "/auth/me",
      authLoginPath: "/auth/login",
      authRegisterPath: "/auth/register",
      paymentInitPath: "/payments/init",
      operationsPath: "/lms/events",
      lastRemoteSyncAt: ""
    },
    googleSheets: { enabled: false, webAppUrl: "" },
    jsonbin: { enabled: false, binId: "", apiKey: "", accessKey: "", lastSyncAt: "" }
  },
  users: [],
  courses: [],
  activities: [],
  questionBank: [],
  gameQuizzes: [],
  gameSessions: [],
  gameResults: [],
  paymentRecords: [],
  submissions: [],
  attendanceSessions: [],
  notifications: [],
  activityLog: [],
  announcements: [],
  messages: [],
  forumThreads: [],
  currentUserId: null,
  session: {
    accessToken: "",
    authProvider: "api",
    lastAuthAt: ""
  },
  ui: {
    screen: "landing",
    activeCourseId: null,
    activeActivityId: null,
    currentModuleId: null,
    currentLessonId: null,
    schoolCategory: "all"
  }
};

const demoUsers = [
  { name: "Admin ADSL-2EF", email: "admin@adsl2ef.tg", phone: "+228 93 76 76 21", role: "admin", bio: "Supervision globale de la plateforme.", avatar: "AA", password: "Admin123!" },
  { name: "Afi Mensah", email: "teacher@adsl2ef.tg", role: "teacher", teachingProfile: "both", bio: "Enseignante de mathématiques et coordinatrice numérique.", avatar: "AM", password: "Teacher123!" },
  { name: "Kodjo Etse", email: "student@adsl2ef.tg", role: "student", bio: "Élève de première scientifique.", avatar: "KE", password: "Student123!" }
];

let inMemoryState = null;

function getSecurityHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGIN || origin || "*";
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
  };
}

function json(response, statusCode, payload) {
  const origin = response.req?.headers?.origin || "";
  response.writeHead(statusCode, getSecurityHeaders(origin));
  response.end(JSON.stringify(payload));
}

function notFound(response) {
  json(response, 404, { error: "not_found" });
}

// ─── Serveur de fichiers statiques ────────────────────────────────────────
async function serveStatic(request, response) {
  const urlPath = getRequestPath(request);

  // Sécurité : bloquer les path traversal (ex: /../../../etc/passwd)
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(PUBLIC_DIR, safePath);

  // Si c'est un dossier ou la racine → servir index.html (SPA)
  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch {
    // Fichier non trouvé → SPA fallback vers index.html
    filePath = path.join(PUBLIC_DIR, "index.html");
  }

  try {
    const content = await fsp.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const origin = request.headers.origin || "";
    const allowedOrigin = ALLOWED_ORIGIN || origin || "*";

    const headers = {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Access-Control-Allow-Origin": allowedOrigin,
      "Cache-Control": [".html", ".js"].includes(ext) ? "no-cache" : "public, max-age=31536000, immutable"
    };

    // CSP uniquement sur les pages HTML
    if (ext === ".html") {
      headers["Content-Security-Policy"] =
        "default-src 'self'; " +
        "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; " +
        "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' https://images.unsplash.com https://drive.google.com https://lh3.googleusercontent.com https://*.googleusercontent.com data: blob:; " +
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://adsl2ef-lms-production.up.railway.app https://cdn.jsdelivr.net; " +
        "frame-src 'self' https://drive.google.com https://docs.google.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com; " +
        "frame-ancestors 'none';";
    }

    response.writeHead(200, headers);
    response.end(content);
  } catch {
    json(response, 404, { error: "not_found" });
  }
}

function getRequestPath(request) {
  return new URL(request.url, `http://${request.headers.host || "localhost"}`).pathname;
}

function getRequestUrl(request) {
  return new URL(request.url, `http://${request.headers.host || "localhost"}`);
}

function shouldRedirectCustomHost(request) {
  const host = String(request.headers.host || "").split(":")[0].toLowerCase();
  return REDIRECTED_CUSTOM_HOSTS.has(host);
}

function redirectCustomHostToStableApp(request, response) {
  const target = new URL(request.url || "/", STABLE_APP_ORIGIN);
  response.writeHead(request.method === "GET" || request.method === "HEAD" ? 302 : 307, {
    Location: target.toString(),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
  });
  response.end();
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, hash] = storedHash.split(":");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
}

function signToken(user) {
  const secret = API_TOKEN || "adsl2ef-local-secret";
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // Expire dans 24h
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    role: user.role,
    teachingProfile: normalizeTeachingProfile(user.teachingProfile || user.teaching_profile, user.role),
    bio: user.bio || "",
    avatar: user.avatar || "",
    createdAt: user.createdAt
  };
}

function sanitizeSharedState(state) {
  return {
    ...state,
    currentUserId: null,
    session: {
      accessToken: "",
      authProvider: "api",
      lastAuthAt: ""
    },
    ui: {
      ...(state.ui || {}),
      screen: "landing"
    },
    users: Array.isArray(state.users)
      ? state.users.map((user) => ({ ...user, password: "", passwordHash: "" }))
      : []
  };
}

function safeInlineJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function preserveUserPasswordHashes(nextState, previousState) {
  const previousUsers = ensureArray(previousState?.users);
  nextState.users = ensureArray(nextState.users).map((user) => {
    const existing = previousUsers.find((item) =>
      item.id === user.id ||
      (item.email && user.email && String(item.email).toLowerCase() === String(user.email).toLowerCase())
    );
    const existingHash = String(existing?.passwordHash || "");
    const nextHash = String(user.passwordHash || "");
    return {
      ...user,
      password: "",
      passwordHash: nextHash || existingHash
    };
  });
  return nextState;
}

function mergeReleaseState(previousRelease, nextRelease) {
  const previous = previousRelease && typeof previousRelease === "object" ? previousRelease : {};
  const next = nextRelease && typeof nextRelease === "object" ? nextRelease : {};
  return {
    modules: {
      ...(previous.modules && typeof previous.modules === "object" ? previous.modules : {}),
      ...(next.modules && typeof next.modules === "object" ? next.modules : {})
    },
    lessons: {
      ...(previous.lessons && typeof previous.lessons === "object" ? previous.lessons : {}),
      ...(next.lessons && typeof next.lessons === "object" ? next.lessons : {})
    }
  };
}

function mergeLessonsPreservingContent(previousLessons, nextLessons) {
  const merged = [];
  const previousById = new Map(ensureArray(previousLessons).map((lesson) => [lesson.id, lesson]));
  const seen = new Set();

  ensureArray(nextLessons).forEach((lesson) => {
    if (!lesson?.id) return;
    const previous = previousById.get(lesson.id);
    merged.push(previous ? { ...previous, ...lesson } : lesson);
    seen.add(lesson.id);
  });

  ensureArray(previousLessons).forEach((lesson) => {
    if (lesson?.id && !seen.has(lesson.id)) merged.push(lesson);
  });

  return merged.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function mergeModulesPreservingContent(previousModules, nextModules) {
  const merged = [];
  const previousById = new Map(ensureArray(previousModules).map((module) => [module.id, module]));
  const seen = new Set();

  ensureArray(nextModules).forEach((module) => {
    if (!module?.id) return;
    const previous = previousById.get(module.id);
    merged.push({
      ...(previous || {}),
      ...module,
      lessons: mergeLessonsPreservingContent(previous?.lessons, module.lessons)
    });
    seen.add(module.id);
  });

  ensureArray(previousModules).forEach((module) => {
    if (module?.id && !seen.has(module.id)) merged.push(module);
  });

  return merged.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function mergeCoursePreservingContent(previousCourse, nextCourse) {
  if (!previousCourse) return nextCourse;
  if (!nextCourse) return previousCourse;
  return {
    ...previousCourse,
    ...nextCourse,
    modules: mergeModulesPreservingContent(previousCourse.modules, nextCourse.modules),
    release: mergeReleaseState(previousCourse.release, nextCourse.release)
  };
}

function preserveCourseContent(nextState, previousState) {
  const previousCourses = ensureArray(previousState?.courses);
  const nextCourses = ensureArray(nextState.courses);
  const previousById = new Map(previousCourses.map((course) => [course.id, course]));
  const nextIds = new Set();

  nextState.courses = nextCourses.map((course) => {
    nextIds.add(course.id);
    return mergeCoursePreservingContent(previousById.get(course.id), course);
  });

  previousCourses.forEach((course) => {
    if (course?.id && !nextIds.has(course.id)) nextState.courses.push(course);
  });

  return nextState;
}

function normalizePublicRegistrationRole(role) {
  const value = String(role || "").trim().toLowerCase();
  return value === "teacher" ? "teacher" : "student";
}

function normalizeTeachingProfile(value, role = "teacher") {
  if (role !== "teacher") return "";
  const normalized = String(value || "").trim();
  return ["school", "pro", "both"].includes(normalized) ? normalized : "school";
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeStateUsers(users) {
  return ensureArray(users).map((user) => ({
    ...user,
    teachingProfile: normalizeTeachingProfile(user.teachingProfile || user.teaching_profile, user.role)
  }));
}

function normalizePaymentStatus(status) {
  const value = String(status || "pending").trim().toLowerCase();
  if (["approved", "paid", "success", "successful", "completed", "complete", "validated"].includes(value)) return "approved";
  if (["failed", "error", "declined", "rejected"].includes(value)) return "failed";
  if (["cancelled", "canceled", "expired", "timeout"].includes(value)) return "cancelled";
  if (["processing", "initiated", "created"].includes(value)) return "processing";
  return "pending";
}

function normalizePaymentProvider(provider) {
  const value = String(provider || "manual").trim().toLowerCase();
  if (["paygate", "paygate-global", "paygate_global"].includes(value)) return "paygate";
  if (value === "manual") return "manual";
  return "";
}

function repairFrenchEncodingText(value) {
  if (typeof value !== "string") return value;
  const replacements = [
    ["DIPLOM�S", "DIPLÔMÉS"],
    ["ENGAG�S", "ENGAGÉS"],
    ["L EDUCATION", "L'ÉDUCATION"],
    ["� Association", "· Association"],
    ["�ducative", "éducative"],
    ["R�publique", "République"],
    ["agr��e", "agréée"],
    ["� R�publique", "· République"],
    ["Lom�", "Lomé"],
    ["ma�triser", "maîtriser"],
    ["p�dagogiques", "pédagogiques"],
    ["p�dagogique", "pédagogique"],
    ["d�velopperont", "développeront"],
    ["d�velopper", "développer"],
    ["d�veloppement", "développement"],
    ["D�veloppement", "Développement"],
    ["comp�tences", "compétences"],
    ["comp�tence", "compétence"],
    ["n�cessaires", "nécessaires"],
    ["Baccalaur�at", "Baccalauréat"],
    ["sp�cifiques", "spécifiques"],
    ["align�s", "alignés"],
    ["acad�miques", "académiques"],
    ["d�couvriront", "découvriront"],
    ["d�couvrir", "découvrir"],
    ["diff�renciation", "différenciation"],
    ["diff�rencier", "différencier"],
    ["�valuation", "évaluation"],
    ["�valuations", "évaluations"],
    ["crit�ri�e", "critériée"],
    ["th�orie", "théorie"],
    ["�tudes", "études"],
    ["� l'issue", "À l'issue"],
    ["� travers", "à travers"],
    ["� la", "à la"],
    ["�t�", "été"],
    ["�tes", "êtes"],
    ["unit�s", "unités"],
    ["s�quences", "séquences"],
    ["�laborer", "Élaborer"],
    ["unit�", "unité"],
    ["cr�er", "créer"],
    ["Int�grer", "Intégrer"],
    ["� utiliser", "à utiliser"],
    ["adapt�es", "adaptées"],
    ["�l�ves", "élèves"],
    ["Am�liorer", "Améliorer"],
    ["am�liorer", "améliorer"],
    ["r�ussite", "réussite"],
    ["mani�re", "manière"],
    ["�thique", "éthique"],
    ["efficacit�", "efficacité"],
    ["qualit�", "qualité"],
    ["t�ches", "tâches"],
    ["r�p�titives", "répétitives"],
    ["v�ritable", "véritable"],
    ["pr�parer", "préparer"],
    ["r�duisant", "réduisant"],
    ["consacr�", "consacré"],
    ["r�daction", "rédaction"],
    ["gr�ce", "grâce"],
    ["r�sultats", "résultats"],
    ["activit�s", "activités"],
    ["li�s", "liés"],
    ["liés �", "liés à"],
    ["�ducation", "éducation"],
    ["�cole", "école"],
    ["donn�es", "données"],
    ["num�riques", "numériques"],
    ["num�rique", "numérique"],
    ["mettre en ouvre", "mettre en oeuvre"],
    ["Dipl??me", "Diplôme"],
    ["Dipl�me", "Diplôme"],
    ["compr�hension", "compréhension"],
    ["le�ons", "leçons"],
    ["Le�on", "Leçon"],
    ["pr�paration", "préparation"],
    ["interpr�tation", "interprétation"],
    ["m�thodes", "méthodes"],
    ["exp�rimentales", "expérimentales"],
    ["Pens�e", "Pensée"],
    ["pens�e", "pensée"],
    ["r�solution", "résolution"],
    ["probl�mes", "problèmes"],
    ["D�marrage", "Démarrage"],
    ["g�n�r�", "généré"],
    ["d�part", "départ"],
    ["publi�", "publié"],
    ["publi��", "publié"],
    ["publié�", "publié"],
    ["valid�", "validé"],
    ["valid��", "validé"],
    ["validé�", "validé"],
    ["pr????t", "prêt"],
    ["pr�t", "prêt"],
    ["pr����t", "prêt"],
    ["personnalis�", "personnalisé"],
    ["confirm�e", "confirmée"],
    ["acc�s", "accès"],
    ["ajout�e", "ajoutée"],
    ["ajout�", "ajouté"],
    ["termin�e", "terminée"],
    ["cr��", "créé"],
    ["modifi??", "modifié"],
    ["modifi�", "modifié"],
    ["supprim�", "supprimé"],
    ["Connexion ??", "Connexion à"],
    [" a ete ajoute", " a été ajouté"]
  ];
  return replacements.reduce((text, [from, to]) => text.split(from).join(to), value);
}

function repairFrenchEncodingDeep(value) {
  if (typeof value === "string") return repairFrenchEncodingText(value);
  if (Array.isArray(value)) return value.map((item) => repairFrenchEncodingDeep(item));
  if (value && typeof value === "object") {
    Object.keys(value).forEach((key) => {
      value[key] = repairFrenchEncodingDeep(value[key]);
    });
  }
  return value;
}

function extractPaymentUrl(payload) {
  if (!payload || typeof payload !== "object") return "";
  return payload.paymentUrl
    || payload.payment_url
    || payload.checkoutUrl
    || payload.checkout_url
    || payload.payUrl
    || payload.pay_url
    || payload.redirectUrl
    || payload.redirect_url
    || payload.url
    || payload.link
    || payload.data?.paymentUrl
    || payload.data?.payment_url
    || payload.data?.checkoutUrl
    || payload.data?.checkout_url
    || payload.data?.payUrl
    || payload.data?.pay_url
    || payload.data?.redirectUrl
    || payload.data?.redirect_url
    || payload.data?.url
    || payload.data?.link
    || "";
}

function extractProviderReference(payload) {
  if (!payload || typeof payload !== "object") return "";
  return payload.providerReference
    || payload.provider_reference
    || payload.transactionId
    || payload.transaction_id
    || payload.transactionReference
    || payload.transaction_reference
    || payload.txReference
    || payload.tx_reference
    || payload.paymentReference
    || payload.payment_reference
    || payload.reference
    || payload.id
    || payload.data?.providerReference
    || payload.data?.provider_reference
    || payload.data?.transactionId
    || payload.data?.transaction_id
    || payload.data?.transactionReference
    || payload.data?.transaction_reference
    || payload.data?.txReference
    || payload.data?.tx_reference
    || payload.data?.paymentReference
    || payload.data?.payment_reference
    || payload.data?.reference
    || payload.data?.id
    || "";
}

async function ensureDataFiles() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) {
    const seeded = structuredClone(defaultState);
    seeded.users = demoUsers.map((user) => ({
      id: randomId("usr"),
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      teachingProfile: normalizeTeachingProfile(user.teachingProfile, user.role),
      bio: user.bio,
      avatar: user.avatar,
      createdAt: new Date().toISOString(),
      passwordHash: createPasswordHash(user.password)
    }));
    await fsp.writeFile(STATE_FILE, JSON.stringify(seeded, null, 2), "utf8");
  }
  if (!fs.existsSync(EVENTS_FILE)) {
    await fsp.writeFile(EVENTS_FILE, "", "utf8");
  }
}

async function loadState() {
  if (inMemoryState) return inMemoryState;

  // Essayer Supabase d'abord
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    const sbState = await loadStateFromSupabase();
    if (sbState) {
      sbState.users = normalizeStateUsers(sbState.users);
      sbState.courses = ensureArray(sbState.courses);
      sbState.activities = ensureArray(sbState.activities);
      sbState.questionBank = ensureArray(sbState.questionBank);
      sbState.gameQuizzes = ensureArray(sbState.gameQuizzes);
      sbState.gameSessions = ensureArray(sbState.gameSessions);
      sbState.gameResults = ensureArray(sbState.gameResults);
      sbState.paymentRecords = ensureArray(sbState.paymentRecords);
      sbState.submissions = ensureArray(sbState.submissions);
      sbState.attendanceSessions = ensureArray(sbState.attendanceSessions);
      sbState.notifications = ensureArray(sbState.notifications);
      sbState.activityLog = ensureArray(sbState.activityLog);
      sbState.announcements = ensureArray(sbState.announcements);
      sbState.messages = ensureArray(sbState.messages);
      sbState.forumThreads = ensureArray(sbState.forumThreads);
      inMemoryState = sbState;
      return inMemoryState;
    }
  }

  // Fallback fichier local
  await ensureDataFiles();
  const raw = await fsp.readFile(STATE_FILE, "utf8");
  const parsed = JSON.parse(raw);
  parsed.users = normalizeStateUsers(parsed.users);
  parsed.courses = ensureArray(parsed.courses);
  parsed.activities = ensureArray(parsed.activities);
  parsed.questionBank = ensureArray(parsed.questionBank);
  parsed.gameQuizzes = ensureArray(parsed.gameQuizzes);
  parsed.gameSessions = ensureArray(parsed.gameSessions);
  parsed.gameResults = ensureArray(parsed.gameResults);
  parsed.paymentRecords = ensureArray(parsed.paymentRecords);
  parsed.submissions = ensureArray(parsed.submissions);
  parsed.attendanceSessions = ensureArray(parsed.attendanceSessions);
  parsed.notifications = ensureArray(parsed.notifications);
  parsed.activityLog = ensureArray(parsed.activityLog);
  parsed.announcements = ensureArray(parsed.announcements);
  parsed.messages = ensureArray(parsed.messages);
  parsed.forumThreads = ensureArray(parsed.forumThreads);
  inMemoryState = parsed;

  // Sauvegarder dans Supabase pour les prochains démarrages
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    await saveStateToSupabase(inMemoryState);
  }

  return inMemoryState;
}

async function saveState(nextState) {
  inMemoryState = nextState;
  // Sauvegarder dans Supabase (persistant)
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    await saveStateToSupabase(nextState);
  }
  // Aussi sauvegarder localement si possible
  try {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    await fsp.writeFile(STATE_FILE, JSON.stringify(nextState, null, 2), "utf8");
  } catch {
    // Filesystem éphémère sur Railway — pas critique
  }
}

async function appendEvent(event) {
  await fsp.appendFile(EVENTS_FILE, `${JSON.stringify(event)}\n`, "utf8");
}

async function readBody(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > BODY_SIZE_LIMIT) {
        request.destroy();
        reject(new Error("payload_too_large"));
        return;
      }
      data += chunk;
    });
    request.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function requireBearer(request, response) {
  if (!API_TOKEN) return true;
  const auth = request.headers.authorization || "";
  if (auth === `Bearer ${API_TOKEN}`) return true;
  json(response, 401, { error: "unauthorized" });
  return false;
}

function verifyToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const secret = API_TOKEN || "adsl2ef-local-secret";
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${parts[0]}.${parts[1]}`)
      .digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(parts[2]))) return null;
    const parsed = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    // Vérification expiration (exp optionnel)
    if (parsed.exp && Math.floor(Date.now() / 1000) > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getAuthenticatedUserId(request) {
  const auth = request.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  const claims = verifyToken(token);
  return claims?.sub || null;
}

function findUserById(state, userId) {
  return state.users.find((user) => user.id === userId) || null;
}

function isMissingSupabaseColumnError(error, columnName) {
  const message = String(error?.message || "");
  return message.includes("PGRST204") && message.includes(`'${columnName}'`);
}

function getMissingSupabaseColumn(error) {
  const match = String(error?.message || "").match(/Could not find the '([^']+)' column/);
  return match?.[1] || "";
}

async function postProfileWithColumnFallback(path, payload) {
  const nextPayload = { ...payload };
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await supabaseFetch(path, {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(nextPayload)
      });
      return;
    } catch (error) {
      const missingColumn = getMissingSupabaseColumn(error);
      if (!missingColumn || !(missingColumn in nextPayload)) throw error;
      delete nextPayload[missingColumn];
    }
  }
  throw new Error("Profil Supabase incompatible avec les colonnes disponibles.");
}

async function loadProfileByAuthUserId(authUserId) {
  try {
    const profileRows = await supabaseFetch(`/profiles?auth_user_id=eq.${authUserId}&select=*`);
    return profileRows?.[0] || null;
  } catch (error) {
    if (!isMissingSupabaseColumnError(error, "auth_user_id")) throw error;
    const fallbackRows = await supabaseFetch(`/profiles?id=eq.${authUserId}&select=*`);
    return fallbackRows?.[0] || null;
  }
}

async function upsertSupabaseProfile({ authUserId, email, name, phone = "", role, teachingProfile = "", bio = "", avatar, approvalStatus }) {
  const createdAt = new Date().toISOString();
  try {
    await postProfileWithColumnFallback("/profiles?on_conflict=auth_user_id", {
      auth_user_id: authUserId,
      full_name: name,
      email,
      phone,
      role,
      teaching_profile: normalizeTeachingProfile(teachingProfile, role),
      bio,
      avatar,
      approval_status: approvalStatus,
      created_at: createdAt,
      updated_at: createdAt
    });
  } catch (error) {
    if (!isMissingSupabaseColumnError(error, "auth_user_id") && !isMissingSupabaseColumnError(error, "full_name")) throw error;
    await postProfileWithColumnFallback("/profiles", {
      id: authUserId,
      name,
      email,
      phone,
      role,
      teaching_profile: normalizeTeachingProfile(teachingProfile, role),
      bio,
      avatar,
      approval_status: approvalStatus,
      created_at: createdAt,
      updated_at: createdAt
    });
  }
}

async function updateSupabaseProfileApproval(authUserId, approvalStatus) {
  const payload = { approval_status: approvalStatus, updated_at: new Date().toISOString() };
  try {
    await supabaseFetch(`/profiles?auth_user_id=eq.${authUserId}`, {
      method: "PATCH",
      prefer: "return=minimal",
      headers: { "Prefer": "return=minimal" },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    if (!isMissingSupabaseColumnError(error, "auth_user_id")) throw error;
    await supabaseFetch(`/profiles?id=eq.${authUserId}`, {
      method: "PATCH",
      prefer: "return=minimal",
      headers: { "Prefer": "return=minimal" },
      body: JSON.stringify(payload)
    });
  }
}

function getPaymentProviderConfig(provider, state) {
  const payments = state.config?.payments || {};
  const normalizedProvider = normalizePaymentProvider(provider);
  if (normalizedProvider === "mixx") {
    return {
      name: "Mixx by Yas",
      provider: "mixx",
      initUrl: MIXX_INIT_URL,
      apiKey: MIXX_API_KEY,
      merchantId: MIXX_MERCHANT_ID || payments.merchantMixx || "",
      callbackUrl: MIXX_CALLBACK_URL || payments.callbackUrl || "",
      returnUrl: MIXX_RETURN_URL || payments.callbackUrl || "",
      cancelUrl: MIXX_CANCEL_URL || payments.callbackUrl || ""
    };
  }
  if (normalizedProvider === "flooz") {
    return {
      name: "Flooz",
      provider: "flooz",
      initUrl: FLOOZ_INIT_URL,
      apiKey: FLOOZ_API_KEY,
      merchantId: FLOOZ_MERCHANT_ID || payments.merchantFlooz || "",
      callbackUrl: FLOOZ_CALLBACK_URL || payments.callbackUrl || "",
      returnUrl: FLOOZ_RETURN_URL || payments.callbackUrl || "",
      cancelUrl: FLOOZ_CANCEL_URL || payments.callbackUrl || ""
    };
  }
  if (normalizedProvider === "paygate") {
    return {
      name: "PayGate Global",
      provider: "paygate",
      initUrl: PAYGATE_INIT_URL,
      apiKey: PAYGATE_API_KEY,
      merchantId: PAYGATE_MERCHANT_ID,
      callbackUrl: PAYGATE_CALLBACK_URL || payments.callbackUrl || "https://adsl2ef-lms-production.up.railway.app/payments/webhook/paygate",
      returnUrl: PAYGATE_RETURN_URL || payments.callbackUrl || "https://adsl2ef-lms-production.up.railway.app/",
      cancelUrl: PAYGATE_CANCEL_URL || payments.callbackUrl || "https://adsl2ef-lms-production.up.railway.app/"
    };
  }
  return {
    name: "Paiement",
    provider: normalizedProvider || "manual",
    initUrl: "",
    apiKey: "",
    merchantId: "",
    callbackUrl: payments.callbackUrl || "",
    returnUrl: payments.callbackUrl || "",
    cancelUrl: payments.callbackUrl || ""
  };
}

function sanitizePayment(payment) {
  return {
    paymentId: payment.id,
    id: payment.id,
    provider: payment.provider,
    courseId: payment.courseId,
    userId: payment.userId,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    merchantReference: payment.merchantReference || "",
    providerReference: payment.providerReference || "",
    paymentUrl: payment.paymentUrl || "",
    failureReason: payment.failureReason || "",
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    confirmedAt: payment.confirmedAt || ""
  };
}

function applyApprovedEnrollment(state, payment) {
  const course = state.courses.find((item) => item.id === payment.courseId);
  const user = findUserById(state, payment.userId);
  if (!course || !user) return;
  course.enrolledUserIds = ensureArray(course.enrolledUserIds);
  if (!course.enrolledUserIds.includes(user.id)) {
    course.enrolledUserIds.push(user.id);
  }
  state.notifications.unshift({
    id: randomId("notif"),
    userId: user.id,
    title: "Paiement confirmé",
    message: `Votre paiement ${payment.provider.toUpperCase()} a été confirmé pour ${course.title}.`,
    level: "success",
    read: false,
    createdAt: new Date().toISOString()
  });
}

async function initializeProviderPayment(providerConfig, payment, user, course) {
  if (!providerConfig.initUrl || !providerConfig.apiKey || !providerConfig.merchantId) {
    return {
      status: "pending",
      paymentUrl: "",
      providerReference: "",
      failureReason: `Configuration ${providerConfig.name} incomplète côté serveur.`
    };
  }
  if (typeof fetch !== "function") {
    throw new Error("fetch_not_available");
  }
  const payload = {
    amount: payment.amount,
    currency: payment.currency,
    auth_token: providerConfig.apiKey,
    token: providerConfig.apiKey,
    merchant_id: providerConfig.merchantId,
    merchantId: providerConfig.merchantId,
    identifier: payment.merchantReference,
    reference: payment.merchantReference,
    merchant_reference: payment.merchantReference,
    external_reference: payment.merchantReference,
    externalReference: payment.merchantReference,
    callback_url: providerConfig.callbackUrl,
    callbackUrl: providerConfig.callbackUrl,
    webhook_url: providerConfig.callbackUrl,
    webhookUrl: providerConfig.callbackUrl,
    return_url: providerConfig.returnUrl,
    returnUrl: providerConfig.returnUrl,
    cancel_url: providerConfig.cancelUrl,
    cancelUrl: providerConfig.cancelUrl,
    customer: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || ""
    },
    customer_id: user.id,
    customer_name: user.name,
    customer_email: user.email,
    customer_phone: user.phone || "",
    description: course.title,
    metadata: {
      courseId: course.id,
      userId: user.id,
      provider: payment.provider
    }
  };
  const response = await fetch(providerConfig.initUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${providerConfig.apiKey}`,
      "X-API-Key": providerConfig.apiKey,
      "X-Merchant-Id": providerConfig.merchantId
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const message = data.message || data.error || `Le fournisseur ${providerConfig.name} a refusé la requête.`;
    throw new Error(message);
  }
  return {
    status: normalizePaymentStatus(data.status || "pending"),
    paymentUrl: extractPaymentUrl(data),
    providerReference: extractProviderReference(data),
    failureReason: data.message || ""
  };
}

function extractWebhookPaymentReference(payload) {
  if (!payload || typeof payload !== "object") return "";
  const data = payload.data && typeof payload.data === "object" ? payload.data : {};
  const transaction = payload.transaction && typeof payload.transaction === "object" ? payload.transaction : {};
  return String(
    payload.paymentId
      || payload.payment_id
      || payload.merchantReference
      || payload.merchant_reference
      || payload.externalReference
      || payload.external_reference
      || payload.identifier
      || payload.reference
      || data.paymentId
      || data.payment_id
      || data.merchantReference
      || data.merchant_reference
      || data.externalReference
      || data.external_reference
      || data.identifier
      || data.reference
      || transaction.paymentId
      || transaction.payment_id
      || transaction.merchantReference
      || transaction.merchant_reference
      || transaction.externalReference
      || transaction.external_reference
      || transaction.identifier
      || transaction.reference
      || ""
  ).trim();
}

function extractWebhookStatus(payload, fallback) {
  if (!payload || typeof payload !== "object") return fallback;
  const data = payload.data && typeof payload.data === "object" ? payload.data : {};
  const transaction = payload.transaction && typeof payload.transaction === "object" ? payload.transaction : {};
  return payload.status
    || payload.payment_status
    || payload.transaction_status
    || data.status
    || data.payment_status
    || data.transaction_status
    || transaction.status
    || transaction.payment_status
    || transaction.transaction_status
    || fallback;
}

function replaceOrInsert(list, item) {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index >= 0) list[index] = { ...list[index], ...item };
  else list.unshift(item);
  return item;
}

async function handleHealth(_request, response) {
  json(response, 200, {
    status: "ok",
    service: "adsl2ef-backend",
    timestamp: new Date().toISOString()
  });
}

async function readTextBody(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > BODY_SIZE_LIMIT) {
        request.destroy();
        reject(new Error("payload_too_large"));
        return;
      }
      data += chunk;
    });
    request.on("end", () => resolve(data));
    request.on("error", reject);
  });
}

async function handleSupabaseDebug(request, response) {
  if (!requireBearer(request, response)) return;
  const result = {
    supabaseUrlConfigured: Boolean(SUPABASE_URL),
    serviceKeyConfigured: Boolean(SUPABASE_SERVICE_KEY),
    supabaseHost: SUPABASE_URL ? new URL(SUPABASE_URL).host : "",
    adminUsersStatus: null,
    adminUsersMessage: ""
  };
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1`, {
        headers: {
          "apikey": SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      });
      result.adminUsersStatus = res.status;
      result.adminUsersMessage = (await res.text()).slice(0, 500);
    } catch (error) {
      result.adminUsersMessage = error.message || "Supabase debug failed";
    }
  }
  json(response, 200, result);
}

async function handleGetState(request, response) {
  if (!requireBearer(request, response)) return;
  const state = await loadState();
  json(response, 200, { payload: sanitizeSharedState(state) });
}

async function handlePutState(request, response) {
  if (!requireBearer(request, response)) return;
  const body = await readBody(request);
  const incoming = body.payload && typeof body.payload === "object" ? body.payload : body;
  const previousState = await loadState();
  const sanitizedState = sanitizeSharedState({ ...structuredClone(defaultState), ...incoming });
  const state = preserveCourseContent(
    preserveUserPasswordHashes(sanitizedState, previousState),
    previousState
  );
  await saveState(state);
  json(response, 200, { payload: sanitizeSharedState(state) });
}

async function handleLogin(request, response) {
  const ip = request.socket?.remoteAddress || "unknown";
  if (!checkLoginRateLimit(ip)) {
    json(response, 429, { error: "too_many_attempts", message: "Trop de tentatives. Réessayez dans 15 minutes." });
    return;
  }
  const body = await readBody(request);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  async function loginWithLocalState() {
    const state = await loadState();
    const user = state.users.find((u) => u.email.toLowerCase() === email);
    if (!user || !verifyPassword(password, user.passwordHash)) return false;
    if (user.approvalStatus === "rejected") {
      json(response, 403, { error: "rejected", message: "Votre demande d'accès a été refusée." });
      return true;
    }
    resetLoginRateLimit(ip);
    json(response, 200, { accessToken: signToken(user), user: sanitizeUser(user) });
    return true;
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    if (!(await loginWithLocalState())) {
      json(response, 401, { error: "invalid_credentials", message: "Identifiants invalides." });
    }
    return;
  }

  // Authentification via Supabase Auth
  try {
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({ email, password })
    });
    const authData = await authRes.json();
    if (!authRes.ok) {
      if (await loginWithLocalState()) return;
      json(response, 401, { error: "invalid_credentials", message: "Identifiants invalides." });
      return;
    }

    // Récupérer le profil depuis la table profiles
    let profile = await loadProfileByAuthUserId(authData.user.id);

    if (!profile) {
      const displayName = authData.user.user_metadata?.name
        || authData.user.user_metadata?.full_name
        || authData.user.email
        || email;
      const role = authData.user.user_metadata?.role || "student";
      const phone = authData.user.user_metadata?.phone || "";
      const avatar = displayName.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
      try {
        await upsertSupabaseProfile({
          authUserId: authData.user.id,
          email: authData.user.email || email,
          name: displayName,
          phone,
          role,
          teachingProfile: normalizeTeachingProfile(authData.user.user_metadata?.teachingProfile, role),
          avatar,
          approvalStatus: "approved"
        });
        profile = await loadProfileByAuthUserId(authData.user.id);
      } catch (profileError) {
        console.warn("Supabase profile repair ignored:", profileError);
      }

      profile = profile || {
        id: authData.user.id,
        full_name: displayName,
        email: authData.user.email || email,
        phone,
        role,
        teaching_profile: normalizeTeachingProfile(authData.user.user_metadata?.teachingProfile, role),
        bio: "",
        avatar,
        approval_status: "approved",
        created_at: authData.user.created_at || new Date().toISOString()
      };

      try {
        const state = await loadState();
        const existing = state.users.find((user) => user.id === authData.user.id || String(user.email || "").toLowerCase() === email);
        const stateUser = {
          id: authData.user.id,
          name: profile?.full_name || profile?.name || displayName,
          email: authData.user.email || email,
          phone: profile?.phone || phone,
          role: profile?.role || role,
          teachingProfile: normalizeTeachingProfile(profile?.teaching_profile, profile?.role || role),
          bio: profile?.bio || "",
          avatar: profile?.avatar || avatar,
          approvalStatus: "approved",
          createdAt: profile?.created_at || authData.user.created_at || new Date().toISOString(),
          passwordHash: createPasswordHash(password)
        };
        if (existing) Object.assign(existing, stateUser);
        else state.users.push(stateUser);
        await saveState(state);
      } catch (stateError) {
        console.warn("LMS state repair ignored:", stateError);
      }
    }
    if (profile.approval_status === "rejected") {
      json(response, 403, { error: "rejected", message: "Votre demande d'accès a été refusée." });
      return;
    }

    resetLoginRateLimit(ip);
    const user = {
      id: authData.user.id,
      name: profile.full_name || profile.name || email,
      email: authData.user.email,
      phone: profile.phone || authData.user.user_metadata?.phone || "",
      role: profile.role || "student",
      teachingProfile: normalizeTeachingProfile(profile.teaching_profile || authData.user.user_metadata?.teachingProfile, profile.role || "student"),
      bio: profile.bio || "",
      avatar: profile.avatar || "",
      approvalStatus: profile.approval_status
    };
    json(response, 200, {
      accessToken: authData.access_token,
      refreshToken: authData.refresh_token,
      user
    });
  } catch (err) {
    console.error("Login error:", err);
    json(response, 500, { error: "internal_error", message: "Erreur de connexion." });
  }
}

async function handleLoginFrame(request, response) {
  const raw = await readTextBody(request);
  const form = new URLSearchParams(raw);
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const state = await loadState();
  const user = state.users.find((item) => String(item.email || "").toLowerCase() === email);
  let payload;
  if (!user || !verifyPassword(password, user.passwordHash)) {
    payload = { ok: false, error: "invalid_credentials", message: "Identifiants invalides." };
  } else if (user.approvalStatus === "rejected") {
    payload = { ok: false, error: "rejected", message: "Votre demande d'accès a été refusée." };
  } else {
    payload = { ok: true, accessToken: signToken(user), user: sanitizeUser(user) };
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>parent.postMessage(${JSON.stringify({ type: "adsl2ef-login-frame", payload })}, "*");</script></body></html>`;
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
  });
  response.end(html);
}

async function handleLoginReturn(request, response) {
  const raw = await readTextBody(request);
  const form = new URLSearchParams(raw);
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const state = await loadState();
  const user = state.users.find((item) => String(item.email || "").toLowerCase() === email);
  let payload;
  if (!user || !verifyPassword(password, user.passwordHash)) {
    payload = { ok: false, error: "invalid_credentials", message: "Identifiants invalides." };
  } else if (user.approvalStatus === "rejected") {
    payload = { ok: false, error: "rejected", message: "Votre demande d'accès a été refusée." };
  } else {
    payload = { ok: true, accessToken: signToken(user), user: sanitizeUser(user) };
  }
  const clientState = sanitizeSharedState(state);
  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connexion ADSL-2EF</title>
</head>
<body>
  <p>Connexion en cours...</p>
  <script>
    (() => {
      const storageKey = "adsl2ef-lms-v1";
      const payload = ${safeInlineJson(payload)};
      if (!payload.ok) {
        alert(payload.message || "Identifiants invalides.");
        location.replace("/");
        return;
      }
      const appState = ${safeInlineJson(clientState)};
      const user = payload.user;
      const existingUsers = Array.isArray(appState.users) ? appState.users : [];
      const index = existingUsers.findIndex((item) => item.id === user.id || String(item.email || "").toLowerCase() === String(user.email || "").toLowerCase());
      if (index >= 0) existingUsers[index] = { ...existingUsers[index], ...user };
      else existingUsers.push(user);
      appState.users = existingUsers;
      appState.currentUserId = user.id;
      appState.session = {
        accessToken: payload.accessToken || "",
        authProvider: "api",
        lastAuthAt: new Date().toISOString()
      };
      appState.ui = {
        ...(appState.ui || {}),
        screen: "dashboard",
        activeCourseId: null,
        activeActivityId: null,
        activeGameSessionId: null,
        activeGameQuizId: null,
        currentModuleId: null,
        currentLessonId: null
      };
      localStorage.setItem(storageKey, JSON.stringify(appState));
      location.replace("/?login=ok&v=20260608-login-return");
    })();
  </script>
</body>
</html>`;
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
  });
  response.end(html);
}

async function handleRegister(request, response) {
  const body = await readBody(request);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || email).trim();
  const phone = String(body.phone || "").trim();
  const role = normalizePublicRegistrationRole(body.role);

  if (!email) {
    json(response, 400, { error: "missing_email", message: "Email requis." });
    return;
  }

  async function registerWithLocalState() {
    const state = await loadState();
    const existing = state.users.find((u) => String(u.email || "").toLowerCase() === email);
    const user = existing || {
      id: randomId("usr"),
      email,
      createdAt: new Date().toISOString()
    };
    user.name = name;
    user.phone = phone;
    user.role = role;
    user.bio = user.bio || "";
    user.avatar = user.avatar || name.split(" ").map((w) => w[0]?.toUpperCase()).join("").slice(0, 2);
    user.approvalStatus = "approved";
    user.passwordHash = createPasswordHash(password);
    if (!existing) state.users.push(user);
    await saveState(state);
    json(response, existing ? 200 : 201, { accessToken: signToken(user), user: sanitizeUser(user) });
    return user;
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    await registerWithLocalState();
    return;
  }

  try {
    // 1. Créer dans Supabase Auth
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, phone, role, teachingProfile: normalizeTeachingProfile("school", role) }
      })
    });
    const userData = await createRes.json();

    let createdAuthUser = null;
    if (!createRes.ok) {
      const message = String(userData.msg || userData.message || "").toLowerCase();
      if (!message.includes("already")) {
        console.warn("Supabase public register failed:", userData);
        json(response, 502, {
          error: "supabase_signup_failed",
          message: userData.msg || userData.message || "Supabase a refuse la creation du compte."
        });
        return;
      }
      const existingAuthUser = await findSupabaseAuthUserByEmail(email);
      if (!existingAuthUser) {
        json(response, 409, {
          error: "email_exists",
          message: "Cet email existe deja, mais le compte Supabase n'a pas pu etre retrouve."
        });
        return;
      }
      createdAuthUser = await updateSupabaseAuthUser(existingAuthUser.id, { email, password, name, phone, role, teachingProfile: normalizeTeachingProfile("school", role) });
    } else {
      createdAuthUser = userData.user || userData;
    }

    const userId = createdAuthUser?.id;
    if (!userId) {
      json(response, 400, { error: "signup_failed", message: "Erreur lors de la création du compte." });
      return;
    }

    // 2. Créer le profil dans profiles avec approval_status = approved
    const avatar = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
    try {
      await upsertSupabaseProfile({ authUserId: userId, email, name, phone, role, teachingProfile: normalizeTeachingProfile("school", role), avatar, approvalStatus: "approved" });
    } catch (profileError) {
      console.warn("Supabase profile creation ignored:", profileError);
    }

    // 3. Ajouter l'utilisateur dans lms_state pour que le compte soit disponible immédiatement
    const createdUser = {
      id: userId,
      name,
      email,
      phone,
      role,
      teachingProfile: normalizeTeachingProfile("school", role),
      bio: "",
      avatar,
      passwordHash: createPasswordHash(password),
      createdAt: new Date().toISOString(),
      approvalStatus: "approved"
    };

    try {
      const state = await loadState();
      const adminUsers = state.users.filter((u) => u.role === "admin");
      adminUsers.forEach((admin) => {
        state.notifications.unshift({
          id: randomId("notif"),
          userId: admin.id,
          title: "Nouvelle inscription",
          message: `${name} (${role}) a rejoint la plateforme.`,
          level: "success",
          read: false,
          createdAt: new Date().toISOString()
        });
      });
      const existing = state.users.find((user) => user.id === userId || String(user.email || "").toLowerCase() === email);
      if (existing) Object.assign(existing, createdUser);
      else state.users.push(createdUser);
      await saveState(state);
    } catch (stateError) {
      console.warn("LMS state registration ignored:", stateError);
    }

    json(response, 201, { accessToken: signToken(createdUser), user: sanitizeUser(createdUser) });
  } catch (err) {
    console.error("Register error:", err);
    json(response, 500, { error: "internal_error", message: "Erreur lors de l'inscription Supabase." });
  }
}

async function handleRegisterReturn(request, response) {
  const raw = await readTextBody(request);
  const form = new URLSearchParams(raw);
  let result = {
    status: 500,
    payload: { ok: false, message: "Inscription impossible pour le moment." }
  };
  try {
    const registerResponse = await fetch(`http://${HOST === "0.0.0.0" ? "127.0.0.1" : HOST}:${PORT}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name") || "",
        email: form.get("email") || "",
        phone: form.get("phone") || "",
        password: form.get("password") || "",
        role: form.get("role") || "student"
      })
    });
    result = {
      status: registerResponse.status,
      payload: await registerResponse.json()
    };
  } catch (error) {
    console.error("Register return error:", error);
  }

  const state = await loadState();
  const clientState = sanitizeSharedState(state);
  const payload = {
    ok: result.status >= 200 && result.status < 300,
    ...(result.payload || {})
  };
  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Inscription ADSL-2EF</title>
</head>
<body>
  <p>Inscription en cours...</p>
  <script>
    (() => {
      const storageKey = "adsl2ef-lms-v1";
      const payload = ${safeInlineJson(payload)};
      if (!payload.ok || !payload.user) {
        alert(payload.message || "Inscription impossible pour le moment.");
        location.replace("/");
        return;
      }
      const appState = ${safeInlineJson(clientState)};
      const user = payload.user;
      const existingUsers = Array.isArray(appState.users) ? appState.users : [];
      const index = existingUsers.findIndex((item) => item.id === user.id || String(item.email || "").toLowerCase() === String(user.email || "").toLowerCase());
      if (index >= 0) existingUsers[index] = { ...existingUsers[index], ...user };
      else existingUsers.push(user);
      appState.users = existingUsers;
      appState.currentUserId = user.id;
      appState.session = {
        accessToken: payload.accessToken || "",
        authProvider: "api",
        lastAuthAt: new Date().toISOString()
      };
      appState.ui = {
        ...(appState.ui || {}),
        screen: "dashboard",
        activeCourseId: null,
        activeActivityId: null,
        activeGameSessionId: null,
        activeGameQuizId: null,
        currentModuleId: null,
        currentLessonId: null
      };
      localStorage.setItem(storageKey, JSON.stringify(appState));
      location.replace("/?register=ok&v=20260609-register-return");
    })();
  </script>
</body>
</html>`;
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
  });
  response.end(html);
}

async function handleApproveUser(request, response) {
  if (!requireBearer(request, response)) return;
  const body = await readBody(request);
  const userId = String(body.userId || "").trim();
  const action = String(body.action || "approve").trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    json(response, 503, { error: "supabase_not_configured" });
    return;
  }

  try {
    const newStatus = action === "approve" ? "approved" : "rejected";

    // 1. Mettre à jour profiles Supabase
    await updateSupabaseProfileApproval(userId, newStatus);

    // 2. Mettre à jour lms_state
    const state = await loadState();
    const user = state.users.find((u) => u.id === userId);
    if (user) {
      user.approvalStatus = newStatus;
      await saveState(state);
    }

    json(response, 200, { ok: true, userId, status: newStatus });
  } catch (err) {
    console.error("Approve user error:", err);
    json(response, 500, { error: "internal_error", message: err.message });
  }
}

async function findSupabaseAuthUserByEmail(email) {
  const usersRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
    headers: {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });
  const usersData = await usersRes.json();
  if (!usersRes.ok) {
    throw new Error(usersData.msg || usersData.message || "Lecture des utilisateurs Supabase impossible.");
  }
  return (usersData.users || []).find((user) => String(user.email || "").toLowerCase() === email) || null;
}

async function updateSupabaseAuthUser(userId, { email, password, name, phone, role, teachingProfile }) {
  const payload = {
    email,
    email_confirm: true,
    user_metadata: { name, phone: phone || "", role, teachingProfile: normalizeTeachingProfile(teachingProfile, role) }
  };
  if (password) payload.password = password;

  const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`
    },
    body: JSON.stringify(payload)
  });
  const updateData = await updateRes.json();
  if (!updateRes.ok) {
    throw new Error(updateData.msg || updateData.message || "Mise a jour utilisateur Supabase impossible.");
  }
  return updateData.user || updateData;
}

async function handleAdminCreateUser(request, response) {
  if (!requireBearer(request, response)) return;
  const body = await readBody(request);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || email).trim();
  const phone = String(body.phone || "").trim();
  const role = String(body.role || "student").trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    json(response, 503, { error: "supabase_not_configured" });
    return;
  }

  try {
    // 1. Créer dans Supabase Auth via Admin API
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        email, password,
        email_confirm: true,
        user_metadata: { name, phone, role, teachingProfile: normalizeTeachingProfile("school", role) }
      })
    });
    const userData = await createRes.json();
    let createdAuthUser = null;
    if (!createRes.ok) {
      const message = String(userData.msg || userData.message || "").toLowerCase();
      if (!message.includes("already")) {
        json(response, 400, { error: "create_failed", message: userData.msg || userData.message || "Creation impossible." });
        return;
      }
      const existingAuthUser = await findSupabaseAuthUserByEmail(email);
      if (!existingAuthUser) {
        json(response, 409, { error: "user_exists_but_not_found", message: "Ce compte existe deja, mais il est introuvable dans Supabase Auth." });
        return;
      }
      createdAuthUser = await updateSupabaseAuthUser(existingAuthUser.id, { email, password, name, phone, role });
    } else {
      createdAuthUser = userData.user || userData;
    }

    const userId = createdAuthUser.id;
    const avatar = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

    // 2. Créer/mettre à jour le profil avec approval_status = approved
    await upsertSupabaseProfile({ authUserId: userId, email, name, phone, role, teachingProfile: normalizeTeachingProfile("school", role), avatar, approvalStatus: "approved" });

    // 3. Ajouter dans lms_state pour que le dashboard admin le voit immédiatement
    const state = await loadState();
    const existingIdx = state.users.findIndex((u) => u.email.toLowerCase() === email || u.id === userId);
    const newUser = {
      id: userId, name, email, phone, role,
      teachingProfile: normalizeTeachingProfile("school", role),
      bio: "", avatar,
      createdAt: new Date().toISOString(),
      approvalStatus: "approved"
    };
    if (existingIdx >= 0) {
      state.users[existingIdx] = newUser;
    } else {
      state.users.push(newUser);
    }
    await saveState(state);

    json(response, 201, { user: newUser });
  } catch (err) {
    console.error("Admin create user error:", err);
    json(response, 500, { error: "internal_error", message: err.message });
  }
}

async function handleGetProfiles(request, response) {
  if (!requireBearer(request, response)) return;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    json(response, 503, { error: "supabase_not_configured" });
    return;
  }
  try {
    const profiles = await supabaseFetch("/profiles?select=*&order=created_at.desc");
    // Enrichir avec les emails depuis auth.users via service role
    const usersRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
      headers: {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });
    const usersData = await usersRes.json();
    const authUsers = usersData.users || [];
    const profileByAuthId = {};
    const seen = new Set();
    (profiles || []).forEach((profile) => {
      const id = profile.auth_user_id || profile.id;
      if (id) profileByAuthId[id] = profile;
    });
    const enriched = authUsers.map((authUser) => {
      const profile = profileByAuthId[authUser.id] || {};
      seen.add(authUser.id);
      const name = profile.full_name || profile.name || authUser.user_metadata?.name || authUser.user_metadata?.full_name || authUser.email || "";
      return {
        id: authUser.id,
        name,
        email: profile.email || authUser.email || "",
        phone: profile.phone || authUser.user_metadata?.phone || "",
        role: profile.role || authUser.user_metadata?.role || "student",
        teachingProfile: normalizeTeachingProfile(profile.teaching_profile || authUser.user_metadata?.teachingProfile, profile.role || authUser.user_metadata?.role || "student"),
        bio: profile.bio || "",
        avatar: profile.avatar || name.split(" ").filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join(""),
        approvalStatus: profile.approval_status || "approved",
        createdAt: profile.created_at || authUser.created_at
      };
    });
    (profiles || []).forEach((profile) => {
      const id = profile.auth_user_id || profile.id;
      if (!id || seen.has(id)) return;
      enriched.push({
        id,
        name: profile.full_name || profile.name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        role: profile.role || "student",
        teachingProfile: normalizeTeachingProfile(profile.teaching_profile, profile.role || "student"),
        bio: profile.bio || "",
        avatar: profile.avatar || "",
        approvalStatus: profile.approval_status || "approved",
        createdAt: profile.created_at
      });
    });
    json(response, 200, { users: enriched });
  } catch (err) {
    json(response, 500, { error: "internal_error", message: err.message });
  }
}

async function handleCurrentSession(request, response) {
  const localUserId = getAuthenticatedUserId(request);
  if (localUserId) {
    const state = await loadState();
    const user = state.users.find((u) => u.id === localUserId);
    if (user) {
      json(response, 200, { user: sanitizeUser(user) });
      return;
    }
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    if (!requireBearer(request, response)) return;
    const state = await loadState();
    const userId = localUserId;
    const user = userId ? state.users.find((u) => u.id === userId) : null;
    if (!user) { json(response, 404, { error: "session_not_found" }); return; }
    json(response, 200, { user: sanitizeUser(user) });
    return;
  }

  // Vérifier le token Supabase
  const auth = request.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) { json(response, 401, { error: "unauthorized" }); return; }
  const token = auth.slice(7).trim();

  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${token}` }
    });
    if (!userRes.ok) { json(response, 401, { error: "invalid_token" }); return; }
    const userData = await userRes.json();
    const profile = await loadProfileByAuthUserId(userData.id);
    json(response, 200, {
      user: {
        id: userData.id,
        name: profile?.full_name || profile?.name || userData.email,
        email: userData.email,
        phone: profile?.phone || userData.user_metadata?.phone || "",
        role: profile?.role || "student",
        teachingProfile: normalizeTeachingProfile(profile?.teaching_profile || userData.user_metadata?.teachingProfile, profile?.role || "student"),
        bio: profile?.bio || "",
        avatar: profile?.avatar || "",
        approvalStatus: profile?.approval_status || "pending"
      }
    });
  } catch (err) {
    json(response, 500, { error: "internal_error", message: err.message });
  }
}

async function handlePaymentInit(request, response) {
  if (!requireBearer(request, response)) return;
  const body = await readBody(request);
  const state = await loadState();
  const provider = normalizePaymentProvider(body.provider || "manual");
  if (!provider) {
    json(response, 400, { error: "unsupported_payment_provider", message: "Fournisseur de paiement non supporte." });
    return;
  }
  const course = state.courses.find((item) => item.id === String(body.courseId || "").trim());
  const user = findUserById(state, String(body.userId || "").trim());
  if (!course || !user) {
    json(response, 404, { error: "payment_context_not_found", message: "Cours ou utilisateur introuvable." });
    return;
  }
  const payment = {
    id: randomId("pay"),
    provider,
    courseId: course.id,
    userId: user.id,
    amount: Number(body.amount || course.price || 0),
    currency: "XOF",
    status: "pending",
    merchantReference: `${provider}-${Date.now()}-${course.id.slice(0, 8)}`,
    providerReference: "",
    paymentUrl: "",
    failureReason: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    confirmedAt: ""
  };
  if (provider === "manual") {
    state.paymentRecords.unshift(payment);
    await saveState(state);
    await appendEvent({ type: "payment.created", createdAt: new Date().toISOString(), payload: sanitizePayment(payment) });
    json(response, 200, sanitizePayment(payment));
    return;
  }
  try {
    const providerConfig = getPaymentProviderConfig(provider, state);
    const remote = await initializeProviderPayment(providerConfig, payment, user, course);
    payment.status = normalizePaymentStatus(remote.status);
    payment.paymentUrl = remote.paymentUrl || "";
    payment.providerReference = remote.providerReference || "";
    payment.failureReason = remote.failureReason || "";
  } catch (error) {
    payment.status = "failed";
    payment.failureReason = error.message || "Initialisation du paiement impossible.";
  }
  state.paymentRecords.unshift(payment);
  await saveState(state);
  await appendEvent({ type: "payment.created", createdAt: new Date().toISOString(), payload: sanitizePayment(payment) });
  json(response, payment.status === "failed" ? 502 : 200, sanitizePayment(payment));
}

async function handlePaymentStatus(request, response) {
  if (!requireBearer(request, response)) return;
  const state = await loadState();
  const paymentId = String(getRequestUrl(request).searchParams.get("paymentId") || "").trim();
  const payment = state.paymentRecords.find((item) => item.id === paymentId);
  if (!payment) {
    json(response, 404, { error: "payment_not_found", message: "Transaction introuvable." });
    return;
  }
  json(response, 200, sanitizePayment(payment));
}

async function handlePaymentConfirm(request, response) {
  if (!requireBearer(request, response)) return;
  const body = await readBody(request);
  const state = await loadState();
  const paymentId = String(body.paymentId || "").trim();
  const payment = state.paymentRecords.find((item) => item.id === paymentId);
  if (!payment) {
    json(response, 404, { error: "payment_not_found", message: "Transaction introuvable." });
    return;
  }
  payment.status = normalizePaymentStatus(body.status || payment.status);
  payment.providerReference = String(body.providerReference || payment.providerReference || "").trim();
  payment.paymentUrl = String(body.paymentUrl || payment.paymentUrl || "").trim();
  payment.failureReason = String(body.failureReason || "").trim();
  payment.updatedAt = new Date().toISOString();
  if (payment.status === "approved") {
    payment.confirmedAt = new Date().toISOString();
    applyApprovedEnrollment(state, payment);
  }
  await saveState(state);
  await appendEvent({ type: "payment.updated", createdAt: new Date().toISOString(), payload: sanitizePayment(payment) });
  json(response, 200, sanitizePayment(payment));
}

async function handlePaymentWebhook(request, response, provider) {
  const normalizedProvider = normalizePaymentProvider(provider);
  if (!normalizedProvider || normalizedProvider === "manual") {
    json(response, 400, { error: "unsupported_payment_provider", message: "Webhook fournisseur non supporte." });
    return;
  }
  if (PAYMENT_WEBHOOK_SECRET) {
    const signature = request.headers["x-webhook-secret"] || "";
    if (signature !== PAYMENT_WEBHOOK_SECRET) {
      json(response, 401, { error: "invalid_webhook_secret" });
      return;
    }
  }
  const body = await readBody(request);
  const state = await loadState();
  const candidateId = extractWebhookPaymentReference(body);
  const payment = state.paymentRecords.find((item) => item.id === candidateId || item.merchantReference === candidateId);
  if (!payment) {
    json(response, 404, { error: "payment_not_found", message: "Transaction introuvable pour ce webhook." });
    return;
  }
  const nextStatus = normalizedProvider === "paygate"
    ? extractWebhookStatus(body, body.payment_reference || body.tx_reference ? "approved" : payment.status)
    : extractWebhookStatus(body, payment.status);
  payment.status = normalizePaymentStatus(nextStatus);
  payment.provider = normalizedProvider;
  payment.providerReference = String(extractProviderReference(body) || payment.providerReference || "").trim();
  payment.paymentUrl = String(extractPaymentUrl(body) || payment.paymentUrl || "").trim();
  payment.failureReason = String(body.failureReason || body.failure_reason || body.message || body.data?.message || payment.failureReason || "").trim();
  payment.updatedAt = new Date().toISOString();
  if (payment.status === "approved") {
    payment.confirmedAt = new Date().toISOString();
    applyApprovedEnrollment(state, payment);
  }
  await saveState(state);
  await appendEvent({ type: "payment.webhook", createdAt: new Date().toISOString(), payload: sanitizePayment(payment) });
  json(response, 200, { ok: true, payment: sanitizePayment(payment) });
}

async function handleSummary(request, response) {
  if (!requireBearer(request, response)) return;
  const state = await loadState();
  json(response, 200, {
    summary: {
      users: state.users.length,
      courses: state.courses.length,
      activities: state.activities.length,
      payments: state.paymentRecords.length,
      submissions: state.submissions.length,
      messages: state.messages.length,
      announcements: state.announcements.length,
      attendanceSessions: state.attendanceSessions.length,
      forumThreads: state.forumThreads.length
    }
  });
}

async function handleRepairEncoding(request, response) {
  if (!requireBearer(request, response)) return;
  const state = await loadState();
  repairFrenchEncodingDeep(state);
  await saveState(state);
  await appendEvent({ type: "admin.encoding.repaired", createdAt: new Date().toISOString(), payload: { repaired: true } });
  json(response, 200, { ok: true });
}

async function handleEvents(request, response) {
  if (!requireBearer(request, response)) return;
  await ensureDataFiles();
  const raw = await fsp.readFile(EVENTS_FILE, "utf8");
  const events = raw
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-100)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .reverse();
  json(response, 200, { events });
}

async function applyEventToState(state, eventType, payload) {
  switch (eventType) {
    case "course.created":
    case "course.updated":
    case "course.archived":
    case "course.restored":
      if (payload.course) {
        const existing = ensureArray(state.courses).find((course) => course.id === payload.course.id);
        replaceOrInsert(state.courses, mergeCoursePreservingContent(existing, payload.course));
      }
      return { course: payload.course };
    case "course.release.updated": {
      const course = state.courses.find((item) => item.id === payload.courseId);
      if (!course) return {};
      const currentRelease = course.release && typeof course.release === "object" ? course.release : {};
      course.release = {
        modules: {
          ...(currentRelease.modules && typeof currentRelease.modules === "object" ? currentRelease.modules : {}),
          ...(payload.release?.modules && typeof payload.release.modules === "object" ? payload.release.modules : {})
        },
        lessons: {
          ...(currentRelease.lessons && typeof currentRelease.lessons === "object" ? currentRelease.lessons : {}),
          ...(payload.release?.lessons && typeof payload.release.lessons === "object" ? payload.release.lessons : {})
        }
      };
      return { course };
    }
    case "course.deleted": {
      const courseId = payload.courseId || payload.course?.id;
      if (!courseId) return {};
      await deleteSupabaseCourseRows(courseId);
      const activityIds = ensureArray(state.activities).filter((activity) => activity.courseId === courseId).map((activity) => activity.id);
      state.courses = ensureArray(state.courses).filter((course) => course.id !== courseId);
      state.activities = ensureArray(state.activities).filter((activity) => activity.courseId !== courseId);
      state.questionBank = ensureArray(state.questionBank).filter((question) => question.courseId !== courseId);
      state.submissions = ensureArray(state.submissions).filter((submission) => !activityIds.includes(submission.activityId));
      state.completionRecords = ensureArray(state.completionRecords).filter((record) => record.courseId !== courseId);
      state.certificateRecords = ensureArray(state.certificateRecords).filter((record) => record.courseId !== courseId);
      state.attendanceSessions = ensureArray(state.attendanceSessions).filter((session) => session.courseId !== courseId);
      state.announcements = ensureArray(state.announcements).filter((announcement) => announcement.courseId !== courseId);
      state.forumThreads = ensureArray(state.forumThreads).filter((thread) => thread.courseId !== courseId);
      state.paymentRecords = ensureArray(state.paymentRecords).filter((payment) => payment.courseId !== courseId);
      state.pendingEnrollments = ensureArray(state.pendingEnrollments).filter((enrollment) => enrollment.courseId !== courseId);
      return { deleted: true, courseId };
    }
    case "activity.created":
    case "activity.updated":
      if (payload.activity) replaceOrInsert(state.activities, payload.activity);
      return { activity: payload.activity };
    case "game.quiz.created":
    case "game.quiz.updated":
      state.gameQuizzes = ensureArray(state.gameQuizzes);
      if (payload.quiz) replaceOrInsert(state.gameQuizzes, payload.quiz);
      return { quiz: payload.quiz };
    case "game.quiz.deleted":
      state.gameQuizzes = ensureArray(state.gameQuizzes).filter((quiz) => quiz.id !== payload.quizId);
      state.gameSessions = ensureArray(state.gameSessions).filter((session) => session.quizId !== payload.quizId);
      state.gameResults = ensureArray(state.gameResults).filter((result) => result.quizId !== payload.quizId);
      return { deleted: true, quizId: payload.quizId };
    case "game.session.started":
      state.gameSessions = ensureArray(state.gameSessions);
      if (payload.session) replaceOrInsert(state.gameSessions, payload.session);
      return { session: payload.session };
    case "game.session.joined": {
      const session = ensureArray(state.gameSessions).find((item) => item.id === payload.sessionId);
      if (!session || !payload.participant) return {};
      session.participants = ensureArray(session.participants);
      {
        const index = session.participants.findIndex((item) => item.userId === payload.participant.userId);
        if (index >= 0) session.participants[index] = { ...session.participants[index], ...payload.participant };
        else session.participants.push(payload.participant);
      }
      return { session };
    }
    case "game.answer.submitted": {
      const session = ensureArray(state.gameSessions).find((item) => item.id === payload.sessionId);
      if (!session || !payload.participant) return {};
      session.participants = ensureArray(session.participants);
      {
        const index = session.participants.findIndex((item) => item.userId === payload.participant.userId);
        if (index >= 0) session.participants[index] = { ...session.participants[index], ...payload.participant };
        else session.participants.push(payload.participant);
      }
      return { session };
    }
    case "game.session.finished":
      state.gameSessions = ensureArray(state.gameSessions);
      if (payload.session) replaceOrInsert(state.gameSessions, payload.session);
      state.gameResults = ensureArray(state.gameResults).filter((result) => result.sessionId !== payload.session?.id);
      state.gameResults.push(...ensureArray(payload.results));
      return { session: payload.session, results: payload.results };
    case "module.created":
    case "module.updated": {
      const course = state.courses.find((item) => item.id === payload.courseId);
      if (!course || !payload.module) return {};
      course.modules = ensureArray(course.modules);
      replaceOrInsert(course.modules, payload.module);
      return { module: payload.module };
    }
    case "module.deleted": {
      const course = state.courses.find((item) => item.id === payload.courseId);
      if (!course) return {};
      course.modules = ensureArray(course.modules).filter((module) => module.id !== payload.moduleId);
      state.activities = state.activities.filter((activity) => !(activity.courseId === payload.courseId && activity.moduleId === payload.moduleId));
      return { deleted: true };
    }
    case "lesson.created":
    case "lesson.updated": {
      const course = state.courses.find((item) => item.id === payload.courseId);
      const module = course?.modules?.find((entry) => entry.id === payload.moduleId);
      if (!module || !payload.lesson) return {};
      module.lessons = ensureArray(module.lessons);
      replaceOrInsert(module.lessons, payload.lesson);
      return { lesson: payload.lesson };
    }
    case "lesson.deleted": {
      const course = state.courses.find((item) => item.id === payload.courseId);
      const module = course?.modules?.find((entry) => entry.id === payload.moduleId);
      if (!module) return {};
      module.lessons = ensureArray(module.lessons).filter((lesson) => lesson.id !== payload.lessonId);
      state.activities = state.activities.filter((activity) => !(activity.courseId === payload.courseId && activity.lessonId === payload.lessonId));
      return { deleted: true };
    }
    case "announcement.created":
      if (payload.announcement) replaceOrInsert(state.announcements, payload.announcement);
      return { announcement: payload.announcement };
    case "message.created":
      if (payload.message) replaceOrInsert(state.messages, payload.message);
      return { message: payload.message };
    case "forum.thread.created":
      if (payload.thread) replaceOrInsert(state.forumThreads, payload.thread);
      return { thread: payload.thread };
    case "forum.post.created": {
      const thread = state.forumThreads.find((item) => item.id === payload.threadId);
      if (!thread || !payload.post) return {};
      thread.posts = ensureArray(thread.posts);
      replaceOrInsert(thread.posts, payload.post);
      return { post: payload.post };
    }
    case "attendance.created":
      if (payload.session) replaceOrInsert(state.attendanceSessions, payload.session);
      return { session: payload.session };
    case "quiz.submitted":
    case "assignment.submitted":
    case "submission.reviewed":
      if (payload.submission) replaceOrInsert(state.submissions, payload.submission);
      return { submission: payload.submission };
    case "user.created":
    case "user.updated":
      if (payload.user) {
        const existingUser = state.users.find((user) => user.id === payload.user.id || String(user.email || "").toLowerCase() === String(payload.user.email || "").toLowerCase());
        const merged = {
          ...payload.user,
          passwordHash: payload.user.passwordHash || existingUser?.passwordHash || createPasswordHash(payload.user.password || "ChangeMe123!")
        };
        delete merged.password;
        if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
          const existingAuthUser = merged.email ? await findSupabaseAuthUserByEmail(String(merged.email).toLowerCase()) : null;
          const authUserId = existingAuthUser?.id || merged.id;
          await updateSupabaseAuthUser(authUserId, {
            email: merged.email,
            name: merged.name,
            phone: merged.phone || "",
            role: merged.role,
            teachingProfile: normalizeTeachingProfile(merged.teachingProfile, merged.role)
          }).catch((error) => console.warn("[Supabase] auth profile update ignored:", error.message));
          await upsertSupabaseProfile({
            authUserId,
            email: merged.email,
            name: merged.name,
            phone: merged.phone || "",
            role: merged.role,
            teachingProfile: normalizeTeachingProfile(merged.teachingProfile, merged.role),
            bio: merged.bio || "",
            avatar: merged.avatar || initials(merged.name),
            approvalStatus: merged.approvalStatus || "approved"
          }).catch((error) => console.warn("[Supabase] profile update ignored:", error.message));
        }
        replaceOrInsert(state.users, merged);
        return { user: sanitizeUser(merged) };
      }
      return {};
    case "user.deleted":
      state.users = state.users.filter((user) => user.id !== payload.userId);
      if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        const email = String(payload.user?.email || "").trim().toLowerCase();
        const authUser = email ? await findSupabaseAuthUserByEmail(email) : null;
        const ids = uniqueNonEmpty([payload.userId, payload.user?.id, authUser?.id]);
        await Promise.all(ids.map((id) => deleteSupabaseAuthUser(id)));
        await Promise.all(ids.map((id) => deleteSupabaseProfileRows({ userId: id, email })));
        if (!ids.length && email) await deleteSupabaseProfileRows({ userId: "", email });
      }
      return { deleted: true };
    default:
      return {};
  }
}

async function handleBusinessEvent(request, response) {
  if (!requireBearer(request, response)) return;
  const body = await readBody(request);
  const state = await loadState();
  const event = {
    id: randomId("evt"),
    type: body.type || "unknown",
    emittedAt: body.emittedAt || new Date().toISOString(),
    actorId: body.actorId || null,
    payload: body.payload || {}
  };
  const result = await applyEventToState(state, event.type, event.payload);
  await appendEvent(event);
  await saveState(state);
  json(response, 200, {
    eventId: event.id,
    ...result
  });
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      const origin = request.headers.origin || "";
      const allowedOrigin = ALLOWED_ORIGIN || origin || "*";
      response.writeHead(204, {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY"
      });
      response.end();
      return;
    }

    if (shouldRedirectCustomHost(request)) {
      return redirectCustomHostToStableApp(request, response);
    }

    const pathname = getRequestPath(request);
    if (request.method === "GET" && pathname === "/health") return await handleHealth(request, response);
    if (request.method === "GET" && pathname === "/debug/supabase") return await handleSupabaseDebug(request, response);
    if (request.method === "GET" && pathname === "/auth/me") return await handleCurrentSession(request, response);
    if (request.method === "GET" && pathname === "/lms/state") return await handleGetState(request, response);
    if (request.method === "GET" && pathname === "/lms/summary") return await handleSummary(request, response);
    if (request.method === "GET" && pathname === "/lms/events") return await handleEvents(request, response);
    if (request.method === "GET" && pathname === "/payments/status") return await handlePaymentStatus(request, response);
    if (request.method === "GET" && pathname === "/auth/users") return await handleGetProfiles(request, response);
    if (request.method === "PUT" && pathname === "/lms/state") return await handlePutState(request, response);
    if (request.method === "POST" && pathname === "/admin/repair-encoding") return await handleRepairEncoding(request, response);
    if (request.method === "POST" && pathname === "/auth/login") return await handleLogin(request, response);
    if (request.method === "POST" && pathname === "/auth/login-frame") return await handleLoginFrame(request, response);
    if (request.method === "POST" && pathname === "/auth/login-return") return await handleLoginReturn(request, response);
    if (request.method === "POST" && pathname === "/auth/register") return await handleRegister(request, response);
    if (request.method === "POST" && pathname === "/auth/register-return") return await handleRegisterReturn(request, response);
    if (request.method === "POST" && pathname === "/auth/approve") return await handleApproveUser(request, response);
    if (request.method === "POST" && pathname === "/auth/admin/create") return await handleAdminCreateUser(request, response);
    if (request.method === "POST" && pathname === "/payments/init") return await handlePaymentInit(request, response);
    if (request.method === "POST" && pathname === "/payments/confirm") return await handlePaymentConfirm(request, response);
    if (request.method === "POST" && pathname.startsWith("/payments/webhook/")) return await handlePaymentWebhook(request, response, pathname.split("/").pop());
    if (request.method === "POST" && pathname === "/lms/events") return await handleBusinessEvent(request, response);

    // Fichiers statiques (frontend) — uniquement GET
    if (request.method === "GET") return await serveStatic(request, response);

    return notFound(response);
  } catch (error) {
    console.error(error);
    if (error.message === "payload_too_large") {
      json(response, 413, { error: "payload_too_large", message: "Corps de la requête trop volumineux." });
      return;
    }
    json(response, 500, {
      error: "internal_error",
      message: error.message || "Erreur interne"
    });
  }
});

ensureDataFiles()
  .then(() => {
    server.listen(PORT, HOST, () => {
      console.log(`ADSL-2EF backend démarré sur http://${HOST}:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Impossible d'initialiser le backend:", error);
    process.exit(1);
  });
