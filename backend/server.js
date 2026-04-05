"use strict";

const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const API_TOKEN = process.env.ADSL2EF_API_TOKEN || "";
const PAYMENT_WEBHOOK_SECRET = process.env.ADSL2EF_PAYMENT_WEBHOOK_SECRET || "";
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
      mixxEnabled: true,
      floozEnabled: true,
      mode: "manual",
      callbackUrl: "",
      merchantMixx: "",
      merchantFlooz: ""
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
  { name: "Admin ADSL-2EF", email: "admin@adsl2ef.tg", role: "admin", bio: "Supervision globale de la plateforme.", avatar: "AA", password: "Admin123!" },
  { name: "Afi Mensah", email: "teacher@adsl2ef.tg", role: "teacher", bio: "Enseignante de mathématiques et coordinatrice numérique.", avatar: "AM", password: "Teacher123!" },
  { name: "Kodjo Etse", email: "student@adsl2ef.tg", role: "student", bio: "Élève de première scientifique.", avatar: "KE", password: "Student123!" }
];

let inMemoryState = null;

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS"
  });
  response.end(JSON.stringify(payload));
}

function notFound(response) {
  json(response, 404, { error: "not_found" });
}

function getRequestPath(request) {
  return new URL(request.url, `http://${request.headers.host || "localhost"}`).pathname;
}

function getRequestUrl(request) {
  return new URL(request.url, `http://${request.headers.host || "localhost"}`);
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
    iat: Math.floor(Date.now() / 1000)
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    bio: user.bio || "",
    avatar: user.avatar || "",
    createdAt: user.createdAt
  };
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePaymentStatus(status) {
  const value = String(status || "pending").trim().toLowerCase();
  if (["approved", "paid", "success", "successful", "completed", "complete", "validated"].includes(value)) return "approved";
  if (["failed", "error", "declined", "rejected"].includes(value)) return "failed";
  if (["cancelled", "canceled", "expired", "timeout"].includes(value)) return "cancelled";
  if (["processing", "initiated", "created"].includes(value)) return "processing";
  return "pending";
}

function extractPaymentUrl(payload) {
  if (!payload || typeof payload !== "object") return "";
  return payload.paymentUrl || payload.payment_url || payload.checkoutUrl || payload.checkout_url || payload.url || payload.link || "";
}

function extractProviderReference(payload) {
  if (!payload || typeof payload !== "object") return "";
  return payload.providerReference || payload.provider_reference || payload.transactionId || payload.transaction_id || payload.reference || "";
}

async function ensureDataFiles() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) {
    const seeded = structuredClone(defaultState);
    seeded.users = demoUsers.map((user) => ({
      id: randomId("usr"),
      name: user.name,
      email: user.email,
      role: user.role,
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
  await ensureDataFiles();
  const raw = await fsp.readFile(STATE_FILE, "utf8");
  const parsed = JSON.parse(raw);
  parsed.users = ensureArray(parsed.users);
  parsed.courses = ensureArray(parsed.courses);
  parsed.activities = ensureArray(parsed.activities);
  parsed.questionBank = ensureArray(parsed.questionBank);
  parsed.paymentRecords = ensureArray(parsed.paymentRecords);
  parsed.submissions = ensureArray(parsed.submissions);
  parsed.attendanceSessions = ensureArray(parsed.attendanceSessions);
  parsed.notifications = ensureArray(parsed.notifications);
  parsed.activityLog = ensureArray(parsed.activityLog);
  parsed.announcements = ensureArray(parsed.announcements);
  parsed.messages = ensureArray(parsed.messages);
  parsed.forumThreads = ensureArray(parsed.forumThreads);
  inMemoryState = parsed;
  return inMemoryState;
}

async function saveState(nextState) {
  inMemoryState = nextState;
  await fsp.writeFile(STATE_FILE, JSON.stringify(nextState, null, 2), "utf8");
}

async function appendEvent(event) {
  await fsp.appendFile(EVENTS_FILE, `${JSON.stringify(event)}\n`, "utf8");
}

async function readBody(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    request.on("data", (chunk) => { data += chunk; });
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

function decodeTokenSubject(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed.sub || null;
  } catch {
    return null;
  }
}

function getAuthenticatedUserId(request) {
  const auth = request.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  return decodeTokenSubject(auth.slice("Bearer ".length).trim());
}

function findUserById(state, userId) {
  return state.users.find((user) => user.id === userId) || null;
}

function getPaymentProviderConfig(provider, state) {
  const payments = state.config?.payments || {};
  if (provider === "mixx") {
    return {
      name: "Mixx by Yas",
      initUrl: MIXX_INIT_URL,
      apiKey: MIXX_API_KEY,
      merchantId: MIXX_MERCHANT_ID || payments.merchantMixx || "",
      callbackUrl: MIXX_CALLBACK_URL || payments.callbackUrl || "",
      returnUrl: MIXX_RETURN_URL || payments.callbackUrl || "",
      cancelUrl: MIXX_CANCEL_URL || payments.callbackUrl || ""
    };
  }
  if (provider === "flooz") {
    return {
      name: "Flooz",
      initUrl: FLOOZ_INIT_URL,
      apiKey: FLOOZ_API_KEY,
      merchantId: FLOOZ_MERCHANT_ID || payments.merchantFlooz || "",
      callbackUrl: FLOOZ_CALLBACK_URL || payments.callbackUrl || "",
      returnUrl: FLOOZ_RETURN_URL || payments.callbackUrl || "",
      cancelUrl: FLOOZ_CANCEL_URL || payments.callbackUrl || ""
    };
  }
  return {
    name: "Paiement",
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
    merchant_id: providerConfig.merchantId,
    merchantId: providerConfig.merchantId,
    reference: payment.merchantReference,
    external_reference: payment.merchantReference,
    callback_url: providerConfig.callbackUrl,
    callbackUrl: providerConfig.callbackUrl,
    return_url: providerConfig.returnUrl,
    returnUrl: providerConfig.returnUrl,
    cancel_url: providerConfig.cancelUrl,
    cancelUrl: providerConfig.cancelUrl,
    customer: {
      id: user.id,
      name: user.name,
      email: user.email
    },
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

async function handleGetState(request, response) {
  if (!requireBearer(request, response)) return;
  const state = await loadState();
  json(response, 200, { payload: state });
}

async function handlePutState(request, response) {
  if (!requireBearer(request, response)) return;
  const body = await readBody(request);
  const incoming = body.payload && typeof body.payload === "object" ? body.payload : body;
  const state = { ...structuredClone(defaultState), ...incoming };
  await saveState(state);
  json(response, 200, { payload: state });
}

async function handleLogin(request, response) {
  const body = await readBody(request);
  const state = await loadState();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const user = state.users.find((entry) => entry.email.toLowerCase() === email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    json(response, 401, { error: "invalid_credentials", message: "Identifiants invalides." });
    return;
  }
  const accessToken = signToken(user);
  json(response, 200, {
    accessToken,
    user: sanitizeUser(user)
  });
}

async function handleCurrentSession(request, response) {
  if (!requireBearer(request, response)) return;
  const state = await loadState();
  const userId = getAuthenticatedUserId(request);
  const user = userId ? findUserById(state, userId) : null;
  if (!user) {
    json(response, 404, { error: "session_not_found", message: "Session introuvable." });
    return;
  }
  json(response, 200, { user: sanitizeUser(user) });
}

async function handleRegister(request, response) {
  const body = await readBody(request);
  const state = await loadState();
  const email = String(body.email || "").trim().toLowerCase();
  if (!email) {
    json(response, 400, { error: "missing_email", message: "Email requis." });
    return;
  }
  if (state.users.some((user) => user.email.toLowerCase() === email)) {
    json(response, 409, { error: "email_exists", message: "Cet email existe déjà." });
    return;
  }
  const user = {
    id: randomId("usr"),
    name: String(body.name || email).trim(),
    email,
    role: String(body.role || "student").trim() || "student",
    bio: "",
    avatar: String((body.name || email)).split(" ").filter(Boolean).slice(0, 2).map((item) => item[0]?.toUpperCase()).join(""),
    createdAt: new Date().toISOString(),
    passwordHash: createPasswordHash(String(body.password || ""))
  };
  state.users.push(user);
  await saveState(state);
  json(response, 201, {
    accessToken: signToken(user),
    user: sanitizeUser(user)
  });
}

async function handlePaymentInit(request, response) {
  if (!requireBearer(request, response)) return;
  const body = await readBody(request);
  const state = await loadState();
  const provider = String(body.provider || "manual").trim().toLowerCase();
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
  if (PAYMENT_WEBHOOK_SECRET) {
    const signature = request.headers["x-webhook-secret"] || "";
    if (signature !== PAYMENT_WEBHOOK_SECRET) {
      json(response, 401, { error: "invalid_webhook_secret" });
      return;
    }
  }
  const body = await readBody(request);
  const state = await loadState();
  const candidateId = String(body.paymentId || body.payment_id || body.reference || body.merchantReference || "").trim();
  const payment = state.paymentRecords.find((item) => item.id === candidateId || item.merchantReference === candidateId);
  if (!payment) {
    json(response, 404, { error: "payment_not_found", message: "Transaction introuvable pour ce webhook." });
    return;
  }
  payment.status = normalizePaymentStatus(body.status || body.payment_status || payment.status);
  payment.provider = provider || payment.provider;
  payment.providerReference = String(body.providerReference || body.provider_reference || body.transaction_id || payment.providerReference || "").trim();
  payment.paymentUrl = String(body.paymentUrl || body.payment_url || payment.paymentUrl || "").trim();
  payment.failureReason = String(body.failureReason || body.message || payment.failureReason || "").trim();
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

function applyEventToState(state, eventType, payload) {
  switch (eventType) {
    case "course.created":
    case "course.updated":
    case "course.archived":
    case "course.restored":
      if (payload.course) replaceOrInsert(state.courses, payload.course);
      return { course: payload.course };
    case "activity.created":
    case "activity.updated":
      if (payload.activity) replaceOrInsert(state.activities, payload.activity);
      return { activity: payload.activity };
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
        const merged = {
          ...payload.user,
          passwordHash: payload.user.passwordHash || createPasswordHash(payload.user.password || "ChangeMe123!")
        };
        delete merged.password;
        replaceOrInsert(state.users, merged);
        return { user: sanitizeUser(merged) };
      }
      return {};
    case "user.deleted":
      state.users = state.users.filter((user) => user.id !== payload.userId);
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
  const result = applyEventToState(state, event.type, event.payload);
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
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS"
      });
      response.end();
      return;
    }

    const pathname = getRequestPath(request);
    if (request.method === "GET" && pathname === "/health") return await handleHealth(request, response);
    if (request.method === "GET" && pathname === "/auth/me") return await handleCurrentSession(request, response);
    if (request.method === "GET" && pathname === "/lms/state") return await handleGetState(request, response);
    if (request.method === "GET" && pathname === "/lms/summary") return await handleSummary(request, response);
    if (request.method === "GET" && pathname === "/lms/events") return await handleEvents(request, response);
    if (request.method === "GET" && pathname === "/payments/status") return await handlePaymentStatus(request, response);
    if (request.method === "PUT" && pathname === "/lms/state") return await handlePutState(request, response);
    if (request.method === "POST" && pathname === "/auth/login") return await handleLogin(request, response);
    if (request.method === "POST" && pathname === "/auth/register") return await handleRegister(request, response);
    if (request.method === "POST" && pathname === "/payments/init") return await handlePaymentInit(request, response);
    if (request.method === "POST" && pathname === "/payments/confirm") return await handlePaymentConfirm(request, response);
    if (request.method === "POST" && pathname.startsWith("/payments/webhook/")) return await handlePaymentWebhook(request, response, pathname.split("/").pop());
    if (request.method === "POST" && pathname === "/lms/events") return await handleBusinessEvent(request, response);
    return notFound(response);
  } catch (error) {
    console.error(error);
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
