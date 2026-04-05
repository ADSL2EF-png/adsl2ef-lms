const STORAGE_KEY = "adsl2ef-lms-v1";

const roleLabels = { student: "Apprenant", teacher: "Enseignant", admin: "Administrateur" };
const statusLabels = { draft: "Brouillon", published: "Publié", archived: "Archivé", submitted: "Soumis", reviewed: "Corrigé", pending: "En attente", graded: "Noté" };
const DEFAULT_SUPABASE_URL = "https://cawhebskwvnnvwetmxyd.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_FsczNyLFH5y3-cCPcAkEeg_l_tGcb_a";
const DEFAULT_SUPABASE_PROJECT_REF = "cawhebskwvnnvwetmxyd";

function nowISO() { return new Date().toISOString(); }
function plusDays(days) { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString(); }
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function initials(name) {
  return (name || "").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}
function formatDate(dateString) {
  return !dateString ? "Non défini" : new Date(dateString).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const starterData = {
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
      mode: "supabase",
      apiBaseUrl: "",
      apiToken: "",
      healthPath: "/health",
      apiSnapshotPath: "/lms/state",
      authMePath: "/auth/me",
      summaryPath: "/lms/summary",
      eventsReadPath: "/lms/events",
      authLoginPath: "/auth/login",
      authRegisterPath: "/auth/register",
      paymentInitPath: "/payments/init",
      paymentStatusPath: "/payments/status",
      operationsPath: "/lms/events",
      lastRemoteSyncAt: ""
    },
    googleSheets: { enabled: false, webAppUrl: "" },
    jsonbin: { enabled: false, binId: "", apiKey: "", accessKey: "", lastSyncAt: "" },
    supabase: {
      enabled: true,
      projectRef: DEFAULT_SUPABASE_PROJECT_REF,
      url: DEFAULT_SUPABASE_URL,
      anonKey: DEFAULT_SUPABASE_PUBLISHABLE_KEY,
      storageBucket: "adsl2ef-files",
      lastSyncAt: ""
    }
  },
  users: [
    { id: crypto.randomUUID(), name: "Admin ADSL-2EF", email: "admin@adsl2ef.tg", password: "pbkdf2$915ce1deae4e61b06f0082392e95c633$859fe69b0f204c60712386d62c949c9c2c1def505f94bf1187b9380cc704b7ff", role: "admin", bio: "Supervision globale de la plateforme.", avatar: "AA", createdAt: nowISO() },
    { id: crypto.randomUUID(), name: "Afi Mensah", email: "teacher@adsl2ef.tg", password: "pbkdf2$21e8bc9160b0ec18554559b05fabec17$b301b0b650672cd29549928c5544515decb12716d98bf3ccf8e54bdcc0f39c33", role: "teacher", bio: "Enseignante de mathématiques et coordinatrice numérique.", avatar: "AM", createdAt: nowISO() },
    { id: crypto.randomUUID(), name: "Kodjo Etse", email: "student@adsl2ef.tg", password: "pbkdf2$94643f5bbd2e526f15a22c619ff9f1ac$6638dd832897a3d5c5187409b2191e584fe12eb3a993b210cb3cb6b709178951", role: "student", bio: "Élève de première scientifique.", avatar: "KE", createdAt: nowISO() }
  ],
  courses: [],
  activities: [],
  questionBank: [],
  completionRecords: [],
  certificateRecords: [],
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
    authProvider: "local",
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

bootstrapStarterContent(starterData);
let state = loadState();
if (!state.config.supabase) state.config.supabase = structuredClone(starterData.config.supabase);
if (!state.config.supabase.projectRef) state.config.supabase.projectRef = DEFAULT_SUPABASE_PROJECT_REF;
if (!state.config.supabase.url) state.config.supabase.url = DEFAULT_SUPABASE_URL;
if (!state.config.supabase.anonKey) state.config.supabase.anonKey = DEFAULT_SUPABASE_PUBLISHABLE_KEY;
const runtimeState = {
  apiStatus: "idle",
  apiMessage: "",
  lastSuccessfulApiAt: ""
};
let supabaseClient = null;

function normalizeCourseReleaseState(release) {
  return {
    modules: release?.modules && typeof release.modules === "object" ? release.modules : {},
    lessons: release?.lessons && typeof release.lessons === "object" ? release.lessons : {}
  };
}

function bootstrapStarterContent(seed) {
  const admin = seed.users.find((user) => user.role === "admin");
  const teacher = seed.users.find((user) => user.role === "teacher");
  const student = seed.users.find((user) => user.role === "student");
  const module11 = {
    id: crypto.randomUUID(),
    title: "Fonctions et variations",
    summary: "Revoir les fonctions usuelles et interpreter leurs graphes.",
    order: 1,
    lessons: [
      { id: crypto.randomUUID(), title: "Introduction aux fonctions", type: "video", duration: "18 min", content: "Identifier le domaine de definition, etudier les variations et lire les graphes.", resources: [{ id: crypto.randomUUID(), title: "Support PDF - Fonctions", type: "pdf", url: "#" }, { id: crypto.randomUUID(), title: "Fiche d'exercices", type: "link", url: "#" }] },
      { id: crypto.randomUUID(), title: "Lecture de courbes", type: "reading", duration: "14 min", content: "Analyser la croissance, la decroissance et les extremums a partir d'un graphique.", resources: [{ id: crypto.randomUUID(), title: "Exemples corriges", type: "pdf", url: "#" }] }
    ]
  };
  const module12 = {
    id: crypto.randomUUID(),
    title: "Probabilites appliquees",
    summary: "Experimenter les evenements, arbres de probabilite et calculs d'esperance.",
    order: 2,
    lessons: [{ id: crypto.randomUUID(), title: "Evenements et univers", type: "video", duration: "16 min", content: "Construire un univers d'experience et representer les evenements pour modeliser des situations concretes.", resources: [{ id: crypto.randomUUID(), title: "Mini capsule video", type: "video", url: "#" }] }]
  };
  const module21 = {
    id: crypto.randomUUID(),
    title: "Concevoir un parcours hybride",
    summary: "Structurer un cours avec objectifs, sequences et activites.",
    order: 1,
    lessons: [{ id: crypto.randomUUID(), title: "Scenario pedagogique", type: "reading", duration: "12 min", content: "Definir objectifs, progression, activites synchrones et asynchrones en gardant une vue claire sur l'evaluation.", resources: [{ id: crypto.randomUUID(), title: "Template de scenario", type: "link", url: "#" }] }]
  };
  const course1 = {
    id: crypto.randomUUID(),
    title: "Collège - Mathématiques et Sciences",
    category: "Collège",
    catalogType: "school",
    description: "Parcours structuré pour les classes du collège avec leçons progressives, exercices corrigés, quiz et devoirs.",
    image: "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=1200&q=80",
    teacherId: teacher.id,
    status: "published",
    audience: "Collège",
    duration: "Accès trimestriel",
    price: 15000,
    pricingLabel: "par trimestre",
    salesTag: "Best-seller",
    sellingPoints: ["Vidéos pédagogiques", "PDF téléchargeables", "Quiz et devoirs", "Suivi de progression"],
    createdAt: nowISO(),
    modules: [module11, module12],
    enrolledUserIds: [student.id]
  };
  const course2 = {
    id: crypto.randomUUID(),
    title: "Formation Pro - Enseignants",
    category: "Formation Pro",
    catalogType: "pro",
    description: "Programme de professionnalisation pour enseignants : pédagogie active, numérique éducatif, évaluation et suivi des apprenants.",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    teacherId: teacher.id,
    status: "published",
    audience: "Enseignants",
    duration: "6 semaines",
    price: 45000,
    pricingLabel: "par cohorte",
    salesTag: "Certifiant",
    sellingPoints: ["Pédagogie active", "Cas pratiques", "Suivi des cohortes", "Attestation finale"],
    createdAt: nowISO(),
    modules: [module21],
    enrolledUserIds: []
  };
  const course3 = {
    id: crypto.randomUUID(),
    title: "Lycée Moderne - Séries A, C, D",
    category: "Lycée Moderne",
    catalogType: "school",
    description: "Offre dédiée au lycée moderne avec cours par série, préparation aux évaluations, ressources PDF et entraînements réglés.",
    image: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80",
    teacherId: teacher.id,
    status: "published",
    audience: "Lycée moderne",
    duration: "Accès trimestriel",
    price: 18000,
    pricingLabel: "par trimestre",
    salesTag: "Examen",
    sellingPoints: ["Cours par série", "Séries d'exercices", "Préparation BAC", "Sessions d'accompagnement"],
    createdAt: nowISO(),
    modules: [
      {
        id: crypto.randomUUID(),
        title: "Français, mathématiques et sciences",
        summary: "Organisation par discipline et par séquence de travail.",
        order: 1,
        lessons: [
          { id: crypto.randomUUID(), title: "Méthodologie de préparation BAC", type: "video", duration: "20 min", content: "Organiser les révisions, traiter les annales et renforcer les automatismes disciplinaires.", resources: [{ id: crypto.randomUUID(), title: "Série BAC", type: "pdf", url: "#" }] }
        ]
      }
    ],
    enrolledUserIds: []
  };
  const course4 = {
    id: crypto.randomUUID(),
    title: "Formation Pro - Directeurs d'école",
    category: "Formation Pro",
    catalogType: "pro",
    description: "Programme de renforcement pour directeurs et promoteurs d'établissement : gouvernance, management, qualité et pilotage scolaire.",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
    teacherId: teacher.id,
    status: "published",
    audience: "Directeurs et promoteurs",
    duration: "8 semaines",
    price: 60000,
    pricingLabel: "programme complet",
    salesTag: "Premium",
    sellingPoints: ["Coaching collectif", "Kits de gouvernance", "Outils de suivi", "Projet final"],
    createdAt: nowISO(),
    modules: [
      {
        id: crypto.randomUUID(),
        title: "Vision et gouvernance",
        summary: "Structurer une direction orientee qualite et resultats.",
        order: 1,
        lessons: [
          { id: crypto.randomUUID(), title: "Diagnostic d'etablissement", type: "reading", duration: "15 min", content: "Evaluer les points forts, les risques et les priorites d'amelioration.", resources: [{ id: crypto.randomUUID(), title: "Matrice de diagnostic", type: "link", url: "#" }] }
        ]
      }
    ],
    enrolledUserIds: []
  };
  const course5 = {
    id: crypto.randomUUID(),
    title: "Enseignement Technique - Filières industrielles et tertiaires",
    category: "Technique",
    catalogType: "school",
    description: "Parcours pour l'enseignement technique avec contenus applicatifs, supports de travaux pratiques et évaluations ciblées.",
    image: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1200&q=80",
    teacherId: teacher.id,
    status: "published",
    audience: "Lycée technique",
    duration: "Accès trimestriel",
    price: 20000,
    pricingLabel: "par trimestre",
    salesTag: "Technique",
    sellingPoints: ["Cours applicatifs", "Fiches TP", "Évaluations ciblées", "Supports numériques"],
    createdAt: nowISO(),
    modules: [
      {
        id: crypto.randomUUID(),
        title: "Bases techniques et applications",
        summary: "Approche par compétence avec démonstrations et exercices.",
        order: 1,
        lessons: [
          { id: crypto.randomUUID(), title: "Organisation du parcours technique", type: "reading", duration: "15 min", content: "Présenter les compétences visées, les activités pratiques et les critères d'évaluation.", resources: [{ id: crypto.randomUUID(), title: "Guide de progression", type: "pdf", url: "#" }] }
        ]
      }
    ],
    enrolledUserIds: []
  };
  const course6 = {
    id: crypto.randomUUID(),
    title: "École pour Adultes - Candidats libres BAC et BEPC",
    category: "Adultes",
    catalogType: "school",
    description: "Un parcours flexible pour adultes préparant le BEPC ou le BAC en candidature libre, avec soutien méthodologique et suivi motivant.",
    image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
    teacherId: teacher.id,
    status: "published",
    audience: "Adultes candidats libres",
    duration: "Accès trimestriel",
    price: 22000,
    pricingLabel: "par trimestre",
    salesTag: "Reprise d'études",
    sellingPoints: ["Horaires flexibles", "Programme ciblé examen", "Accompagnement méthodologique", "Soutien motivant"],
    createdAt: nowISO(),
    modules: [
      {
        id: crypto.randomUUID(),
        title: "Reprise des fondamentaux",
        summary: "Remobiliser les acquis et construire un plan de progression réaliste.",
        order: 1,
        lessons: [
          { id: crypto.randomUUID(), title: "Organisation personnelle et révision", type: "video", duration: "17 min", content: "Mettre en place une stratégie de travail adaptée à un public adulte en reprise d'études.", resources: [{ id: crypto.randomUUID(), title: "Planning de révision", type: "link", url: "#" }] }
        ]
      }
    ],
    enrolledUserIds: []
  };
  const quiz1 = {
    id: crypto.randomUUID(),
    courseId: course1.id,
    moduleId: module11.id,
    lessonId: module11.lessons[0].id,
    title: "Quiz - Fonctions",
    type: "quiz",
    description: "Quiz de verification rapide sur les fonctions.",
    dueDate: plusDays(3),
    createdBy: teacher.id,
    timeLimitMinutes: 20,
    attemptsAllowed: 2,
    passingScore: 60,
    questions: [
      { id: crypto.randomUUID(), prompt: "Une fonction croissante signifie que :", kind: "mcq", options: ["les images diminuent quand x augmente", "les images augmentent quand x augmente", "le domaine est vide"], answer: "les images augmentent quand x augmente", points: 5 },
      { id: crypto.randomUUID(), prompt: "Quel outil permet de synthetiser les variations d'une fonction ?", kind: "mcq", options: ["un tableau de variations", "une facture", "un planning"], answer: "un tableau de variations", points: 5 },
      { id: crypto.randomUUID(), prompt: "Expliquez en quelques lignes comment on lit le sens de variation d'une fonction sur un graphique.", kind: "open", answer: "", points: 10 }
    ]
  };
  const assignment1 = {
    id: crypto.randomUUID(),
    courseId: course1.id,
    moduleId: module12.id,
    lessonId: module12.lessons[0].id,
    title: "Devoir - Probabilites",
    type: "assignment",
    description: "Resoudre les 4 exercices et soumettre votre synthese.",
    dueDate: plusDays(5),
    createdBy: teacher.id,
    maxPoints: 20
  };
  const assignment2 = {
    id: crypto.randomUUID(),
    courseId: course2.id,
    moduleId: module21.id,
    lessonId: module21.lessons[0].id,
    title: "Etude de cas - Parcours hybride",
    type: "assignment",
    description: "Concevoir un mini parcours numérique avec une évaluation formative.",
    dueDate: plusDays(7),
    createdBy: teacher.id,
    maxPoints: 20
  };
  seed.courses.push(course1, course2, course3, course4, course5, course6);
  seed.activities.push(quiz1, assignment1, assignment2);
  seed.questionBank.push(
    { id: crypto.randomUUID(), courseId: course1.id, prompt: "Une fonction décroissante signifie que :", kind: "mcq", options: ["les images diminuent quand x augmente", "les images augmentent quand x augmente", "les images sont toujours nulles"], answer: "les images diminuent quand x augmente", points: 5, createdBy: teacher.id, createdAt: nowISO() },
    { id: crypto.randomUUID(), courseId: course1.id, prompt: "Le tableau de variations permet de résumer le comportement d'une fonction.", kind: "truefalse", options: ["Vrai", "Faux"], answer: "Vrai", points: 3, createdBy: teacher.id, createdAt: nowISO() },
    { id: crypto.randomUUID(), courseId: course2.id, prompt: "Citez une étape indispensable pour structurer un parcours hybride.", kind: "short", options: [], answer: "définir les objectifs", points: 5, createdBy: teacher.id, createdAt: nowISO() }
  );
  seed.submissions.push(
    { id: crypto.randomUUID(), activityId: quiz1.id, userId: student.id, status: "graded", score: 10, maxPoints: 10, answers: [{ questionId: quiz1.questions[0].id, value: quiz1.questions[0].answer }, { questionId: quiz1.questions[1].id, value: quiz1.questions[1].answer }], feedback: "Excellent demarrage.", submittedAt: nowISO(), reviewedAt: nowISO() },
    { id: crypto.randomUUID(), activityId: assignment1.id, userId: student.id, status: "submitted", score: null, maxPoints: 20, text: "J'ai resolu les exercices 1 a 4 et detaille les arbres de probabilites.", submittedAt: nowISO() }
  );
  seed.notifications.push(
    { id: crypto.randomUUID(), userId: student.id, title: "Nouveau devoir disponible", message: "Le devoir Probabilites doit etre remis dans 5 jours.", level: "warning", read: false, createdAt: nowISO() },
    { id: crypto.randomUUID(), userId: teacher.id, title: "Soumission a corriger", message: "Une copie attend votre correction dans le cours Mathematiques Premiere C.", level: "primary", read: false, createdAt: nowISO() }
  );
  seed.announcements.push(
    { id: crypto.randomUUID(), courseId: course1.id, title: "Bienvenue dans l'École Numérique", body: "Consultez les leçons de démarrage, réalisez le quiz d'entrée et téléchargez les supports PDF.", createdAt: nowISO(), authorId: teacher.id },
    { id: crypto.randomUUID(), courseId: course2.id, title: "Ouverture de la cohorte Formation Pro", body: "Les participants peuvent commencer le module d'introduction et déposer leurs travaux dans l'espace devoirs.", createdAt: nowISO(), authorId: teacher.id }
  );
  seed.messages.push(
    { id: crypto.randomUUID(), fromUserId: teacher.id, toUserId: student.id, subject: "Suivi pédagogique", content: "Pensez à terminer le devoir de probabilités avant la date limite.", createdAt: nowISO(), read: false },
    { id: crypto.randomUUID(), fromUserId: admin.id, toUserId: teacher.id, subject: "Publication catalogue", content: "Le catalogue Formation Pro a été mis à jour. Merci de vérifier les contenus.", createdAt: nowISO(), read: false }
  );
  seed.forumThreads.push(
    { id: crypto.randomUUID(), courseId: course1.id, title: "Présentation des apprenants", createdBy: student.id, createdAt: nowISO(), posts: [{ id: crypto.randomUUID(), authorId: student.id, content: "Bonjour à tous, heureux de rejoindre la plateforme.", createdAt: nowISO() }] }
  );
  seed.attendanceSessions.push(
    {
      id: crypto.randomUUID(),
      courseId: course1.id,
      title: "Classe virtuelle de lancement",
      sessionDate: plusDays(1),
      createdBy: teacher.id,
      records: [
        { userId: student.id, status: "present", note: "Présent à l'heure." }
      ]
    }
  );
  seed.activityLog.push(
    { id: crypto.randomUUID(), userId: student.id, label: "Quiz reussi - Fonctions", createdAt: nowISO() },
    { id: crypto.randomUUID(), userId: teacher.id, label: "Cours publie - Pedagogie numerique", createdAt: nowISO() }
  );
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(starterData));
    return applyEnvironmentPersistenceDefaults(structuredClone(starterData));
  }
  try {
    return applyEnvironmentPersistenceDefaults(migrateState(JSON.parse(raw)));
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(starterData));
    return applyEnvironmentPersistenceDefaults(structuredClone(starterData));
  }
}

function getEnvironmentPersistenceDefaults() {
  const hostname = window.location.hostname || "";
  const isLocalHost = ["localhost", "127.0.0.1"].includes(hostname);
  const isFileMode = window.location.protocol === "file:";
  if (!isLocalHost && !isFileMode) return null;
  return {
    mode: "supabase",
    apiBaseUrl: "http://localhost:3000",
    healthPath: "/health",
    apiSnapshotPath: "/lms/state",
    authMePath: "/auth/me",
    summaryPath: "/lms/summary",
    eventsReadPath: "/lms/events",
    authLoginPath: "/auth/login",
    authRegisterPath: "/auth/register",
    paymentInitPath: "/payments/init",
    paymentStatusPath: "/payments/status",
    operationsPath: "/lms/events"
  };
}

function applyEnvironmentPersistenceDefaults(nextState) {
  const overrides = getEnvironmentPersistenceDefaults();
  if (!overrides) return nextState;
  const currentPersistence = nextState.config?.persistence || {};
  const shouldAutoApply = !currentPersistence.apiBaseUrl && (!currentPersistence.mode || currentPersistence.mode === "local");
  if (!shouldAutoApply) return nextState;
  nextState.config.persistence = {
    ...currentPersistence,
    ...overrides
  };
  return nextState;
}

function migrateState(parsed) {
  const next = {
    ...structuredClone(starterData),
    ...parsed,
    config: {
      ...structuredClone(starterData).config,
      ...(parsed.config || {}),
      site: {
        ...structuredClone(starterData).config.site,
        ...(parsed.config?.site || {})
      },
      payments: {
        ...structuredClone(starterData).config.payments,
        ...(parsed.config?.payments || {})
      },
      persistence: {
        ...structuredClone(starterData).config.persistence,
        ...(parsed.config?.persistence || {})
      },
      googleSheets: {
        ...structuredClone(starterData).config.googleSheets,
        ...(parsed.config?.googleSheets || {})
      },
      jsonbin: {
        ...structuredClone(starterData).config.jsonbin,
        ...(parsed.config?.jsonbin || {})
      },
      supabase: {
        ...structuredClone(starterData).config.supabase,
        ...(parsed.config?.supabase || {})
      }
    }
  };
  next.session = {
    ...structuredClone(starterData).session,
    ...(parsed.session || {})
  };
  next.courses = (parsed.courses || []).map((course) => ({
    catalogType: course.category === "Formation Pro" ? "pro" : "school",
    price: course.category === "Formation Pro" ? 45000 : 15000,
    pricingLabel: course.category === "Formation Pro" ? "par cohorte" : "par trimestre",
    salesTag: course.category === "Formation Pro" ? "Certifiant" : "Best-seller",
    sellingPoints: course.category === "Formation Pro"
      ? ["Templates pedagogiques", "Cas pratiques", "Suivi des cohortes", "Attestation finale"]
      : ["Videos HD", "PDF telechargeables", "Quiz et devoirs", "Suivi de progression"],
    release: normalizeCourseReleaseState(course.release),
    ...course
  }));
  next.announcements = parsed.announcements || [];
  next.messages = parsed.messages || [];
  next.forumThreads = parsed.forumThreads || [];
  next.attendanceSessions = parsed.attendanceSessions || [];
  next.questionBank = parsed.questionBank || [];
  next.completionRecords = parsed.completionRecords || [];
  next.certificateRecords = parsed.certificateRecords || [];
  next.paymentRecords = parsed.paymentRecords || [];
  return next;
}

function persistState(nextState = state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState)); }
function getPersistenceConfig() {
  return {
    ...structuredClone(starterData).config.persistence,
    ...(state.config?.persistence || {})
  };
}

function shouldUseApiPersistence() {
  const persistence = getPersistenceConfig();
  return persistence.mode === "api" && Boolean(normalizeApiBaseUrl(persistence.apiBaseUrl));
}
function shouldUseSupabasePersistence() {
  const supabase = state.config?.supabase || structuredClone(starterData).config.supabase;
  const persistence = getPersistenceConfig();
  return persistence.mode === "supabase" && Boolean(supabase.enabled && supabase.url && supabase.anonKey);
}

function setApiStatus(status, message = "") {
  runtimeState.apiStatus = status;
  runtimeState.apiMessage = message;
  if (status === "success") runtimeState.lastSuccessfulApiAt = nowISO();
  if (document.getElementById("topbar-actions")) renderTopbar();
}

function formatApiErrorMessage(action) {
  if (!shouldUseApiPersistence()) return "";
  return `${action} impossible côté serveur. ${runtimeState.apiMessage || "Vérifiez la configuration du backend."}`;
}

function renderApiStatusBadge() {
  if (!shouldUseApiPersistence()) return "";
  const map = {
    idle: { className: "badge", label: "Backend prêt" },
    syncing: { className: "badge warning", label: "Synchronisation..." },
    success: { className: "badge success", label: "Backend connecté" },
    error: { className: "badge danger", label: "Backend indisponible" }
  };
  const current = map[runtimeState.apiStatus] || map.idle;
  const details = runtimeState.apiMessage || (runtimeState.lastSuccessfulApiAt ? `Dernier échange : ${formatDate(runtimeState.lastSuccessfulApiAt)}` : "API configurée");
  return `<span class="${current.className}" title="${escapeHtml(details)}">${current.label}</span>`;
}

function normalizeApiBaseUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function buildApiUrl(baseUrl, path) {
  const normalizedBase = normalizeApiBaseUrl(baseUrl);
  const normalizedPath = String(path || "/").trim() || "/";
  if (!normalizedBase) return "";
  return `${normalizedBase}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`;
}
function getSupabaseConfig() {
  return {
    ...structuredClone(starterData).config.supabase,
    ...(state.config?.supabase || {})
  };
}
function getSupabaseClient() {
  if (!shouldUseSupabasePersistence()) return null;
  const cfg = getSupabaseConfig();
  if (!window.supabase?.createClient) return null;
  if (!supabaseClient || supabaseClient.__url !== cfg.url || supabaseClient.__key !== cfg.anonKey) {
    supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);
    supabaseClient.__url = cfg.url;
    supabaseClient.__key = cfg.anonKey;
  }
  return supabaseClient;
}
function sanitizeStorageFileName(name) {
  return String(name || "document")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "document";
}
async function uploadAssignmentFileToSupabase(file, activity, user) {
  const client = getSupabaseClient();
  const cfg = getSupabaseConfig();
  if (!client || !file) return { fileName: "", fileUrl: "", storagePath: "" };
  const safeName = sanitizeStorageFileName(file.name);
  const storagePath = `assignments/${activity.courseId}/${activity.id}/${user.id}-${Date.now()}-${safeName}`;
  const { error } = await client.storage.from(cfg.storageBucket).upload(storagePath, file, {
    upsert: true,
    contentType: file.type || "application/octet-stream"
  });
  if (error) throw error;
  const { data } = client.storage.from(cfg.storageBucket).getPublicUrl(storagePath);
  return {
    fileName: file.name,
    fileUrl: data?.publicUrl || "",
    storagePath
  };
}
async function supabaseUpsert(table, rows, onConflict = "id") {
  const client = getSupabaseClient();
  if (!client || !shouldUseSupabasePersistence()) return;
  const payload = Array.isArray(rows) ? rows.filter(Boolean) : [rows].filter(Boolean);
  if (!payload.length) return;
  const { error } = await client.from(table).upsert(payload, { onConflict });
  if (error) throw error;
}
async function supabaseDelete(table, filters = {}) {
  const client = getSupabaseClient();
  if (!client || !shouldUseSupabasePersistence()) return;
  let query = client.from(table).delete();
  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  const { error } = await query;
  if (error) throw error;
}

function getApiHeaders() {
  const persistence = getPersistenceConfig();
  const headers = { "Content-Type": "application/json" };
  const bearerToken = state.session?.accessToken || persistence.apiToken;
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
  return headers;
}

async function apiRequest(path, options = {}) {
  const persistence = getPersistenceConfig();
  try {
    setApiStatus("syncing", `Appel API ${options.method || "GET"} ${path}`);
    const response = await fetch(buildApiUrl(persistence.apiBaseUrl, path), {
      method: options.method || "GET",
      headers: {
        ...getApiHeaders(),
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    if (!response.ok) {
      setApiStatus("error", `Erreur API ${response.status} sur ${path}`);
      throw new Error(`API request failed: ${response.status}`);
    }
    setApiStatus("success", `Réponse API reçue pour ${path}`);
    if (response.status === 204) return null;
    return response.json();
  } catch (error) {
    if (runtimeState.apiStatus !== "error") {
      setApiStatus("error", `Connexion impossible à l'API pour ${path}`);
    }
    throw error;
  }
}

function normalizeRemoteUser(payload) {
  if (!payload || typeof payload !== "object") return null;
  const source = payload.user || payload.account || payload.profile || payload;
  if (!source?.email) return null;
  return {
    id: source.id || crypto.randomUUID(),
    name: source.name || source.fullName || source.displayName || source.email,
    email: String(source.email).trim().toLowerCase(),
    password: source.password || "",
    role: source.role || "student",
    bio: source.bio || "",
    avatar: source.avatar || initials(source.name || source.email),
    createdAt: source.createdAt || nowISO()
  };
}

function upsertUserLocally(user) {
  const existing = state.users.find((item) => item.id === user.id || item.email.toLowerCase() === user.email.toLowerCase());
  if (existing) {
    Object.assign(existing, user, { avatar: user.avatar || initials(user.name) });
    return existing;
  }
  state.users.push(user);
  return user;
}

function applyApiSession(user, payload, provider = "api") {
  const savedUser = upsertUserLocally(user);
  state.currentUserId = savedUser.id;
  state.session = {
    accessToken: payload?.accessToken || payload?.token || payload?.jwt || "",
    authProvider: provider,
    lastAuthAt: nowISO()
  };
  return savedUser;
}

async function loginWithApi(email, password) {
  const persistence = getPersistenceConfig();
  const payload = await apiRequest(persistence.authLoginPath, {
    method: "POST",
    body: { email, password }
  });
  const user = normalizeRemoteUser(payload);
  if (!user) throw new Error("missing user payload");
  return applyApiSession(user, payload, "api");
}

async function registerWithApi({ name, email, password, role }) {
  const persistence = getPersistenceConfig();
  const payload = await apiRequest(persistence.authRegisterPath, {
    method: "POST",
    body: { name, email, password, role }
  });
  const user = normalizeRemoteUser(payload);
  if (!user) throw new Error("missing user payload");
  return applyApiSession(user, payload, "api");
}

async function restoreSessionWithApi() {
  const persistence = getPersistenceConfig();
  if (!state.session?.accessToken) return false;
  const payload = await apiRequest(persistence.authMePath, { method: "GET" });
  const user = normalizeRemoteUser(payload);
  if (!user) throw new Error("missing current user payload");
  applyApiSession(user, { ...payload, accessToken: state.session.accessToken }, "api");
  return true;
}

async function initializePaymentWithApi({ provider, course, user }) {
  const persistence = getPersistenceConfig();
  return apiRequest(persistence.paymentInitPath, {
    method: "POST",
    body: {
      provider,
      courseId: course.id,
      userId: user.id,
      amount: course.price,
      headline: course.title
    }
  });
}

function normalizePaymentStatus(status) {
  const value = String(status || "pending").trim().toLowerCase();
  if (["approved", "paid", "success", "successful", "completed", "complete", "validated"].includes(value)) return "approved";
  if (["failed", "error", "declined", "rejected"].includes(value)) return "failed";
  if (["cancelled", "canceled", "expired", "timeout"].includes(value)) return "cancelled";
  if (["processing", "initiated", "created"].includes(value)) return "processing";
  return "pending";
}

function paymentStatusLabel(status) {
  const value = normalizePaymentStatus(status);
  if (value === "approved") return "Paiement confirmé";
  if (value === "failed") return "Paiement échoué";
  if (value === "cancelled") return "Paiement annulé";
  if (value === "processing") return "Paiement en cours";
  return "Paiement en attente";
}

function paymentProviderLabel(provider) {
  const value = String(provider || "").trim().toLowerCase();
  if (value === "mixx") return "Mixx by Yas";
  if (value === "flooz") return "Flooz";
  return "Paiement";
}

function upsertPaymentRecord(record) {
  if (!record?.id) return null;
  const normalized = {
    id: record.id,
    provider: String(record.provider || "manual").trim().toLowerCase(),
    courseId: record.courseId || "",
    userId: record.userId || "",
    amount: Number(record.amount || 0),
    currency: record.currency || "XOF",
    status: normalizePaymentStatus(record.status),
    merchantReference: record.merchantReference || record.reference || "",
    providerReference: record.providerReference || "",
    paymentUrl: record.paymentUrl || "",
    failureReason: record.failureReason || "",
    createdAt: record.createdAt || nowISO(),
    updatedAt: record.updatedAt || nowISO(),
    confirmedAt: record.confirmedAt || ""
  };
  const index = state.paymentRecords.findIndex((payment) => payment.id === normalized.id);
  if (index >= 0) {
    state.paymentRecords[index] = { ...state.paymentRecords[index], ...normalized };
  } else {
    state.paymentRecords.unshift(normalized);
  }
  return state.paymentRecords.find((payment) => payment.id === normalized.id) || normalized;
}

async function getPaymentStatusFromApi(paymentId) {
  const persistence = getPersistenceConfig();
  const path = `${persistence.paymentStatusPath || "/payments/status"}?paymentId=${encodeURIComponent(paymentId)}`;
  return apiRequest(path, { method: "GET" });
}

async function finalizeApprovedPayment(paymentRecord) {
  const course = getCourseById(paymentRecord.courseId);
  const user = getUserById(paymentRecord.userId);
  if (!course || !user) return;
  if (!course.enrolledUserIds.includes(user.id)) {
    await enrollUser(course.id, user.id);
  }
  addNotification({
    userId: user.id,
    title: "Paiement confirmé",
    message: `Votre paiement ${paymentProviderLabel(paymentRecord.provider)} pour ${course.title} a été confirmé.`,
    level: "success"
  });
}

async function checkPaymentStatus(paymentId) {
  const current = getPaymentRecordById(paymentId);
  if (!current) return;
  try {
    const remote = await getPaymentStatusFromApi(paymentId);
    const payment = upsertPaymentRecord({
      ...current,
      ...remote,
      id: remote.paymentId || remote.id || paymentId,
      courseId: remote.courseId || current.courseId,
      userId: remote.userId || current.userId,
      updatedAt: remote.updatedAt || nowISO()
    });
    saveState();
    if (payment.status === "approved") {
      await finalizeApprovedPayment(payment);
      openModal(`
        <h2>Paiement confirmé</h2>
        <p class="section-subtitle">Votre transaction ${escapeHtml(paymentProviderLabel(payment.provider))} a été validée. Le cours est maintenant accessible dans votre espace.</p>
        <div class="toolbar" style="margin-top:18px">
          <button class="btn-primary" onclick="closeModal(); openCourse('${payment.courseId}')">Accéder au cours</button>
        </div>
      `);
      return;
    }
    openModal(`
      <h2>${escapeHtml(paymentStatusLabel(payment.status))}</h2>
      <p class="section-subtitle">${escapeHtml(payment.failureReason || "Le paiement n'est pas encore validé. Vous pouvez réessayer la vérification ou reprendre le parcours de paiement.")}</p>
      <div class="toolbar" style="margin-top:18px">
        <button class="btn-primary" onclick="checkPaymentStatus('${payment.id}')">Actualiser le statut</button>
        ${payment.paymentUrl ? `<a class="btn-ghost" href="${escapeHtml(payment.paymentUrl)}" target="_blank" rel="noreferrer">Reprendre le paiement</a>` : ""}
      </div>
    `);
  } catch (error) {
    openModal(`
      <h2>Vérification indisponible</h2>
      <p class="section-subtitle">${escapeHtml(formatApiErrorMessage("La vérification du paiement"))}</p>
    `);
  }
}

async function testSupabaseConnection() {
  const client = getSupabaseClient();
  const cfg = getSupabaseConfig();
  if (!client) {
    openModal(`
      <h2>Supabase non configuré</h2>
      <p class="section-subtitle">Renseignez l'URL Supabase, la clé anonyme et activez le mode Supabase dans les paramètres du site.</p>
    `);
    return;
  }
  try {
    const response = await fetch(`${cfg.url}/auth/v1/settings`, {
      method: "GET",
      headers: {
        apikey: cfg.anonKey
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    setApiStatus("success", "Connexion Supabase active");
    openModal(`
      <h2>Supabase accessible</h2>
      <p class="section-subtitle">${sessionData?.session?.user ? "La connexion Supabase répond correctement et une session utilisateur est disponible." : "La connexion Supabase répond correctement. Vous pouvez continuer la bascule du LMS et ouvrir une session Supabase pour les opérations sécurisées."}</p>
    `);
  } catch (error) {
    setApiStatus("error", `Supabase indisponible : ${error.message || "erreur inconnue"}`);
    openModal(`
      <h2>Supabase indisponible</h2>
      <p class="section-subtitle">${escapeHtml(error.message || "Impossible de joindre Supabase avec la configuration actuelle.")}</p>
    `);
  }
}

async function loginWithSupabase(email, password) {
  const client = getSupabaseClient();
  if (!client) throw new Error("supabase client unavailable");
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const authUser = data.user;
  if (authUser && data.session?.access_token) {
    await ensureSupabaseProfileRecord(authUser, {
      full_name: authUser.user_metadata?.full_name || authUser.email,
      email: authUser.email,
      role: authUser.user_metadata?.role || "student"
    });
  }
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();
  if (profileError) throw profileError;
  const user = normalizeRemoteUser({
    id: profile?.id || authUser.id,
    email: authUser.email,
    name: profile?.full_name || authUser.user_metadata?.full_name || authUser.email,
    role: profile?.role || authUser.user_metadata?.role || "student",
    bio: profile?.bio || "",
    avatar: profile?.avatar || initials(profile?.full_name || authUser.email),
    createdAt: profile?.created_at || authUser.created_at,
    accessToken: data.session?.access_token
  });
  return applyApiSession(user, { accessToken: data.session?.access_token }, "supabase");
}

async function registerWithSupabase({ name, email, password, role }) {
  const client = getSupabaseClient();
  if (!client) throw new Error("supabase client unavailable");
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        role
      }
    }
  });
  if (error) throw error;
  const authUser = data.user;
  if (authUser && data.session?.access_token) {
    await ensureSupabaseProfileRecord(authUser, {
      full_name: name,
      email,
      role
    });
  }
  if (!data.session?.access_token) {
    return {
      pendingConfirmation: true,
      email,
      name
    };
  }
  const localUser = {
    id: authUser?.id || crypto.randomUUID(),
    email,
    name,
    role,
    bio: "Compte Supabase en cours d'activation.",
    avatar: initials(name),
    createdAt: authUser?.created_at || nowISO(),
    accessToken: data.session?.access_token || ""
  };
  return applyApiSession(normalizeRemoteUser(localUser), { accessToken: data.session?.access_token || "" }, "supabase");
}

async function restoreSessionWithSupabase() {
  const client = getSupabaseClient();
  if (!client) return false;
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.user) return false;
  const authUser = data.session.user;
  await ensureSupabaseProfileRecord(authUser, {
    full_name: authUser.user_metadata?.full_name || authUser.email,
    email: authUser.email,
    role: authUser.user_metadata?.role || "student"
  });
  const { data: profile } = await client
    .from("profiles")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();
  const user = normalizeRemoteUser({
    id: profile?.id || authUser.id,
    email: authUser.email,
    name: profile?.full_name || authUser.user_metadata?.full_name || authUser.email,
    role: profile?.role || authUser.user_metadata?.role || "student",
    bio: profile?.bio || "",
    avatar: profile?.avatar || initials(profile?.full_name || authUser.email),
    createdAt: profile?.created_at || authUser.created_at,
    accessToken: data.session.access_token
  });
  applyApiSession(user, { accessToken: data.session.access_token }, "supabase");
  return true;
}

async function ensureSupabaseProfileRecord(authUser, profileInput = {}) {
  const client = getSupabaseClient();
  if (!client || !authUser?.id || !authUser?.email) return null;
  const payload = {
    auth_user_id: authUser.id,
    full_name: profileInput.full_name || authUser.user_metadata?.full_name || authUser.email,
    email: String(profileInput.email || authUser.email).trim().toLowerCase(),
    role: isRoleAllowedForPublicRegistration(profileInput.role) ? profileInput.role : "student",
    bio: profileInput.bio || "",
    avatar: profileInput.avatar || initials(profileInput.full_name || authUser.user_metadata?.full_name || authUser.email)
  };
  const { data, error } = await client
    .from("profiles")
    .upsert(payload, { onConflict: "auth_user_id" })
    .select()
    .maybeSingle();
  if (error) {
    console.warn("Supabase profile ensure ignored:", error);
    return null;
  }
  return data;
}

function mapCourseToSupabaseRow(course) {
  return {
    id: course.id,
    title: course.title,
    category: course.category,
    catalog_type: course.catalogType || "school",
    description: course.description || "",
    image_url: course.image || "",
    teacher_profile_id: course.teacherId || null,
    status: course.status || "draft",
    audience: course.audience || "",
    duration_label: course.duration || "",
    price: Number(course.price || 0),
    pricing_label: course.pricingLabel || "",
    sales_tag: course.salesTag || "",
    selling_points: course.sellingPoints || [],
    release: normalizeCourseReleaseState(course.release),
    created_at: course.createdAt || nowISO(),
    updated_at: nowISO()
  };
}

function mapModuleToSupabaseRow(courseId, module, index = 0) {
  return {
    id: module.id,
    course_id: courseId,
    title: module.title,
    summary: module.summary || "",
    position: Number(module.order || index + 1),
    created_at: module.createdAt || nowISO()
  };
}

function mapLessonToSupabaseRow(moduleId, lesson, index = 0) {
  return {
    id: lesson.id,
    module_id: moduleId,
    title: lesson.title,
    lesson_type: lesson.type || "reading",
    duration_label: lesson.duration || "",
    content: lesson.content || "",
    position: Number(lesson.order || index + 1),
    created_at: lesson.createdAt || nowISO()
  };
}

function mapLessonResourcesToSupabaseRows(lesson) {
  return (lesson.resources || []).map((resource) => ({
    id: resource.id,
    lesson_id: lesson.id,
    title: resource.title,
    resource_type: resource.type || "link",
    url: resource.url || "",
    created_at: resource.createdAt || nowISO()
  }));
}

function mapActivityToSupabaseRow(activity) {
  return {
    id: activity.id,
    course_id: activity.courseId,
    module_id: activity.moduleId || null,
    lesson_id: activity.lessonId || null,
    activity_type: activity.type,
    title: activity.title,
    description: activity.description || "",
    due_at: activity.dueDate || null,
    time_limit_minutes: activity.timeLimitMinutes || null,
    attempts_allowed: Number(activity.attemptsAllowed || 1),
    passing_score: Number(activity.passingScore || 50),
    max_points: Number(activity.maxPoints || 20),
    weight: Number(activity.weight || 1),
    status: activity.status || "published",
    created_by: activity.createdBy || null,
    created_at: activity.createdAt || nowISO(),
    updated_at: nowISO()
  };
}

function buildSupabaseProfileRows() {
  return state.users.map((user) => ({
    id: user.id,
    full_name: user.name,
    email: user.email,
    role: user.role,
    bio: user.bio || "",
    avatar: user.avatar || initials(user.name),
    created_at: user.createdAt || nowISO(),
    updated_at: nowISO()
  }));
}

function buildSupabaseCourseRows() {
  return state.courses.map(mapCourseToSupabaseRow);
}

function buildSupabaseModuleRows() {
  return state.courses.flatMap((course) => course.modules.map((module, index) => mapModuleToSupabaseRow(course.id, module, index)));
}

function buildSupabaseLessonRows() {
  return state.courses.flatMap((course) => course.modules.flatMap((module) => (module.lessons || []).map((lesson, index) => mapLessonToSupabaseRow(module.id, lesson, index))));
}

function buildSupabaseResourceRows() {
  return state.courses.flatMap((course) => course.modules.flatMap((module) => (module.lessons || []).flatMap((lesson) => mapLessonResourcesToSupabaseRows(lesson))));
}

function buildSupabaseEnrollmentRows() {
  return state.courses.flatMap((course) => (course.enrolledUserIds || []).map((userId) => ({
    course_id: course.id,
    profile_id: userId,
    status: "active",
    enrolled_at: nowISO()
  })));
}

function buildSupabaseActivityRows() {
  return state.activities.map(mapActivityToSupabaseRow);
}

function buildSupabaseSubmissionRows() {
  return state.submissions.map((submission) => ({
    id: submission.id,
    activity_id: submission.activityId,
    profile_id: submission.userId,
    status: submission.status || "submitted",
    score: typeof submission.score === "number" ? submission.score : null,
    max_points: Number(submission.maxPoints || 0) || null,
    text_answer: submission.text || "",
    file_name: submission.fileName || "",
    file_url: submission.fileUrl || "",
    answers: submission.answers || [],
    feedback: submission.feedback || "",
    submitted_at: submission.submittedAt || nowISO(),
    reviewed_at: submission.reviewedAt || null
  }));
}

function buildSupabaseCompletionRows() {
  return state.completionRecords.map((record) => ({
    id: record.id,
    course_id: record.courseId,
    module_id: record.moduleId || null,
    lesson_id: record.lessonId || null,
    profile_id: record.userId,
    completed_at: record.completedAt || nowISO()
  }));
}
function buildSupabaseCertificateRows() {
  return state.certificateRecords.map((record) => ({
    id: record.id,
    course_id: record.courseId,
    profile_id: record.userId,
    issued_at: record.issuedAt || nowISO(),
    progress_percent: Number(record.progress || 0),
    average_percent: typeof record.average === "number" ? Number(record.average) : null
  }));
}
function buildSupabaseNotificationRows() {
  return state.notifications.map((notification) => ({
    id: notification.id,
    profile_id: notification.userId,
    title: notification.title,
    message: notification.message,
    level: notification.level || "primary",
    is_read: Boolean(notification.read),
    created_at: notification.createdAt || nowISO()
  }));
}
function buildSupabaseAuditRows() {
  return state.activityLog.map((item) => ({
    id: item.id,
    actor_profile_id: item.userId || null,
    action: item.label,
    target_type: "activity_log",
    payload: { label: item.label },
    created_at: item.createdAt || nowISO()
  }));
}
function buildSupabaseQuestionBankRows() {
  return state.questionBank.map((question) => ({
    id: question.id,
    course_id: question.courseId,
    kind: question.kind || "mcq",
    prompt: question.prompt || "",
    options: question.options || [],
    answer: question.answer || "",
    points: Number(question.points || 1),
    created_at: question.createdAt || nowISO()
  }));
}
function buildSupabaseActivityQuestionRows() {
  return state.activities.flatMap((activity) => (activity.questions || []).map((question, index) => ({
    id: question.id,
    activity_id: activity.id,
    question_bank_id: question.questionBankId || null,
    kind: question.kind || "mcq",
    prompt: question.prompt || "",
    options: question.options || [],
    answer: question.answer || "",
    points: Number(question.points || 1),
    position: Number(question.position || index + 1)
  })));
}
function buildSupabaseAnnouncementRows() {
  return state.announcements.map((announcement) => ({
    id: announcement.id,
    course_id: announcement.courseId || null,
    author_profile_id: announcement.authorId || null,
    title: announcement.title,
    body: announcement.body || "",
    created_at: announcement.createdAt || nowISO()
  }));
}
function buildSupabaseMessageRows() {
  return state.messages.map((message) => ({
    id: message.id,
    from_profile_id: message.fromUserId || null,
    to_profile_id: message.toUserId,
    subject: message.subject || "",
    content: message.content || "",
    related_course_id: message.courseId || null,
    is_read: Boolean(message.read),
    created_at: message.createdAt || nowISO()
  }));
}
function buildSupabaseForumThreadRows() {
  return state.forumThreads.map((thread) => ({
    id: thread.id,
    course_id: thread.courseId,
    title: thread.title,
    created_by: thread.createdBy || null,
    created_at: thread.createdAt || nowISO()
  }));
}
function buildSupabaseForumPostRows() {
  return state.forumThreads.flatMap((thread) => (thread.posts || []).map((post) => ({
    id: post.id,
    thread_id: thread.id,
    author_profile_id: post.authorId || null,
    content: post.content || "",
    created_at: post.createdAt || nowISO()
  })));
}
function buildSupabaseAttendanceSessionRows() {
  return state.attendanceSessions.map((session) => ({
    id: session.id,
    course_id: session.courseId,
    title: session.title,
    session_date: session.sessionDate || nowISO(),
    created_by: session.createdBy || null,
    created_at: session.createdAt || nowISO()
  }));
}
function buildSupabaseAttendanceRecordRows() {
  return state.attendanceSessions.flatMap((session) => (session.records || []).map((record) => ({
    session_id: session.id,
    profile_id: record.userId,
    status: record.status || "present",
    note: record.note || ""
  })));
}

async function syncSupabaseSnapshot() {
  const client = getSupabaseClient();
  if (!client) return;
  const tasks = [
    ["profiles", buildSupabaseProfileRows(), "email"],
    ["courses", buildSupabaseCourseRows(), "id"],
    ["course_modules", buildSupabaseModuleRows(), "id"],
    ["lessons", buildSupabaseLessonRows(), "id"],
    ["lesson_resources", buildSupabaseResourceRows(), "id"],
    ["enrollments", buildSupabaseEnrollmentRows(), "course_id,profile_id"],
    ["activities", buildSupabaseActivityRows(), "id"],
    ["question_bank", buildSupabaseQuestionBankRows(), "id"],
    ["activity_questions", buildSupabaseActivityQuestionRows(), "id"],
    ["submissions", buildSupabaseSubmissionRows(), "id"],
    ["completion_records", buildSupabaseCompletionRows(), "id"],
    ["certificate_records", buildSupabaseCertificateRows(), "id"],
    ["announcements", buildSupabaseAnnouncementRows(), "id"],
    ["messages", buildSupabaseMessageRows(), "id"],
    ["forum_threads", buildSupabaseForumThreadRows(), "id"],
    ["forum_posts", buildSupabaseForumPostRows(), "id"],
    ["attendance_sessions", buildSupabaseAttendanceSessionRows(), "id"],
    ["attendance_records", buildSupabaseAttendanceRecordRows(), "session_id,profile_id"],
    ["notifications", buildSupabaseNotificationRows(), "id"],
    ["audit_logs", buildSupabaseAuditRows(), "id"]
  ];
  for (const [table, rows, onConflict] of tasks) {
    if (!rows.length) continue;
    const { error } = await client.from(table).upsert(rows, { onConflict });
    if (error) throw error;
  }
  state.config.supabase.lastSyncAt = nowISO();
  persistState(state);
}

async function loadStateFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return false;
  const [
    profilesResult,
    coursesResult,
    modulesResult,
    lessonsResult,
    resourcesResult,
    enrollmentsResult,
    activitiesResult,
    questionBankResult,
    activityQuestionsResult,
    submissionsResult,
    completionsResult,
    certificatesResult,
    announcementsResult,
    messagesResult,
    forumThreadsResult,
    forumPostsResult,
    attendanceSessionsResult,
    attendanceRecordsResult,
    notificationsResult,
    auditLogsResult
  ] = await Promise.all([
    client.from("profiles").select("*"),
    client.from("courses").select("*"),
    client.from("course_modules").select("*"),
    client.from("lessons").select("*"),
    client.from("lesson_resources").select("*"),
    client.from("enrollments").select("*").eq("status", "active"),
    client.from("activities").select("*"),
    client.from("question_bank").select("*"),
    client.from("activity_questions").select("*"),
    client.from("submissions").select("*"),
    client.from("completion_records").select("*"),
    client.from("certificate_records").select("*"),
    client.from("announcements").select("*"),
    client.from("messages").select("*"),
    client.from("forum_threads").select("*"),
    client.from("forum_posts").select("*"),
    client.from("attendance_sessions").select("*"),
    client.from("attendance_records").select("*"),
    client.from("notifications").select("*"),
    client.from("audit_logs").select("*")
  ]);
  const firstError = [
    profilesResult.error,
    coursesResult.error,
    modulesResult.error,
    lessonsResult.error,
    resourcesResult.error,
    enrollmentsResult.error,
    activitiesResult.error,
    questionBankResult.error,
    activityQuestionsResult.error,
    submissionsResult.error,
    completionsResult.error,
    certificatesResult.error,
    announcementsResult.error,
    messagesResult.error,
    forumThreadsResult.error,
    forumPostsResult.error,
    attendanceSessionsResult.error,
    attendanceRecordsResult.error,
    notificationsResult.error,
    auditLogsResult.error
  ].find(Boolean);
  if (firstError) throw firstError;

  const profiles = profilesResult.data || [];
  const courses = coursesResult.data || [];
  const modules = modulesResult.data || [];
  const lessons = lessonsResult.data || [];
  const resources = resourcesResult.data || [];
  const enrollments = enrollmentsResult.data || [];
  const activities = activitiesResult.data || [];
  const questionBank = questionBankResult.data || [];
  const activityQuestions = activityQuestionsResult.data || [];
  const submissions = submissionsResult.data || [];
  const completions = completionsResult.data || [];
  const certificates = certificatesResult.data || [];
  const announcements = announcementsResult.data || [];
  const messages = messagesResult.data || [];
  const forumThreads = forumThreadsResult.data || [];
  const forumPosts = forumPostsResult.data || [];
  const attendanceSessions = attendanceSessionsResult.data || [];
  const attendanceRecords = attendanceRecordsResult.data || [];
  const notifications = notificationsResult.data || [];
  const auditLogs = auditLogsResult.data || [];

  state.users = profiles.map((profile) => ({
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    password: "",
    role: profile.role,
    bio: profile.bio || "",
    avatar: profile.avatar || initials(profile.full_name || profile.email),
    createdAt: profile.created_at || nowISO()
  }));

  state.courses = courses.map((course) => {
    const courseModules = modules
      .filter((module) => module.course_id === course.id)
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map((module) => ({
        id: module.id,
        title: module.title,
        summary: module.summary || "",
        order: module.position || 1,
        lessons: lessons
          .filter((lesson) => lesson.module_id === module.id)
          .sort((a, b) => (a.position || 0) - (b.position || 0))
          .map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            type: lesson.lesson_type || "reading",
            duration: lesson.duration_label || "",
            content: lesson.content || "",
            resources: resources
              .filter((resource) => resource.lesson_id === lesson.id)
              .map((resource) => ({
                id: resource.id,
                title: resource.title,
                type: resource.resource_type || "link",
                url: resource.url || "#"
              }))
          }))
      }));
    return {
      id: course.id,
      title: course.title,
      category: course.category,
      catalogType: course.catalog_type || "school",
      description: course.description || "",
      image: course.image_url || "",
      teacherId: course.teacher_profile_id || "",
      status: course.status || "draft",
      audience: course.audience || "",
      duration: course.duration_label || "",
      price: Number(course.price || 0),
      pricingLabel: course.pricing_label || "",
      salesTag: course.sales_tag || "",
      sellingPoints: course.selling_points || [],
      enrolledUserIds: enrollments.filter((enrollment) => enrollment.course_id === course.id).map((enrollment) => enrollment.profile_id),
      modules: courseModules,
      release: normalizeCourseReleaseState(course.release),
      createdAt: course.created_at || nowISO()
    };
  });

  state.activities = activities.map((activity) => ({
    id: activity.id,
    courseId: activity.course_id,
    moduleId: activity.module_id || "",
    lessonId: activity.lesson_id || "",
    type: activity.activity_type,
    title: activity.title,
    description: activity.description || "",
    dueDate: activity.due_at || null,
    timeLimitMinutes: activity.time_limit_minutes || null,
    attemptsAllowed: activity.attempts_allowed || 1,
    passingScore: activity.passing_score || 50,
    maxPoints: activity.max_points || 20,
    weight: Number(activity.weight || 1),
    status: activity.status || "published",
    createdBy: activity.created_by || "",
    createdAt: activity.created_at || nowISO(),
    questions: activityQuestions
      .filter((question) => question.activity_id === activity.id)
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map((question) => ({
        id: question.id,
        questionBankId: question.question_bank_id || null,
        kind: question.kind || "mcq",
        prompt: question.prompt || "",
        options: question.options || [],
        answer: question.answer || "",
        points: Number(question.points || 1),
        position: Number(question.position || 1)
      }))
  }));

  state.questionBank = questionBank.map((question) => ({
    id: question.id,
    courseId: question.course_id,
    kind: question.kind || "mcq",
    prompt: question.prompt || "",
    options: question.options || [],
    answer: question.answer || "",
    points: Number(question.points || 1),
    createdAt: question.created_at || nowISO()
  }));

  state.submissions = submissions.map((submission) => ({
    id: submission.id,
    activityId: submission.activity_id,
    userId: submission.profile_id,
    status: submission.status || "submitted",
    score: typeof submission.score === "number" ? submission.score : null,
    maxPoints: submission.max_points || null,
    text: submission.text_answer || "",
    fileName: submission.file_name || "",
    fileUrl: submission.file_url || "",
    answers: submission.answers || [],
    feedback: submission.feedback || "",
    submittedAt: submission.submitted_at || nowISO(),
    reviewedAt: submission.reviewed_at || null
  }));

  state.completionRecords = completions.map((record) => ({
    id: record.id,
    courseId: record.course_id,
    moduleId: record.module_id || "",
    lessonId: record.lesson_id || "",
    userId: record.profile_id,
    completedAt: record.completed_at || nowISO()
  }));

  state.certificateRecords = certificates.map((record) => ({
    id: record.id,
    courseId: record.course_id,
    userId: record.profile_id,
    issuedAt: record.issued_at || nowISO(),
    progress: Number(record.progress_percent || 0),
    average: record.average_percent === null || record.average_percent === undefined ? null : Number(record.average_percent)
  }));

  state.announcements = announcements.map((announcement) => ({
    id: announcement.id,
    courseId: announcement.course_id || null,
    authorId: announcement.author_profile_id || null,
    title: announcement.title,
    body: announcement.body || "",
    createdAt: announcement.created_at || nowISO()
  }));

  state.messages = messages.map((message) => ({
    id: message.id,
    fromUserId: message.from_profile_id || null,
    toUserId: message.to_profile_id,
    subject: message.subject || "",
    content: message.content || "",
    courseId: message.related_course_id || "",
    createdAt: message.created_at || nowISO(),
    read: Boolean(message.is_read)
  }));

  state.forumThreads = forumThreads.map((thread) => ({
    id: thread.id,
    courseId: thread.course_id,
    title: thread.title,
    createdBy: thread.created_by || null,
    createdAt: thread.created_at || nowISO(),
    posts: forumPosts
      .filter((post) => post.thread_id === thread.id)
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
      .map((post) => ({
        id: post.id,
        authorId: post.author_profile_id || null,
        content: post.content || "",
        createdAt: post.created_at || nowISO()
      }))
  }));

  state.attendanceSessions = attendanceSessions.map((session) => ({
    id: session.id,
    courseId: session.course_id,
    title: session.title,
    sessionDate: session.session_date || nowISO(),
    createdBy: session.created_by || null,
    createdAt: session.created_at || nowISO(),
    records: attendanceRecords
      .filter((record) => record.session_id === session.id)
      .map((record) => ({
        userId: record.profile_id,
        status: record.status || "present",
        note: record.note || ""
      }))
  }));

  state.notifications = notifications.map((notification) => ({
    id: notification.id,
    userId: notification.profile_id,
    title: notification.title,
    message: notification.message,
    level: notification.level || "primary",
    read: Boolean(notification.is_read),
    createdAt: notification.created_at || nowISO()
  }));

  state.activityLog = auditLogs.map((entry) => ({
    id: entry.id,
    userId: entry.actor_profile_id || "",
    label: entry.action || entry.payload?.label || "Journal",
    createdAt: entry.created_at || nowISO()
  }));

  state.config.supabase.lastSyncAt = nowISO();
  persistState(state);
  return true;
}

async function testApiConnection() {
  if (shouldUseSupabasePersistence()) {
    await testSupabaseConnection();
    return;
  }
  const persistence = getPersistenceConfig();
  try {
    await apiRequest(persistence.healthPath, { method: "GET" });
    openModal(`
      <h2>Backend accessible</h2>
      <p class="section-subtitle">La connexion avec votre API est active et le point de contrôle répond correctement.</p>
    `);
  } catch (error) {
    openModal(`
      <h2>Backend indisponible</h2>
      <p class="section-subtitle">${escapeHtml(formatApiErrorMessage("Le test de connexion"))}</p>
    `);
  }
}

async function openBackendSummary() {
  const persistence = getPersistenceConfig();
  try {
    const payload = await apiRequest(persistence.summaryPath, { method: "GET" });
    const summary = payload?.summary || payload?.data?.summary || payload || {};
    openModal(`
      <h2>Résumé du backend</h2>
      <div class="simple-list" style="margin-top:18px">
        <div class="module-card"><strong>Utilisateurs</strong><div class="meta">${Number(summary.users || 0)}</div></div>
        <div class="module-card"><strong>Cours</strong><div class="meta">${Number(summary.courses || 0)}</div></div>
        <div class="module-card"><strong>Activités</strong><div class="meta">${Number(summary.activities || 0)}</div></div>
        <div class="module-card"><strong>Soumissions</strong><div class="meta">${Number(summary.submissions || 0)}</div></div>
        <div class="module-card"><strong>Messages</strong><div class="meta">${Number(summary.messages || 0)}</div></div>
        <div class="module-card"><strong>Annonces</strong><div class="meta">${Number(summary.announcements || 0)}</div></div>
      </div>
    `);
  } catch (error) {
    openModal(`
      <h2>Résumé indisponible</h2>
      <p class="section-subtitle">${escapeHtml(formatApiErrorMessage("La lecture du résumé backend"))}</p>
    `);
  }
}

async function openBackendEvents() {
  const persistence = getPersistenceConfig();
  try {
    const payload = await apiRequest(persistence.eventsReadPath, { method: "GET" });
    const events = payload?.events || payload?.data?.events || [];
    openModal(`
      <h2>Événements backend</h2>
      <div class="simple-list" style="margin-top:18px">
        ${events.length ? events.slice(0, 20).map((event) => `<div class="module-card"><strong>${escapeHtml(event.type || "event")}</strong><div class="meta">${escapeHtml(event.actorId || "système")} · ${formatDate(event.emittedAt)}</div></div>`).join("") : `<div class="empty-state">Aucun événement disponible.</div>`}
      </div>
    `);
  } catch (error) {
    openModal(`
      <h2>Journal indisponible</h2>
      <p class="section-subtitle">${escapeHtml(formatApiErrorMessage("La lecture des événements backend"))}</p>
    `);
  }
}

async function publishPlatformEvent(type, payload = {}) {
  const persistence = getPersistenceConfig();
  if (!shouldUseApiPersistence()) return;
  try {
    return await apiRequest(persistence.operationsPath, {
      method: "POST",
      body: {
        type,
        emittedAt: nowISO(),
        actorId: getCurrentUser()?.id || null,
        payload
      }
    });
  } catch (error) {
    console.warn("Platform event ignored:", error);
    return null;
  }
}

function extractRemoteEntity(response, key) {
  if (!response || typeof response !== "object") return null;
  if (response[key]) return response[key];
  if (response.payload?.[key]) return response.payload[key];
  if (response.data?.[key]) return response.data[key];
  if (response.record?.[key]) return response.record[key];
  return null;
}

function mergeRemoteEntity(localEntity, remoteEntity) {
  if (!localEntity || !remoteEntity || typeof remoteEntity !== "object") return localEntity;
  Object.assign(localEntity, remoteEntity);
  return localEntity;
}

async function loadStateFromApi() {
  const persistence = getPersistenceConfig();
  if (persistence.mode !== "api" || !persistence.apiBaseUrl) return false;
  try {
    const response = await fetch(buildApiUrl(persistence.apiBaseUrl, persistence.apiSnapshotPath), {
      method: "GET",
      headers: getApiHeaders()
    });
    if (!response.ok) throw new Error(`API load failed: ${response.status}`);
    const json = await response.json();
    const snapshot = json?.payload || json?.record || json?.data || json;
    if (!snapshot || typeof snapshot !== "object") return false;
    state = migrateState(snapshot);
    state.config.persistence.lastRemoteSyncAt = nowISO();
    persistState(state);
    return true;
  } catch (error) {
    console.warn("API load ignored:", error);
    return false;
  }
}

async function syncApiSnapshot() {
  const persistence = getPersistenceConfig();
  if (persistence.mode !== "api" || !persistence.apiBaseUrl) return;
  try {
    const response = await fetch(buildApiUrl(persistence.apiBaseUrl, persistence.apiSnapshotPath), {
      method: "PUT",
      headers: getApiHeaders(),
      body: JSON.stringify({ source: "adsl2ef-platform", exportedAt: nowISO(), payload: buildApiSafeSnapshot(state) })
    });
    if (!response.ok) throw new Error(`API sync failed: ${response.status}`);
    state.config.persistence.lastRemoteSyncAt = nowISO();
    persistState(state);
  } catch (error) {
    console.warn("API sync ignored:", error);
  }
}

function getAuthSecurity() {
  if (
    window.ADSL2EF_AUTH &&
    typeof window.ADSL2EF_AUTH.verifyPassword === "function" &&
    typeof window.ADSL2EF_AUTH.securePassword === "function"
  ) {
    return window.ADSL2EF_AUTH;
  }
  return null;
}

function buildApiSafeSnapshot(sourceState) {
  return {
    ...sourceState,
    users: Array.isArray(sourceState.users)
      ? sourceState.users.map((user) => ({ ...user, password: "" }))
      : []
  };
}

function getLoginRateLimitState(email) {
  try {
    const raw = sessionStorage.getItem(`adsl2ef-login-limit:${email}`);
    if (!raw) return { attempts: 0, lockedUntil: 0 };
    const parsed = JSON.parse(raw);
    return {
      attempts: Number(parsed.attempts || 0),
      lockedUntil: Number(parsed.lockedUntil || 0)
    };
  } catch (error) {
    return { attempts: 0, lockedUntil: 0 };
  }
}

function registerFailedLoginAttempt(email) {
  const now = Date.now();
  const current = getLoginRateLimitState(email);
  const attempts = current.lockedUntil > now ? current.attempts : current.attempts + 1;
  const next = {
    attempts,
    lockedUntil: attempts >= 5 ? now + (10 * 60 * 1000) : 0
  };
  sessionStorage.setItem(`adsl2ef-login-limit:${email}`, JSON.stringify(next));
  return next;
}

function clearFailedLoginAttempts(email) {
  sessionStorage.removeItem(`adsl2ef-login-limit:${email}`);
}

function isRoleAllowedForPublicRegistration(role) {
  return role === "student" || role === "teacher";
}

async function secureLocalPassword(rawPassword) {
  const authSecurity = getAuthSecurity();
  if (authSecurity) return authSecurity.securePassword(rawPassword);
  return rawPassword;
}

async function verifyLocalCredentials(email, password) {
  const candidate = state.users.find((item) => item.email.toLowerCase() === email);
  if (!candidate) return null;
  const authSecurity = getAuthSecurity();
  if (authSecurity) {
    const verifiedUser = await authSecurity.loginLocally(state.users, email, password);
    if (!verifiedUser) return null;
    if (authSecurity.isPlaintext(candidate.password)) {
      candidate.password = await authSecurity.securePassword(password);
      saveState();
    }
    return candidate;
  }
  return candidate.password === password ? candidate : null;
}

function getCurrentUser() { return state.users.find((user) => user.id === state.currentUserId) || null; }
function getUserById(id) { return state.users.find((user) => user.id === id) || null; }
function getCourseById(id) { return state.courses.find((course) => course.id === id) || null; }
function getActivityById(id) { return state.activities.find((activity) => activity.id === id) || null; }
function getActivitiesForCourse(courseId) { return state.activities.filter((activity) => activity.courseId === courseId); }
function getPaymentRecordById(id) { return state.paymentRecords.find((payment) => payment.id === id) || null; }
function getQuestionBankForCourse(courseId) { return state.questionBank.filter((question) => question.courseId === courseId); }
function getAttendanceForCourse(courseId) { return state.attendanceSessions.filter((session) => session.courseId === courseId); }
function getCourseStudents(course) { return state.users.filter((user) => user.role === "student" && course?.enrolledUserIds.includes(user.id)); }
function getQuestionById(questionId) { return state.questionBank.find((question) => question.id === questionId) || null; }
function getUserSubmission(activityId, userId) {
  const matches = state.submissions.filter((submission) => submission.activityId === activityId && submission.userId === userId);
  return matches[matches.length - 1] || null;
}
function canManagePlatform(user) { return user?.role === "admin"; }
function canTeachCourse(user, course) { return user?.role === "admin" || (user?.role === "teacher" && course?.teacherId === user.id); }
function canAccessCourse(user, course) {
  if (!user || !course) return false;
  if (user.role === "admin") return true;
  if (user.role === "teacher" && course.teacherId === user.id) return true;
  if (user.role === "student" && course.enrolledUserIds.includes(user.id)) return true;
  return false;
}
function getStudentSubmissionsForCourse(courseId, userId) {
  return state.submissions.filter((submission) => {
    const activity = getActivityById(submission.activityId);
    return activity?.courseId === courseId && submission.userId === userId;
  });
}
function computeAverageForCourse(courseId, userId) {
  const graded = getStudentSubmissionsForCourse(courseId, userId).filter((submission) => typeof submission.score === "number");
  if (!graded.length) return null;
  const weighted = graded.reduce((acc, submission) => {
    const activity = getActivityById(submission.activityId);
    const weight = Number(activity?.weight || 1);
    acc.total += ((submission.score / Math.max(submission.maxPoints || 1, 1)) * 100) * weight;
    acc.weight += weight;
    return acc;
  }, { total: 0, weight: 0 });
  return weighted.weight ? Math.round(weighted.total / weighted.weight) : null;
}
function courseCompletionStatus(course, userId) {
  const progress = computeCourseProgress(course, userId);
  if (progress >= 100) return "Terminé";
  if (progress >= 60) return "En bonne voie";
  if (progress > 0) return "En progression";
  return "À démarrer";
}
function computeAttendanceRate(courseId, userId) {
  const sessions = getAttendanceForCourse(courseId);
  if (!sessions.length) return null;
  const present = sessions.filter((session) => session.records.some((record) => record.userId === userId && record.status === "present")).length;
  return Math.round((present / sessions.length) * 100);
}
function getVisibleCoursesForUser(user) {
  if (user.role === "admin") return state.courses;
  if (user.role === "teacher") return state.courses.filter((course) => course.teacherId === user.id);
  return state.courses.filter((course) => course.enrolledUserIds.includes(user.id));
}
function canManageEnrollment(course, user = getCurrentUser()) {
  if (!course || !user) return false;
  return user.role === "admin" || (user.role === "teacher" && course.teacherId === user.id);
}
function getCourseLessons(course) {
  return course.modules.flatMap((module) => (module.lessons || []).map((lesson) => ({
    courseId: course.id,
    moduleId: module.id,
    lessonId: lesson.id,
    lesson
  })));
}
function getCompletionRecord(userId, courseId, moduleId, lessonId) {
  return state.completionRecords.find((record) => record.userId === userId && record.courseId === courseId && record.moduleId === moduleId && record.lessonId === lessonId) || null;
}
function isLessonCompleted(userId, courseId, moduleId, lessonId) {
  return Boolean(getCompletionRecord(userId, courseId, moduleId, lessonId));
}
function isActivityCompleted(activityId, userId) {
  return Boolean(getUserSubmission(activityId, userId));
}
function getCourseCompletionMetrics(course, userId) {
  const lessons = getCourseLessons(course);
  const activities = getActivitiesForCourse(course.id);
  const totalItems = lessons.length + activities.length;
  if (!totalItems) {
    return { totalItems: 0, completedItems: 0, progress: 0, completedLessons: 0, totalLessons: 0, completedActivities: 0, totalActivities: 0 };
  }
  const completedLessons = lessons.filter((item) => isLessonCompleted(userId, course.id, item.moduleId, item.lessonId)).length;
  const completedActivities = activities.filter((activity) => isActivityCompleted(activity.id, userId)).length;
  const completedItems = completedLessons + completedActivities;
  return {
    totalItems,
    completedItems,
    progress: Math.min(100, Math.round((completedItems / totalItems) * 100)),
    completedLessons,
    totalLessons: lessons.length,
    completedActivities,
    totalActivities: activities.length
  };
}
function getModuleActivities(courseId, moduleId) {
  return getActivitiesForCourse(courseId).filter((activity) => activity.moduleId === moduleId);
}
function getCertificateRecord(courseId, userId) {
  return state.certificateRecords.find((record) => record.courseId === courseId && record.userId === userId) || null;
}
function isActivityOverdue(activity, userId = "") {
  if (!activity?.dueDate) return false;
  const dueAt = new Date(activity.dueDate).getTime();
  if (!Number.isFinite(dueAt)) return false;
  if (!userId) return Date.now() > dueAt;
  const submission = getUserSubmission(activity.id, userId);
  if (!submission) return Date.now() > dueAt;
  return new Date(submission.submittedAt || nowISO()).getTime() > dueAt;
}
function getCourseOverdueCount(course, userId) {
  return getActivitiesForCourse(course.id).filter((activity) => isActivityOverdue(activity, userId)).length;
}
async function ensureCertificateRecord(courseId, userId) {
  const course = getCourseById(courseId);
  if (!course) return null;
  const progress = computeCourseProgress(course, userId);
  if (progress < 100) return null;
  const average = computeAverageForCourse(courseId, userId);
  let record = getCertificateRecord(courseId, userId);
  if (!record) {
    record = {
      id: crypto.randomUUID(),
      courseId,
      userId,
      issuedAt: nowISO(),
      progress,
      average
    };
    state.certificateRecords.unshift(record);
    addLog(userId, `Certificat généré - ${course.title}`);
    addNotification({
      userId,
      title: "Certificat disponible",
      message: `Votre attestation pour ${course.title} est maintenant disponible.`,
      level: "success"
    });
  } else {
    record.progress = progress;
    record.average = average;
  }
  if (shouldUseSupabasePersistence()) {
    try {
      await supabaseUpsert("certificate_records", {
        id: record.id,
        course_id: record.courseId,
        profile_id: record.userId,
        issued_at: record.issuedAt || nowISO(),
        progress_percent: Number(record.progress || 0),
        average_percent: typeof record.average === "number" ? Number(record.average) : null
      });
    } catch (error) {
      console.warn("Supabase certificate sync ignored:", error);
    }
  }
  return record;
}
function getModuleCompletionMetrics(course, moduleId, userId) {
  const module = course.modules.find((item) => item.id === moduleId);
  if (!module) {
    return { totalItems: 0, completedItems: 0, progress: 0, completedLessons: 0, totalLessons: 0, completedActivities: 0, totalActivities: 0 };
  }
  const lessons = module.lessons || [];
  const activities = getModuleActivities(course.id, moduleId);
  const totalItems = lessons.length + activities.length;
  if (!totalItems) {
    return { totalItems: 0, completedItems: 0, progress: 0, completedLessons: 0, totalLessons: lessons.length, completedActivities: 0, totalActivities: activities.length };
  }
  const completedLessons = lessons.filter((lesson) => isLessonCompleted(userId, course.id, moduleId, lesson.id)).length;
  const completedActivities = activities.filter((activity) => isActivityCompleted(activity.id, userId)).length;
  const completedItems = completedLessons + completedActivities;
  return {
    totalItems,
    completedItems,
    progress: Math.min(100, Math.round((completedItems / totalItems) * 100)),
    completedLessons,
    totalLessons: lessons.length,
    completedActivities,
    totalActivities: activities.length
  };
}
function isModuleLocked(course, user, moduleId) {
  if (!course || !user || user.role !== "student") return false;
  const release = normalizeCourseReleaseState(course.release);
  if (release.modules[moduleId] === false) return true;
  const moduleIndex = course.modules.findIndex((item) => item.id === moduleId);
  if (moduleIndex <= 0) return false;
  return course.modules.slice(0, moduleIndex).some((module) => getModuleCompletionMetrics(course, module.id, user.id).progress < 100);
}
function getFirstAccessibleModule(course, user) {
  if (!course?.modules?.length) return null;
  return course.modules.find((module) => !isModuleLocked(course, user, module.id)) || course.modules[0];
}
function isLessonLocked(course, user, moduleId, lessonId) {
  if (!course || !user || user.role !== "student") return false;
  if (isModuleLocked(course, user, moduleId)) return true;
  const release = normalizeCourseReleaseState(course.release);
  return release.lessons[lessonId] === false;
}
function getFirstAccessibleLesson(course, module, user) {
  if (!module?.lessons?.length) return null;
  return module.lessons.find((lesson) => !isLessonLocked(course, user, module.id, lesson.id)) || module.lessons[0];
}
function computeCourseProgress(course, userId) {
  return getCourseCompletionMetrics(course, userId).progress;
}

function addNotification({ userId, title, message, level = "primary" }) {
  const notification = { id: crypto.randomUUID(), userId, title, message, level, read: false, createdAt: nowISO() };
  state.notifications.unshift(notification);
  if (shouldUseSupabasePersistence()) {
    supabaseUpsert("notifications", {
      id: notification.id,
      profile_id: notification.userId,
      title: notification.title,
      message: notification.message,
      level: notification.level || "primary",
      is_read: false,
      created_at: notification.createdAt
    }).catch((error) => console.warn("Supabase notification sync ignored:", error));
  }
}
function addLog(userId, label) {
  const logEntry = { id: crypto.randomUUID(), userId, label, createdAt: nowISO() };
  state.activityLog.unshift(logEntry);
  if (shouldUseSupabasePersistence()) {
    supabaseUpsert("audit_logs", {
      id: logEntry.id,
      actor_profile_id: logEntry.userId || null,
      action: logEntry.label,
      target_type: "activity_log",
      payload: { label: logEntry.label },
      created_at: logEntry.createdAt
    }).catch((error) => console.warn("Supabase audit sync ignored:", error));
  }
}

async function syncGoogleSheets() {
  const cfg = state.config.googleSheets;
  if (!cfg.enabled || !cfg.webAppUrl) return;
  try {
    await fetch(cfg.webAppUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "adsl2ef-lms", exportedAt: nowISO(), payload: state })
    });
  } catch (error) {
    console.warn("Google Sheets sync ignored:", error);
  }
}

function getJsonBinHeaders(cfg) {
  const headers = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers["X-Master-Key"] = cfg.apiKey;
  if (cfg.accessKey) headers["X-Access-Key"] = cfg.accessKey;
  return headers;
}

async function loadCoursesFromJsonBin() {
  const cfg = state.config.jsonbin;
  if (!cfg.enabled || !cfg.binId) return false;
  try {
    const response = await fetch(`https://api.jsonbin.io/v3/b/${cfg.binId}/latest`, {
      method: "GET",
      headers: getJsonBinHeaders(cfg)
    });
    if (!response.ok) throw new Error(`JSONBin load failed: ${response.status}`);
    const json = await response.json();
    const record = json.record || {};
    if (Array.isArray(record.courses)) state.courses = migrateState({ courses: record.courses }).courses;
    if (Array.isArray(record.activities)) state.activities = record.activities;
    cfg.lastSyncAt = nowISO();
    persistState();
    return true;
  } catch (error) {
    console.warn("JSONBin load ignored:", error);
    return false;
  }
}

async function syncJsonBin() {
  const cfg = state.config.jsonbin;
  if (!cfg.enabled || !cfg.binId) return;
  try {
    const payload = {
      courses: state.courses,
      activities: state.activities,
      exportedAt: nowISO()
    };
    const response = await fetch(`https://api.jsonbin.io/v3/b/${cfg.binId}`, {
      method: "PUT",
      headers: getJsonBinHeaders(cfg),
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`JSONBin sync failed: ${response.status}`);
    cfg.lastSyncAt = nowISO();
  } catch (error) {
    console.warn("JSONBin sync ignored:", error);
  }
}

function saveState() {
  persistState();
  syncGoogleSheets();
  syncJsonBin();
  syncApiSnapshot();
  if (shouldUseSupabasePersistence()) {
    syncSupabaseSnapshot().catch((error) => console.warn("Supabase sync ignored:", error));
  }
  renderApp();
}

function setScreen(screen, payload = {}) {
  state.ui.screen = screen;
  Object.assign(state.ui, payload);
  saveState();
}

function metricCard(label, value, trend) {
  return `<article class="metric-card"><span class="metric-label">${label}</span><strong class="metric-value">${value}</strong><div class="metric-trend">${trend}</div></article>`;
}

function openModal(content) {
  closeModal();
  const template = document.getElementById("modal-template");
  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector(".modal-content").innerHTML = content;
  document.body.appendChild(node);
  node.addEventListener("click", (event) => {
    if (event.target === node || event.target.hasAttribute("data-close-modal")) closeModal();
  });
  bindForms();
}

function closeModal() {
  document.querySelector(".modal-backdrop")?.remove();
}

function resetDemo() {
  state = structuredClone(starterData);
  persistState(state);
  renderApp();
}

async function logout() {
  if (state.session?.authProvider === "supabase" && shouldUseSupabasePersistence()) {
    try {
      await getSupabaseClient()?.auth.signOut();
    } catch (error) {
      console.warn("Supabase logout ignored:", error);
    }
  }
  state.currentUserId = null;
  state.session = { accessToken: "", authProvider: "local", lastAuthAt: "" };
  state.ui.screen = "landing";
  saveState();
}

function renderLoginForm() {
  return `
    <h2>Connexion</h2>
    <p class="section-subtitle">Connectez-vous à votre espace personnel pour accéder à vos cours, évaluations et services pédagogiques.</p>
    <form id="login-form" class="form-grid" style="margin-top:18px">
      <div class="field full"><label for="login-email">Email</label><input id="login-email" name="email" type="email" required placeholder="votre@email.com"></div>
      <div class="field full"><label for="login-password">Mot de passe</label><input id="login-password" name="password" type="password" required placeholder="Votre mot de passe"></div>
      <div class="field full"><button class="btn-primary" type="submit">Se connecter</button></div>
    </form>
  `;
}

function renderRegisterForm() {
  return `
    <h2>Créer un compte</h2>
    <p class="section-subtitle">Créez votre accès pour rejoindre la plateforme et bénéficier d’un espace adapté à votre profil.</p>
    <form id="register-form" class="form-grid" style="margin-top:18px">
      <div class="field"><label for="reg-name">Nom complet</label><input id="reg-name" name="name" required placeholder="Nom complet"></div>
      <div class="field"><label for="reg-role">Profil</label><select id="reg-role" name="role"><option value="student">Apprenant</option><option value="teacher">Enseignant</option></select></div>
      <div class="field full"><label for="reg-email">Email</label><input id="reg-email" name="email" type="email" required placeholder="email@domaine.com"></div>
      <div class="field full"><label for="reg-password">Mot de passe</label><input id="reg-password" name="password" type="password" required minlength="6"></div>
      <div class="field full"><button class="btn-primary" type="submit">Créer le compte</button></div>
    </form>
  `;
}

function showAuthModal(mode = "login") {
  openModal(`
    <div class="auth-grid">
      <aside class="auth-aside">
        <p class="eyebrow">Plateforme ADSL-2EF</p>
        <h2>Accédez à votre espace de formation</h2>
        <p>Retrouvez vos cours, vos évaluations, vos ressources pédagogiques, vos messages et votre suivi académique dans un espace centralisé.</p>
        <ul class="list-check">
          <li>Accès apprenant, enseignant et administration</li>
          <li>Suivi des cours, devoirs, quiz et progression</li>
          <li>Communication centralisée avec l'équipe pédagogique</li>
        </ul>
        <p class="tiny">Utilisez vos identifiants institutionnels pour vous connecter à la plateforme.</p>
        <p class="tiny">En cas de difficulté d'accès, contactez l'administration ADSL-2EF.</p>
      </aside>
      <section class="auth-main">
        <div class="toolbar">
          <button class="${mode === "login" ? "btn-primary" : "btn-ghost"}" onclick="showAuthModal('login')">Connexion</button>
          <button class="${mode === "register" ? "btn-primary" : "btn-ghost"}" onclick="showAuthModal('register')">Inscription</button>
        </div>
        ${mode === "login" ? renderLoginForm() : renderRegisterForm()}
      </section>
    </div>
  `);
}

function renderTopbar() {
  const topbar = document.getElementById("topbar-actions");
  const banner = document.getElementById("site-banner");
  const user = getCurrentUser();
  const site = state.config.site;
  banner.className = "site-banner";
  banner.innerHTML = `<strong>${escapeHtml(site.banner)}</strong><span>${escapeHtml(site.subBanner)}</span>`;
  const publicNav = `
    <button class="btn-ghost" onclick="setScreen('landing')">Accueil</button>
    <button class="btn-ghost" onclick="setScreen('schoolCatalog')">École Numérique</button>
    <button class="btn-ghost" onclick="setScreen('proCatalog')">Formation Pro</button>
    <button class="btn-accent" onclick="setScreen('contact')">Contactez-nous</button>
  `;
  document.title = site.headline;
  if (!user) {
    topbar.innerHTML = `
      ${publicNav}
      <button class="btn-primary" onclick="showAuthModal('login')">Connexion</button>
      <button class="btn-primary" onclick="showAuthModal('register')">Créer un compte</button>
    `;
    return;
  }
  const unread = state.notifications.filter((item) => item.userId === user.id && !item.read).length;
  topbar.innerHTML = `
    ${publicNav}
    <span class="badge primary">${roleLabels[user.role]}</span>
    <span class="badge ${unread ? "warning" : "success"}">${unread} notification${unread > 1 ? "s" : ""}</span>
    <span class="badge">${escapeHtml(user.avatar || initials(user.name))}</span>
    <button class="btn-ghost" onclick="logout()">Déconnexion</button>
  `;
}

function renderPublicCourseCard(course) {
  const teacher = getUserById(course.teacherId);
  const activities = getActivitiesForCourse(course.id);
  return `
    <article class="course-card">
      <div class="course-cover" style="background-image:url('${escapeHtml(course.image)}')"><span>${escapeHtml(course.category)}</span></div>
      <h3>${escapeHtml(course.title)}</h3>
      <p class="meta">${escapeHtml(course.description)}</p>
      <div class="badge-row">
        <span class="badge primary">${course.modules.length} modules</span>
        <span class="badge success">${activities.length} activités</span>
      </div>
      <div class="progress"><span style="width:${Math.min(100, course.enrolledUserIds.length * 10)}%"></span></div>
      <div class="toolbar" style="justify-content:space-between">
        <span class="tiny">Enseignant : ${escapeHtml(teacher?.name || "Non assigné")}</span>
        <button class="btn-ghost" onclick="showAuthModal('login')">Accéder</button>
      </div>
    </article>
  `;
}

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} F CFA`;
}

function getCatalogCourses(type) {
  return state.courses.filter((course) => course.status === "published" && course.catalogType === type);
}

function normalizeCategory(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function getFilteredSchoolCourses() {
  const courses = getCatalogCourses("school");
  if (state.ui.schoolCategory === "all") return courses;
  return courses.filter((course) => normalizeCategory(course.category) === normalizeCategory(state.ui.schoolCategory));
}

function setSchoolCategory(category) {
  state.ui.schoolCategory = category;
  saveState();
}

function renderSellCard(course, mode) {
  const teacher = getUserById(course.teacherId);
  const user = getCurrentUser();
  const isLogged = Boolean(user);
  const isStudent = user?.role === "student";
  const isEnrolled = isStudent && course.enrolledUserIds.includes(user.id);
  const cta = isEnrolled
    ? `<button class="btn-primary" onclick="openCourse('${course.id}')">Accéder au cours</button>`
    : isLogged && isStudent
      ? `<button class="btn-accent" onclick="purchaseCourse('${course.id}')">Acheter maintenant</button>`
      : `<button class="btn-accent" onclick="showAuthModal('register')">Acheter et créer un compte</button>`;
  return `
    <article class="store-card">
      <div class="course-cover store-cover" style="background-image:url('${escapeHtml(course.image)}')"><span>${escapeHtml(course.salesTag || course.category)}</span></div>
      <div class="toolbar" style="justify-content:space-between">
        <span class="badge ${mode === "pro" ? "warning" : "primary"}">${escapeHtml(course.audience)}</span>
        <span class="tiny">${escapeHtml(course.duration)}</span>
      </div>
      <h3>${escapeHtml(course.title)}</h3>
      <p class="meta">${escapeHtml(course.description)}</p>
      <div class="selling-points">
        ${(course.sellingPoints || []).map((point) => `<span class="selling-chip">${escapeHtml(point)}</span>`).join("")}
      </div>
      <div class="price-block">
        <strong>${formatPrice(course.price)}</strong>
        <span>${escapeHtml(course.pricingLabel || "")}</span>
      </div>
      <div class="toolbar" style="justify-content:space-between">
        <span class="tiny">Par ${escapeHtml(teacher?.name || "Equipe ADSL-2EF")}</span>
        ${cta}
      </div>
    </article>
  `;
}

function renderCatalogPage(type) {
  const isSchool = type === "school";
  const courses = isSchool ? getFilteredSchoolCourses() : getCatalogCourses(type);
  const total = courses.length;
  const schoolCategories = ["Collège", "Lycée Moderne", "Technique", "Adultes"];
  return `
    ${isSchool ? `
      <section class="school-topnav panel">
        <div class="school-topnav-row">
          ${schoolCategories.map((category) => {
            const label = category === "Adultes" ? "Adultes / Cand. libre" : category;
            const active = normalizeCategory(state.ui.schoolCategory === "all" ? "Collège" : state.ui.schoolCategory) === normalizeCategory(category);
            return `<button class="school-topnav-item ${active ? "active" : ""}" onclick="setSchoolCategory('${category}')">${escapeHtml(label)}</button>`;
          }).join("")}
        </div>
      </section>
    ` : ""}
    <section class="storefront-hero ${isSchool ? "storefront-school" : "storefront-pro"}">
      <div>
        <p class="eyebrow">${isSchool ? "École Numérique" : "Formation Pro"}</p>
        <h2 class="hero-title">${isSchool ? "Des parcours académiques structurés pour le collège, le lycée moderne, l'enseignement technique et les adultes." : "Des formations professionnelles crédibles pour enseignants et directeurs d'école."}</h2>
        <p class="storefront-text">${isSchool ? "L'École Numérique ADSL-2EF regroupe des parcours structurés, avec leçons, ressources, quiz, devoirs et suivi de progression. Les offres couvrent le collège, le lycée moderne, l'enseignement technique ainsi que l'école pour adultes préparant les candidats libres au BAC et au BEPC." : "La Formation Professionnelle ADSL-2EF accompagne les enseignants et les responsables d'établissement avec des programmes applicatifs, des études de cas, des outils de pilotage et un parcours certifiant. Chaque fiche est pensée comme une offre professionnelle claire et vendable."}</p>
        <div class="hero-actions">
          <button class="btn-accent" onclick="${isSchool ? "setScreen('schoolCatalog')" : "setScreen('proCatalog')"}">Voir tous les cours</button>
          <button class="btn-ghost" onclick="showAuthModal('login')">Se connecter</button>
        </div>
      </div>
      <div class="storefront-aside">
        <div class="stat-pill"><strong>${total}</strong><span>${isSchool ? "parcours disponibles" : "formations à vendre"}</span></div>
        <div class="stat-pill"><strong>${isSchool ? "15 000 F" : "45 000 F"}</strong><span>à partir de</span></div>
        <div class="stat-pill"><strong>${isSchool ? "Quiz + devoirs + suivi" : "Cas pratiques + certificat"}</strong><span>${isSchool ? "format LMS complet" : "expérience professionnalisante"}</span></div>
      </div>
    </section>

    <section class="panel">
      <div class="toolbar" style="justify-content:space-between">
        <div>
          <h2 class="section-title">${isSchool ? "Catalogue École Numérique" : "Catalogue Formation Pro"}</h2>
          <p class="section-subtitle">${isSchool ? "Des offres bien structurées pour collégiens, lycéens, apprenants du technique et adultes en reprise d'études." : "Des offres professionnelles destinées aux enseignants et aux directeurs d'école."}</p>
        </div>
        <button class="btn-primary" onclick="${isSchool ? "showAuthModal('register')" : "showContactSalesModal()"}">${isSchool ? "Créer un compte et acheter" : "Demander une inscription"}</button>
      </div>
      ${isSchool ? `
        <div class="school-heading-row">
          <div>
            <span class="school-badge">${escapeHtml(state.ui.schoolCategory === "all" ? "Collège" : state.ui.schoolCategory)}</span>
            <h3 class="school-heading-title">Cours par matière et par classe</h3>
            <p class="section-subtitle">Choisissez votre parcours, achetez le cours et commencez immédiatement.</p>
          </div>
          <div class="school-view-switch">
            <button class="school-view-switch-btn active">Parcours</button>
            <button class="school-view-switch-btn">Abonnement</button>
          </div>
        </div>
      ` : `
        <div class="school-heading-row">
          <div>
            <span class="school-badge">Formation professionnelle</span>
            <h3 class="school-heading-title">Programmes certifiants pour les acteurs de l'éducation</h3>
            <p class="section-subtitle">Choisissez votre programme, confirmez votre inscription et intégrez votre cohorte.</p>
          </div>
          <div class="school-view-switch">
            <button class="school-view-switch-btn active">Programmes</button>
            <button class="school-view-switch-btn">Cohortes</button>
          </div>
        </div>
      `}
      <div class="store-grid" style="margin-top:22px">
        ${courses.map((course) => renderSellCard(course, type)).join("")}
      </div>
    </section>
  `;
}

function renderContactPage() {
  const site = state.config.site;
  return `
    <section class="contact-hero">
      <h2 class="hero-title">Contactez-nous</h2>
      <p class="contact-hero-text">Besoin d'informations, d'un devis ou d'une inscription ? Notre équipe ADSL-2EF vous répond rapidement.</p>
    </section>
    <section class="contact-grid">
      <div class="panel">
        <h2 class="section-title">Envoyer un message</h2>
        <p class="section-subtitle">Remplissez ce formulaire et nous vous recontactons dans les meilleurs délais.</p>
        <form id="contact-form" class="form-grid" style="margin-top:18px">
          <div class="field full"><label for="contact-name">Votre nom</label><input id="contact-name" name="name" required placeholder="Prénom Nom"></div>
          <div class="field"><label for="contact-phone">Téléphone / WhatsApp</label><input id="contact-phone" name="phone" required placeholder="${escapeHtml(site.contactPhone)}"></div>
          <div class="field"><label for="contact-email">Email</label><input id="contact-email" name="email" type="email" placeholder="contact@email.com"></div>
          <div class="field full"><label for="contact-subject">Sujet</label><select id="contact-subject" name="subject"><option>Demande d'information</option><option>Inscription École Numérique</option><option>Inscription Formation Pro</option><option>Partenariat</option></select></div>
          <div class="field full"><label for="contact-message">Votre message</label><textarea id="contact-message" name="message" required placeholder="Décrivez votre demande, vos besoins ou vos questions..."></textarea></div>
          <div class="field full"><button class="btn-accent" type="submit">Envoyer le message</button></div>
        </form>
      </div>
      <div class="panel contact-panel">
        <h2 class="section-title">Nos coordonnées</h2>
        <div class="simple-list" style="margin-top:18px">
          <div class="module-card"><strong>Adresse</strong><div class="meta">${escapeHtml(site.contactAddress)}</div></div>
          <div class="module-card"><strong>WhatsApp</strong><div class="meta">${escapeHtml(site.contactPhone)}</div></div>
          <div class="module-card"><strong>Email</strong><div class="meta">${escapeHtml(site.contactEmail)}</div></div>
          <div class="module-card"><strong>Heures de réponse</strong><div class="meta">Lun-Sam : 7h00 - 20h00 · Dim : 9h00 - 18h00</div></div>
        </div>
        <div class="toolbar" style="margin-top:20px">
          <a class="btn-accent" href="${escapeHtml(site.whatsappUrl)}" target="_blank" rel="noreferrer">Ouvrir WhatsApp</a>
        </div>
      </div>
    </section>
  `;
}

function renderLanding() {
  const publishedCourses = state.courses.filter((course) => course.status === "published");
  const teachers = state.users.filter((user) => user.role === "teacher").length;
  const learners = state.users.filter((user) => user.role === "student").length;
  return `
    <section class="hero">
      <div class="hero-panel hero-gradient">
        <h2 class="hero-title">La plateforme numérique professionnelle d'ADSL-2EF au service de l'éducation et de la formation.</h2>
        <p class="hero-text">ADSL-2EF propose un environnement numérique structuré pour diffuser, suivre et administrer des parcours de qualité en École Numérique, École pour adultes et Formation Professionnelle. Chaque offre est présentée avec un positionnement clair, des contenus organisés et une expérience d'apprentissage sérieuse.</p>
        <div class="hero-actions">
          <button class="btn-accent" onclick="showAuthModal('login')">Entrer dans la plateforme</button>
          <button class="btn-ghost" onclick="setScreen('schoolCatalog')">Voir l'École Numérique</button>
        </div>
        <div class="hero-stats">
          <div class="stat-pill"><strong>${publishedCourses.length}</strong><span>offres publiées</span></div>
          <div class="stat-pill"><strong>${teachers}</strong><span>formateurs mobilisés</span></div>
          <div class="stat-pill"><strong>${learners}</strong><span>comptes apprenants</span></div>
        </div>
      </div>
      <div class="hero-panel">
        <p class="eyebrow">Nos publics</p>
        <h3>Une offre structurée pour chaque profil d'apprenant</h3>
        <div class="simple-list">
          <div class="module-card"><strong>Collège</strong><div class="meta">Parcours de renforcement et d'accompagnement préparés pour les classes du collège.</div></div>
          <div class="module-card"><strong>Lycée moderne et technique</strong><div class="meta">Cours organisés par filière avec supports, évaluations et préparation aux examens.</div></div>
          <div class="module-card"><strong>École pour adultes</strong><div class="meta">Préparation des candidats libres au BAC et au BEPC dans un cadre flexible et motivant.</div></div>
          <div class="module-card"><strong>Formation professionnelle</strong><div class="meta">Programmes pour enseignants et directeurs d'école, orientés pratique et gouvernance.</div></div>
        </div>
      </div>
    </section>
    <section id="catalog" class="panel">
      <div class="toolbar" style="justify-content:space-between">
        <div>
          <h2 class="section-title">Nos parcours</h2>
          <p class="section-subtitle">Un espace unique pour présenter, vendre et administrer les offres de formation ADSL-2EF.</p>
        </div>
        <button class="btn-primary" onclick="showAuthModal('register')">Créer un compte apprenant</button>
      </div>
      <div class="quick-grid" style="margin-top:20px">
        <article class="quick-card quick-school">
          <p class="eyebrow">École Numérique</p>
          <h3>Collège, lycée moderne, technique et école pour adultes</h3>
          <p class="meta">Une vitrine claire des offres scolaires avec catégories, prix, promesses pédagogiques et accès aux parcours.</p>
          <button class="btn-primary" onclick="setScreen('schoolCatalog')">Ouvrir la page</button>
        </article>
        <article class="quick-card quick-pro">
          <p class="eyebrow">Formation Pro</p>
          <h3>Programmes pour enseignants et directeurs d'école</h3>
          <p class="meta">Une vitrine professionnelle pour présenter les parcours, valoriser l'impact et faciliter l'inscription.</p>
          <button class="btn-primary" onclick="setScreen('proCatalog')">Ouvrir la page</button>
        </article>
      </div>
      <div class="course-grid" style="margin-top:20px">
        ${publishedCourses.map(renderPublicCourseCard).join("")}
      </div>
      <p class="footer-note">Connexion requise pour suivre un cours, remettre un devoir ou lancer un quiz.</p>
    </section>
  `;
}

function renderNotifications(userId) {
  const items = state.notifications.filter((notification) => notification.userId === userId).slice(0, 5);
  if (!items.length) return `<div class="empty-state">Aucune notification.</div>`;
  return items.map((notification) => `
    <article class="notification-item">
      <div class="toolbar" style="justify-content:space-between">
        <span class="badge ${notification.level || "primary"}">${notification.read ? "Lue" : "Nouvelle"}</span>
        <span class="tiny">${formatDate(notification.createdAt)}</span>
      </div>
      <h3>${escapeHtml(notification.title)}</h3>
      <p class="meta">${escapeHtml(notification.message)}</p>
    </article>
  `).join("");
}

function renderActivityFeed(userId) {
  const items = state.activityLog.filter((item) => item.userId === userId).slice(0, 6);
  if (!items.length) return `<div class="empty-state">Aucune activité enregistrée pour le moment.</div>`;
  return items.map((item) => `<article class="feed-item"><h3>${escapeHtml(item.label)}</h3><div class="meta">${formatDate(item.createdAt)}</div></article>`).join("");
}

function renderAnnouncements(courseId = null) {
  const entries = state.announcements.filter((item) => !courseId || item.courseId === courseId).slice(0, 4);
  if (!entries.length) return `<div class="empty-state">Aucune annonce publiée.</div>`;
  return entries.map((item) => {
    const author = getUserById(item.authorId);
    return `<article class="feed-item"><h3>${escapeHtml(item.title)}</h3><p class="meta">${escapeHtml(item.body)}</p><div class="tiny">${formatDate(item.createdAt)} · ${escapeHtml(author?.name || "ADSL-2EF")}</div></article>`;
  }).join("");
}

function renderMessagesForUser(userId) {
  const entries = state.messages.filter((item) => item.toUserId === userId).slice(0, 4);
  if (!entries.length) return `<div class="empty-state">Aucun message.</div>`;
  return entries.map((item) => {
    const author = getUserById(item.fromUserId);
    return `<article class="feed-item"><div class="toolbar" style="justify-content:space-between"><h3>${escapeHtml(item.subject)}</h3><span class="badge ${item.read ? "success" : "warning"}">${item.read ? "Lu" : "Nouveau"}</span></div><p class="meta">${escapeHtml(item.content)}</p><div class="tiny">${escapeHtml(author?.name || "Système")} · ${formatDate(item.createdAt)}</div></article>`;
  }).join("");
}

function getMessageRecipients(currentUser, courseId = "") {
  if (!currentUser) return [];
  const course = courseId ? getCourseById(courseId) : null;
  if (course) {
    const recipientIds = new Set();
    if (course.teacherId && course.teacherId !== currentUser.id) recipientIds.add(course.teacherId);
    if (currentUser.role !== "student") {
      course.enrolledUserIds.forEach((userId) => {
        if (userId !== currentUser.id) recipientIds.add(userId);
      });
    }
    return state.users.filter((user) => recipientIds.has(user.id));
  }
  if (currentUser.role === "student") {
    const teacherIds = new Set(
      state.courses
        .filter((item) => item.enrolledUserIds.includes(currentUser.id) && item.teacherId && item.teacherId !== currentUser.id)
        .map((item) => item.teacherId)
    );
    return state.users.filter((user) => teacherIds.has(user.id));
  }
  return state.users.filter((user) => user.id !== currentUser.id);
}

function renderResourceAction(courseId, moduleId, lessonId, resource) {
  return `<button class="btn-ghost" onclick="openLessonResource('${courseId}','${moduleId}','${lessonId}','${resource.id}')">Ouvrir</button>`;
}

function renderStudentCommunication(user) {
  const enrolledCourseIds = state.courses
    .filter((course) => course.enrolledUserIds.includes(user.id))
    .map((course) => course.id);
  const firstCourseId = enrolledCourseIds[0] || "";
  const recentThreads = state.forumThreads
    .filter((thread) => enrolledCourseIds.includes(thread.courseId))
    .slice(0, 4);
  return `
    <section class="dashboard-grid" style="margin-top:18px">
      <div class="panel">
        <div class="toolbar" style="justify-content:space-between">
          <div>
            <h2 class="section-title">Communication</h2>
            <p class="section-subtitle">Retrouvez vos messages internes et les échanges pédagogiques de vos cours.</p>
          </div>
          <button class="btn-ghost" onclick="openMessageComposer('', '${firstCourseId}')">Nouveau message</button>
        </div>
        <div class="feed-list" style="margin-top:18px">${renderMessagesForUser(user.id)}</div>
      </div>
      <div class="panel">
        <h2 class="section-title">Discussions de cours</h2>
        <div class="feed-list" style="margin-top:18px">
          ${recentThreads.length ? recentThreads.map((thread) => {
            const course = getCourseById(thread.courseId);
            const author = getUserById(thread.createdBy);
            return `<article class="feed-item"><div class="toolbar" style="justify-content:space-between"><div><h3>${escapeHtml(thread.title)}</h3><p class="meta">${escapeHtml(course?.title || "Cours")}</p></div><button class="btn-ghost" onclick="openForumThreadModal('${thread.id}')">Ouvrir</button></div><div class="tiny">${thread.posts.length} message(s) · ${escapeHtml(author?.name || "ADSL-2EF")}</div></article>`;
          }).join("") : `<div class="empty-state">Aucune discussion disponible dans vos cours.</div>`}
        </div>
      </div>
    </section>
  `;
}

function renderUpcomingEvents(user) {
  const activities = state.activities.filter((activity) => {
    const course = getCourseById(activity.courseId);
    if (user.role === "student") return course?.enrolledUserIds.includes(user.id);
    if (user.role === "teacher") return course?.teacherId === user.id;
    return true;
  }).slice(0, 5);
  if (!activities.length) return `<div class="empty-state">Aucun événement à venir.</div>`;
  return activities.map((activity) => {
    const late = user.role === "student" ? isActivityOverdue(activity, user.id) : isActivityOverdue(activity);
    return `<article class="module-card"><strong>${escapeHtml(activity.title)}</strong><div class="meta">${escapeHtml(getCourseById(activity.courseId)?.title || "")}</div><div class="tiny">Échéance : ${formatDate(activity.dueDate)}${late ? " · En retard" : ""}</div></article>`;
  }).join("");
}

function renderCourseForums(courseId) {
  const threads = state.forumThreads.filter((thread) => thread.courseId === courseId).slice(0, 3);
  if (!threads.length) return `<div class="empty-state">Aucune discussion pour ce cours.</div>`;
  return threads.map((thread) => {
    const author = getUserById(thread.createdBy);
    const lastPost = thread.posts[thread.posts.length - 1];
    return `
      <article class="feed-item">
        <div class="toolbar" style="justify-content:space-between">
          <div>
            <h3>${escapeHtml(thread.title)}</h3>
            <div class="meta">${thread.posts.length} message(s) · lancé par ${escapeHtml(author?.name || "ADSL-2EF")}</div>
          </div>
          <button class="btn-ghost" onclick="openForumThreadModal('${thread.id}')">Ouvrir</button>
        </div>
        <div class="tiny">${lastPost ? `Dernière réponse le ${formatDate(lastPost.createdAt)}` : "Aucune réponse pour le moment."}</div>
      </article>
    `;
  }).join("");
}

function renderAttendanceSummary(course, user) {
  const sessions = getAttendanceForCourse(course.id);
  if (!sessions.length) return `<div class="empty-state">Aucune séance d'assiduité enregistrée.</div>`;
  if (user.role === "student") {
    const rate = computeAttendanceRate(course.id, user.id);
    return `
      <div class="simple-list">
        <div class="module-card"><strong>Taux de présence</strong><div class="meta">${rate === null ? "Non disponible" : `${rate}%`}</div></div>
        ${sessions.slice(0, 4).map((session) => {
          const record = session.records.find((item) => item.userId === user.id);
          return `<div class="module-card"><strong>${escapeHtml(session.title)}</strong><div class="meta">${formatDate(session.sessionDate)} · ${escapeHtml(record?.status || "Non renseigné")}</div></div>`;
        }).join("")}
      </div>
    `;
  }
  return `
    <div class="simple-list">
      ${sessions.slice(0, 4).map((session) => `
        <div class="module-card">
          <strong>${escapeHtml(session.title)}</strong>
          <div class="meta">${formatDate(session.sessionDate)} · ${session.records.filter((item) => item.status === "present").length}/${session.records.length} présents</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderGradebookTable(user) {
  const courses = user.role === "student" ? getVisibleCoursesForUser(user) : state.courses;
  if (!courses.length) return `<div class="empty-state">Aucune donnée de notes disponible.</div>`;
  const rows = user.role === "student"
    ? courses.map((course) => {
        const avg = computeAverageForCourse(course.id, user.id);
        return `<tr><td>${escapeHtml(course.title)}</td><td>${computeCourseProgress(course, user.id)}%</td><td>${avg === null ? "—" : `${avg}%`}</td><td>${courseCompletionStatus(course, user.id)}</td></tr>`;
      }).join("")
    : courses.map((course) => {
        const learners = course.enrolledUserIds.length;
        const graded = state.submissions.filter((submission) => {
          const activity = getActivityById(submission.activityId);
          return activity?.courseId === course.id && typeof submission.score === "number";
        });
        const avg = graded.length
          ? Math.round(graded.reduce((sum, submission) => sum + (submission.score / Math.max(submission.maxPoints || 1, 1)) * 100, 0) / graded.length)
          : null;
        return `<tr><td>${escapeHtml(course.title)}</td><td>${learners}</td><td>${avg === null ? "—" : `${avg}%`}</td><td>${getActivitiesForCourse(course.id).length}</td></tr>`;
      }).join("");
  return `
    <table>
      <thead>
        <tr>${user.role === "student" ? "<th>Cours</th><th>Progression</th><th>Moyenne</th><th>État</th>" : "<th>Cours</th><th>Inscrits</th><th>Moyenne</th><th>Activités</th>"}</tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function exportGradebook(user = getCurrentUser()) {
  const rows = [];
  if (user.role === "student") {
    getVisibleCoursesForUser(user).forEach((course) => {
      rows.push([
        course.title,
        `${computeCourseProgress(course, user.id)}%`,
        computeAverageForCourse(course.id, user.id) ?? "",
        courseCompletionStatus(course, user.id)
      ].join(";"));
    });
    downloadCsv("carnet_notes_apprenant.csv", ["Cours;Progression;Moyenne;Etat", ...rows].join("\n"));
    return;
  }
  state.courses.forEach((course) => {
    course.enrolledUserIds.forEach((userId) => {
      const learner = getUserById(userId);
      rows.push([
        course.title,
        learner?.name || "",
        learner?.email || "",
        computeAverageForCourse(course.id, userId) ?? "",
        computeAttendanceRate(course.id, userId) ?? "",
        computeCourseProgress(course, userId)
      ].join(";"));
    });
  });
  downloadCsv("carnet_notes_global.csv", ["Cours;Apprenant;Email;Moyenne;Assiduite;Progression", ...rows].join("\n"));
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadText(filename, content, mime = "text/plain;charset=utf-8;") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeSqlString(value) {
  return String(value ?? "").replaceAll("'", "''");
}

function toSqlValue(value, type = "text") {
  if (value === null || value === undefined || value === "") return "null";
  if (type === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? String(n) : "null";
  }
  if (type === "boolean") return value ? "true" : "false";
  if (type === "json") return `'${escapeSqlString(JSON.stringify(value ?? null))}'::jsonb`;
  if (type === "timestamp") return `'${escapeSqlString(value)}'::timestamptz`;
  return `'${escapeSqlString(value)}'`;
}

function buildUpsertSql(table, columns, rows, conflictColumns = ["id"], updateColumns = []) {
  if (!rows.length) return "";
  const updates = (updateColumns.length ? updateColumns : columns.filter((column) => !conflictColumns.includes(column)))
    .map((column) => `${column} = excluded.${column}`)
    .join(",\n    ");
  return [
    `insert into public.${table} (${columns.join(", ")})`,
    "values",
    rows.map((row) => `  (${columns.map((column) => row[column] ?? "null").join(", ")})`).join(",\n"),
    `on conflict (${conflictColumns.join(", ")}) do update set`,
    `    ${updates};`
  ].join("\n");
}

function generateSupabaseSeedSql() {
  const profileRows = state.users.map((user) => ({
    id: toSqlValue(user.id),
    auth_user_id: "null",
    full_name: toSqlValue(user.name),
    email: toSqlValue(user.email),
    role: toSqlValue(user.role),
    bio: toSqlValue(user.bio || ""),
    avatar: toSqlValue(user.avatar || initials(user.name)),
    created_at: toSqlValue(user.createdAt || nowISO(), "timestamp"),
    updated_at: "now()"
  }));
  const courseRows = state.courses.map((course) => ({
    id: toSqlValue(course.id),
    title: toSqlValue(course.title),
    category: toSqlValue(course.category),
    catalog_type: toSqlValue(course.catalogType || "school"),
    description: toSqlValue(course.description || ""),
    image_url: toSqlValue(course.image || ""),
    teacher_profile_id: toSqlValue(course.teacherId),
    status: toSqlValue(course.status || "published"),
    audience: toSqlValue(course.audience || ""),
    duration_label: toSqlValue(course.duration || ""),
    price: toSqlValue(course.price || 0, "number"),
    pricing_label: toSqlValue(course.pricingLabel || ""),
    sales_tag: toSqlValue(course.salesTag || ""),
    selling_points: toSqlValue(course.sellingPoints || [], "json"),
    created_at: toSqlValue(course.createdAt || nowISO(), "timestamp"),
    updated_at: "now()"
  }));
  const moduleRows = state.courses.flatMap((course) => course.modules.map((module, index) => ({
    id: toSqlValue(module.id),
    course_id: toSqlValue(course.id),
    title: toSqlValue(module.title),
    summary: toSqlValue(module.summary || ""),
    position: toSqlValue(module.order || index + 1, "number"),
    created_at: toSqlValue(module.createdAt || nowISO(), "timestamp")
  })));
  const lessonRows = state.courses.flatMap((course) => course.modules.flatMap((module) => (module.lessons || []).map((lesson, index) => ({
    id: toSqlValue(lesson.id),
    module_id: toSqlValue(module.id),
    title: toSqlValue(lesson.title),
    lesson_type: toSqlValue(lesson.type || "reading"),
    duration_label: toSqlValue(lesson.duration || ""),
    content: toSqlValue(lesson.content || ""),
    position: toSqlValue(lesson.order || index + 1, "number"),
    created_at: toSqlValue(lesson.createdAt || nowISO(), "timestamp")
  }))));
  const resourceRows = state.courses.flatMap((course) => course.modules.flatMap((module) => (module.lessons || []).flatMap((lesson) => (lesson.resources || []).map((resource) => ({
    id: toSqlValue(resource.id),
    lesson_id: toSqlValue(lesson.id),
    title: toSqlValue(resource.title),
    resource_type: toSqlValue(resource.type || "link"),
    url: toSqlValue(resource.url || ""),
    created_at: toSqlValue(resource.createdAt || nowISO(), "timestamp")
  })))));
  const enrollmentRows = state.courses.flatMap((course) => (course.enrolledUserIds || []).map((userId) => ({
    id: toSqlValue(crypto.randomUUID()),
    course_id: toSqlValue(course.id),
    profile_id: toSqlValue(userId),
    status: toSqlValue("active"),
    enrolled_at: toSqlValue(nowISO(), "timestamp")
  })));
  const activityRows = state.activities.map((activity) => ({
    id: toSqlValue(activity.id),
    course_id: toSqlValue(activity.courseId),
    module_id: toSqlValue(activity.moduleId),
    lesson_id: toSqlValue(activity.lessonId),
    activity_type: toSqlValue(activity.type),
    title: toSqlValue(activity.title),
    description: toSqlValue(activity.description || ""),
    due_at: toSqlValue(activity.dueDate, "timestamp"),
    time_limit_minutes: toSqlValue(activity.timeLimitMinutes, "number"),
    attempts_allowed: toSqlValue(activity.attemptsAllowed || 1, "number"),
    passing_score: toSqlValue(activity.passingScore || 50, "number"),
    max_points: toSqlValue(activity.maxPoints || 20, "number"),
    weight: toSqlValue(activity.weight || 1, "number"),
    status: toSqlValue(activity.status || "published"),
    created_by: toSqlValue(activity.createdBy),
    created_at: toSqlValue(activity.createdAt || nowISO(), "timestamp"),
    updated_at: "now()"
  }));
  const questionBankRows = state.questionBank.map((question) => ({
    id: toSqlValue(question.id),
    course_id: toSqlValue(question.courseId),
    kind: toSqlValue(question.kind || "mcq"),
    prompt: toSqlValue(question.prompt || ""),
    options: toSqlValue(question.options || [], "json"),
    answer: toSqlValue(question.answer || ""),
    points: toSqlValue(question.points || 1, "number"),
    created_at: toSqlValue(question.createdAt || nowISO(), "timestamp")
  }));
  const activityQuestionRows = state.activities.flatMap((activity) => (activity.questions || []).map((question, index) => ({
    id: toSqlValue(question.id),
    activity_id: toSqlValue(activity.id),
    question_bank_id: toSqlValue(question.questionBankId),
    kind: toSqlValue(question.kind || "mcq"),
    prompt: toSqlValue(question.prompt || ""),
    options: toSqlValue(question.options || [], "json"),
    answer: toSqlValue(question.answer || ""),
    points: toSqlValue(question.points || 1, "number"),
    position: toSqlValue(index + 1, "number")
  })));
  const submissionRows = state.submissions.map((submission) => ({
    id: toSqlValue(submission.id),
    activity_id: toSqlValue(submission.activityId),
    profile_id: toSqlValue(submission.userId),
    status: toSqlValue(submission.status || "submitted"),
    score: toSqlValue(submission.score, "number"),
    max_points: toSqlValue(submission.maxPoints, "number"),
    text_answer: toSqlValue(submission.text || ""),
    file_name: toSqlValue(submission.fileName || ""),
    file_url: toSqlValue(submission.fileUrl || ""),
    answers: toSqlValue(submission.answers || [], "json"),
    feedback: toSqlValue(submission.feedback || ""),
    submitted_at: toSqlValue(submission.submittedAt || nowISO(), "timestamp"),
    reviewed_at: toSqlValue(submission.reviewedAt, "timestamp")
  }));
  const completionRows = state.completionRecords.map((record) => ({
    id: toSqlValue(record.id),
    course_id: toSqlValue(record.courseId),
    module_id: toSqlValue(record.moduleId),
    lesson_id: toSqlValue(record.lessonId),
    profile_id: toSqlValue(record.userId),
    completed_at: toSqlValue(record.completedAt || nowISO(), "timestamp")
  }));
  const certificateRows = state.certificateRecords.map((record) => ({
    id: toSqlValue(record.id),
    course_id: toSqlValue(record.courseId),
    profile_id: toSqlValue(record.userId),
    issued_at: toSqlValue(record.issuedAt || nowISO(), "timestamp"),
    progress_percent: toSqlValue(record.progress || 100, "number"),
    average_percent: toSqlValue(record.average, "number")
  }));
  const announcementRows = state.announcements.map((announcement) => ({
    id: toSqlValue(announcement.id),
    course_id: toSqlValue(announcement.courseId),
    author_profile_id: toSqlValue(announcement.authorId),
    title: toSqlValue(announcement.title),
    body: toSqlValue(announcement.body || ""),
    created_at: toSqlValue(announcement.createdAt || nowISO(), "timestamp")
  }));
  const messageRows = state.messages.map((message) => ({
    id: toSqlValue(message.id),
    from_profile_id: toSqlValue(message.fromUserId),
    to_profile_id: toSqlValue(message.toUserId),
    subject: toSqlValue(message.subject || ""),
    content: toSqlValue(message.content || ""),
    related_course_id: toSqlValue(message.courseId),
    is_read: toSqlValue(Boolean(message.read), "boolean"),
    created_at: toSqlValue(message.createdAt || nowISO(), "timestamp")
  }));
  const forumThreadRows = state.forumThreads.map((thread) => ({
    id: toSqlValue(thread.id),
    course_id: toSqlValue(thread.courseId),
    title: toSqlValue(thread.title),
    created_by: toSqlValue(thread.createdBy),
    created_at: toSqlValue(thread.createdAt || nowISO(), "timestamp")
  }));
  const forumPostRows = state.forumThreads.flatMap((thread) => (thread.posts || []).map((post) => ({
    id: toSqlValue(post.id),
    thread_id: toSqlValue(thread.id),
    author_profile_id: toSqlValue(post.authorId),
    content: toSqlValue(post.content || ""),
    created_at: toSqlValue(post.createdAt || nowISO(), "timestamp")
  })));
  const attendanceSessionRows = state.attendanceSessions.map((session) => ({
    id: toSqlValue(session.id),
    course_id: toSqlValue(session.courseId),
    title: toSqlValue(session.title),
    session_date: toSqlValue(session.sessionDate || nowISO(), "timestamp"),
    created_by: toSqlValue(session.createdBy),
    created_at: toSqlValue(session.createdAt || nowISO(), "timestamp")
  }));
  const attendanceRecordRows = state.attendanceSessions.flatMap((session) => (session.records || []).map((record) => ({
    id: toSqlValue(crypto.randomUUID()),
    session_id: toSqlValue(session.id),
    profile_id: toSqlValue(record.userId),
    status: toSqlValue(record.status || "present"),
    note: toSqlValue(record.note || "")
  })));
  const notificationRows = state.notifications.map((notification) => ({
    id: toSqlValue(notification.id),
    profile_id: toSqlValue(notification.userId),
    title: toSqlValue(notification.title),
    message: toSqlValue(notification.message || ""),
    level: toSqlValue(notification.level || "primary"),
    is_read: toSqlValue(Boolean(notification.read), "boolean"),
    created_at: toSqlValue(notification.createdAt || nowISO(), "timestamp")
  }));
  const auditRows = state.activityLog.map((item) => ({
    id: toSqlValue(item.id),
    actor_profile_id: toSqlValue(item.userId),
    action: toSqlValue(item.label || ""),
    target_type: toSqlValue("activity_log"),
    target_id: "null",
    payload: toSqlValue({ label: item.label || "" }, "json"),
    created_at: toSqlValue(item.createdAt || nowISO(), "timestamp")
  }));

  return [
    "-- ADSL-2EF LMS seed for Supabase",
    "-- Execute after schema.sql and storage.sql",
    "",
    buildUpsertSql("profiles", ["id", "auth_user_id", "full_name", "email", "role", "bio", "avatar", "created_at", "updated_at"], profileRows),
    buildUpsertSql("courses", ["id", "title", "category", "catalog_type", "description", "image_url", "teacher_profile_id", "status", "audience", "duration_label", "price", "pricing_label", "sales_tag", "selling_points", "created_at", "updated_at"], courseRows),
    buildUpsertSql("course_modules", ["id", "course_id", "title", "summary", "position", "created_at"], moduleRows),
    buildUpsertSql("lessons", ["id", "module_id", "title", "lesson_type", "duration_label", "content", "position", "created_at"], lessonRows),
    buildUpsertSql("lesson_resources", ["id", "lesson_id", "title", "resource_type", "url", "created_at"], resourceRows),
    buildUpsertSql("enrollments", ["id", "course_id", "profile_id", "status", "enrolled_at"], enrollmentRows, ["course_id", "profile_id"], ["status", "enrolled_at"]),
    buildUpsertSql("activities", ["id", "course_id", "module_id", "lesson_id", "activity_type", "title", "description", "due_at", "time_limit_minutes", "attempts_allowed", "passing_score", "max_points", "weight", "status", "created_by", "created_at", "updated_at"], activityRows),
    buildUpsertSql("question_bank", ["id", "course_id", "kind", "prompt", "options", "answer", "points", "created_at"], questionBankRows),
    buildUpsertSql("activity_questions", ["id", "activity_id", "question_bank_id", "kind", "prompt", "options", "answer", "points", "position"], activityQuestionRows),
    buildUpsertSql("submissions", ["id", "activity_id", "profile_id", "status", "score", "max_points", "text_answer", "file_name", "file_url", "answers", "feedback", "submitted_at", "reviewed_at"], submissionRows),
    buildUpsertSql("completion_records", ["id", "course_id", "module_id", "lesson_id", "profile_id", "completed_at"], completionRows),
    buildUpsertSql("certificate_records", ["id", "course_id", "profile_id", "issued_at", "progress_percent", "average_percent"], certificateRows, ["course_id", "profile_id"], ["issued_at", "progress_percent", "average_percent"]),
    buildUpsertSql("announcements", ["id", "course_id", "author_profile_id", "title", "body", "created_at"], announcementRows),
    buildUpsertSql("messages", ["id", "from_profile_id", "to_profile_id", "subject", "content", "related_course_id", "is_read", "created_at"], messageRows),
    buildUpsertSql("forum_threads", ["id", "course_id", "title", "created_by", "created_at"], forumThreadRows),
    buildUpsertSql("forum_posts", ["id", "thread_id", "author_profile_id", "content", "created_at"], forumPostRows),
    buildUpsertSql("attendance_sessions", ["id", "course_id", "title", "session_date", "created_by", "created_at"], attendanceSessionRows),
    buildUpsertSql("attendance_records", ["id", "session_id", "profile_id", "status", "note"], attendanceRecordRows, ["session_id", "profile_id"], ["status", "note"]),
    buildUpsertSql("notifications", ["id", "profile_id", "title", "message", "level", "is_read", "created_at"], notificationRows),
    buildUpsertSql("audit_logs", ["id", "actor_profile_id", "action", "target_type", "target_id", "payload", "created_at"], auditRows)
  ].filter(Boolean).join("\n\n");
}

function exportSupabaseSeedSql() {
  const sql = generateSupabaseSeedSql();
  downloadText("adsl2ef_supabase_seed.sql", sql, "text/sql;charset=utf-8;");
  openModal(`
    <h2>Export SQL prêt</h2>
    <p class="section-subtitle">Le fichier <strong>adsl2ef_supabase_seed.sql</strong> a été téléchargé. Exécutez-le dans le SQL Editor de Supabase pour injecter les données initiales du site.</p>
  `);
}

function renderCourseReport(course) {
  const submissions = state.submissions.filter((submission) => {
    const activity = getActivityById(submission.activityId);
    return activity?.courseId === course.id;
  });
  const graded = submissions.filter((submission) => typeof submission.score === "number");
  const attendance = getAttendanceForCourse(course.id);
  const threads = state.forumThreads.filter((thread) => thread.courseId === course.id);
  const average = graded.length
    ? Math.round(graded.reduce((sum, submission) => sum + (submission.score / Math.max(submission.maxPoints || 1, 1)) * 100, 0) / graded.length)
    : 0;
  const completionRates = course.enrolledUserIds
    .map((userId) => computeCourseProgress(course, userId))
    .filter((value) => Number.isFinite(value));
  const completionAverage = completionRates.length
    ? Math.round(completionRates.reduce((sum, value) => sum + value, 0) / completionRates.length)
    : 0;
  return `
    <div class="dashboard-grid" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-top:18px">
      ${metricCard("Inscrits", course.enrolledUserIds.length, "Cohorte active")}
      ${metricCard("Achèvement", `${completionAverage}%`, "Progression moyenne")}
      ${metricCard("Activités", getActivitiesForCourse(course.id).length, "Quiz et devoirs")}
      ${metricCard("Soumissions", submissions.length, "Travaux reçus")}
      ${metricCard("Moyenne", `${average}%`, "Sur les copies notées")}
      ${metricCard("Présences", attendance.length, "Séances enregistrées")}
      ${metricCard("Forums", threads.length, "Discussions ouvertes")}
    </div>
  `;
}

async function openCertificateModal(courseId, userId) {
  const course = getCourseById(courseId);
  const learner = getUserById(userId);
  const average = computeAverageForCourse(courseId, userId);
  const progress = computeCourseProgress(course, userId);
  if (!course || !learner) return;
  const certificate = await ensureCertificateRecord(courseId, userId);
  openModal(`
    <div class="certificate-card">
      <p class="eyebrow">Certificat ADSL-2EF</p>
      <h2>Attestation de suivi</h2>
      <p>ADSL-2EF atteste que <strong>${escapeHtml(learner.name)}</strong> a suivi le parcours <strong>${escapeHtml(course.title)}</strong>.</p>
      <div class="dashboard-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:18px">
        <div class="module-card"><strong>Progression</strong><div class="meta">${progress}%</div></div>
        <div class="module-card"><strong>Moyenne</strong><div class="meta">${average === null ? "Non disponible" : `${average}%`}</div></div>
      </div>
      <p class="tiny" style="margin-top:18px">Document généré le ${formatDate(certificate?.issuedAt || nowISO())}.</p>
    </div>
  `);
}

function renderActivitySummaryCard(activity) {
  const course = getCourseById(activity.courseId);
  const currentUser = getCurrentUser();
  const late = currentUser?.role === "student" ? isActivityOverdue(activity, currentUser.id) : false;
  const quizMeta = activity.type === "quiz"
    ? `<div class="tiny">${activity.questions?.length || 0} question(s) · ${activity.attemptsAllowed || 1} tentative(s)</div>`
    : "";
  return `
    <article class="activity-card">
      <div class="toolbar" style="justify-content:space-between">
        <span class="badge ${activity.type === "quiz" ? "primary" : "warning"}">${activity.type === "quiz" ? "Quiz" : "Devoir"}</span>
        <span class="tiny">Échéance ${formatDate(activity.dueDate)}${late ? " · En retard" : ""}</span>
      </div>
      <h3>${escapeHtml(activity.title)}</h3>
      <p class="meta">${escapeHtml(activity.description)}</p>
      ${quizMeta}
      <div class="toolbar" style="justify-content:space-between">
        <span class="tiny">${escapeHtml(course?.title || "")}</span>
        <div class="toolbar">
          <button class="btn-primary" onclick="openActivity('${activity.id}')">Ouvrir</button>
          ${canTeachCourse(currentUser, course) ? `<button class="btn-ghost" onclick="openActivityEditor('${activity.id}')">Modifier</button>` : ""}
        </div>
      </div>
    </article>
  `;
}

function renderSubmissionCard(submission) {
  const user = getUserById(submission.userId);
  const activity = getActivityById(submission.activityId);
  const late = activity ? isActivityOverdue(activity, submission.userId) : false;
  return `
    <article class="submission-row">
      <div class="toolbar" style="justify-content:space-between">
        <div>
          <h3>${escapeHtml(activity?.title || "Activité")}</h3>
          <p class="meta">${escapeHtml(user?.name || "")} · ${formatDate(submission.submittedAt)}</p>
          <div class="tiny">${late ? "Soumission en retard" : "Soumission dans les délais"}${submission.fileName ? ` · Pièce jointe : ${escapeHtml(submission.fileName)}` : ""}</div>
        </div>
        <button class="btn-primary" onclick="openReviewModal('${submission.id}')">Corriger</button>
      </div>
    </article>
  `;
}

function renderUserMetrics(user) {
  const courses = getVisibleCoursesForUser(user);
  const submissions = state.submissions.filter((item) => item.userId === user.id);
  const unread = state.notifications.filter((item) => item.userId === user.id && !item.read).length;
  const graded = submissions.filter((item) => typeof item.score === "number");
  const average = graded.length
    ? Math.round(graded.reduce((sum, item) => sum + (item.score / Math.max(item.maxPoints || 1, 1)) * 100, 0) / graded.length)
    : 0;
  return [
    metricCard("Cours visibles", courses.length, "Catalogue ou portefeuille"),
    metricCard("Soumissions", submissions.length, "Travaux et quiz"),
    metricCard("Moyenne", `${average}%`, "Résultats notés"),
    metricCard("Alertes", unread, "Notifications non lues")
  ].join("");
}

function renderDashboardHeader(user) {
  return `
    <section class="hero" style="margin-bottom:18px">
      <div class="hero-panel hero-gradient">
        <p class="eyebrow">${roleLabels[user.role]}</p>
        <h2 class="hero-title">Bonjour ${escapeHtml(user.name.split(" ")[0])}, votre espace est prêt.</h2>
        <p class="hero-text">La plateforme centralise les parcours, les évaluations, les contenus et le pilotage. Chaque section affichée ci-dessous correspond à votre profil et à vos autorisations.</p>
        <div class="hero-actions">
          ${user.role === "student" ? `<button class="btn-accent" onclick="focusFirstStudentCourse()">Reprendre mon parcours</button>` : ""}
          ${user.role === "teacher" ? `<button class="btn-accent" onclick="openCourseBuilder()">Ajouter un nouveau cours</button>` : ""}
          ${user.role === "admin" ? `<button class="btn-accent" onclick="openPlatformSettings()">Configurer le site</button>` : ""}
          <button class="btn-ghost" onclick="markAllNotificationsRead('${user.id}')">Marquer les notifications comme lues</button>
        </div>
      </div>
      <div class="hero-panel">
        <p class="eyebrow">Compte</p>
        <h3>${escapeHtml(user.name)}</h3>
        <p class="section-subtitle">${escapeHtml(user.bio || "Profil sans biographie.")}</p>
        <div class="summary-grid" style="margin-top:18px">${renderUserMetrics(user)}</div>
      </div>
    </section>
  `;
}

function renderStudentCourseCard(course, user) {
  const progress = computeCourseProgress(course, user.id);
  const metrics = getCourseCompletionMetrics(course, user.id);
  const teacher = getUserById(course.teacherId);
  const overdueCount = getCourseOverdueCount(course, user.id);
  return `
    <article class="course-card">
      <div class="course-cover" style="background-image:url('${escapeHtml(course.image)}')"><span>${escapeHtml(course.audience)}</span></div>
      <h3>${escapeHtml(course.title)}</h3>
      <p class="meta">${escapeHtml(course.description)}</p>
      <div class="progress"><span style="width:${progress}%"></span></div>
      <div class="toolbar" style="justify-content:space-between">
        <span class="tiny">${progress}% complété</span>
        <span class="tiny">${escapeHtml(teacher?.name || "")}</span>
      </div>
      <div class="tiny" style="margin-top:8px">${metrics.completedLessons}/${metrics.totalLessons} leçon(s) · ${metrics.completedActivities}/${metrics.totalActivities} activité(s)${overdueCount ? ` · ${overdueCount} en retard` : ""}</div>
      <div class="toolbar" style="justify-content:space-between;margin-top:12px">
        <span class="badge primary">${course.modules.length} modules</span>
        <div class="toolbar">
          <button class="btn-ghost" onclick="openMessageComposer('${teacher?.id || ""}','${course.id}')">Contacter l'enseignant</button>
          <button class="btn-primary" onclick="openCourse('${course.id}')">Ouvrir</button>
        </div>
      </div>
    </article>
  `;
}

function renderStudentDashboard(user) {
  const courses = getVisibleCoursesForUser(user);
  const pendingActivities = state.activities.filter((activity) => {
    const course = getCourseById(activity.courseId);
    return course?.enrolledUserIds.includes(user.id) && !getUserSubmission(activity.id, user.id);
  });
  const gradedSubmissions = state.submissions.filter((submission) => submission.userId === user.id && typeof submission.score === "number");
  return `
    <section class="panel">
      <div class="toolbar" style="justify-content:space-between">
        <div>
          <h2 class="section-title">Mes cours</h2>
          <p class="section-subtitle">Suivez votre progression, reprenez votre parcours et accédez rapidement à vos modules.</p>
        </div>
        <button class="btn-primary" onclick="openEnrollmentModal()">S'inscrire à un cours</button>
      </div>
      <div class="course-grid" style="margin-top:18px">
        ${courses.length ? courses.map((course) => renderStudentCourseCard(course, user)).join("") : `<div class="empty-state">Aucun cours inscrit pour le moment.</div>`}
      </div>
    </section>
    <section class="dashboard-grid" style="margin-top:18px">
      <div class="panel">
        <h2 class="section-title">Activités à réaliser</h2>
        <div class="activity-grid" style="grid-template-columns:1fr;margin-top:18px">
          ${pendingActivities.length ? pendingActivities.map(renderActivitySummaryCard).join("") : `<div class="empty-state">Aucune activité en attente.</div>`}
        </div>
      </div>
      <div class="panel">
        <h2 class="section-title">Historique récent</h2>
        <div class="feed-list" style="margin-top:18px">${renderActivityFeed(user.id)}</div>
      </div>
    </section>
    <section class="dashboard-grid" style="margin-top:18px">
      <div class="panel">
        <h2 class="section-title">Calendrier</h2>
        <div class="simple-list" style="margin-top:18px">${renderUpcomingEvents(user)}</div>
      </div>
      <div class="panel">
        <h2 class="section-title">Annonces rapides</h2>
        <div class="feed-list" style="margin-top:18px">${renderAnnouncements()}</div>
      </div>
    </section>
    ${renderStudentCommunication(user)}
    <section class="dashboard-grid" style="margin-top:18px">
      <div class="panel">
        <h2 class="section-title">Notes et évaluations</h2>
        <div class="feed-list" style="margin-top:18px">
          ${gradedSubmissions.length ? gradedSubmissions.slice(0, 5).map((submission) => {
            const activity = getActivityById(submission.activityId);
            return `<article class="feed-item"><h3>${escapeHtml(activity?.title || "Évaluation")}</h3><p class="meta">Résultat : ${submission.score}/${submission.maxPoints}</p><div class="tiny">${formatDate(submission.reviewedAt || submission.submittedAt)}</div></article>`;
          }).join("") : `<div class="empty-state">Aucune note publiée pour le moment.</div>`}
        </div>
      </div>
      <div class="panel">
        <h2 class="section-title">Annonces</h2>
        <div class="feed-list" style="margin-top:18px">${renderAnnouncements()}</div>
      </div>
    </section>
    <section class="dashboard-grid" style="margin-top:18px">
      <div class="panel">
        <h2 class="section-title">Carnet de notes</h2>
        <div class="toolbar" style="justify-content:flex-end;margin-top:12px">
          <button class="btn-ghost" onclick="exportGradebook()">Exporter</button>
        </div>
        <div class="table-card" style="margin-top:18px">${renderGradebookTable(user)}</div>
      </div>
      <div class="panel">
        <h2 class="section-title">Certificats</h2>
        <div class="feed-list" style="margin-top:18px">
          ${courses.length ? courses.map((course) => {
            const progress = computeCourseProgress(course, user.id);
            const avg = computeAverageForCourse(course.id, user.id);
            return `<article class="feed-item"><h3>${escapeHtml(course.title)}</h3><p class="meta">${progress}% de progression · ${avg === null ? "Moyenne non disponible" : `Moyenne ${avg}%`}</p><div class="toolbar" style="margin-top:12px"><button class="btn-ghost" ${progress < 100 ? "disabled" : ""} onclick="openCertificateModal('${course.id}','${user.id}')">Voir le certificat</button></div></article>`;
          }).join("") : `<div class="empty-state">Aucun certificat disponible.</div>`}
        </div>
      </div>
    </section>
    <section class="dashboard-grid" style="margin-top:18px">
      <div class="panel">
        <h2 class="section-title">Forums de cours</h2>
        <div class="feed-list" style="margin-top:18px">
          ${courses.length ? courses.slice(0, 3).map((course) => `
            <article class="feed-item">
              <div class="toolbar" style="justify-content:space-between">
                <div>
                  <h3>${escapeHtml(course.title)}</h3>
                  <p class="meta">${state.forumThreads.filter((thread) => thread.courseId === course.id).length} discussion(s) ouverte(s)</p>
                </div>
                <button class="btn-ghost" onclick="openCourse('${course.id}')">Voir</button>
              </div>
            </article>
          `).join("") : `<div class="empty-state">Aucun forum disponible.</div>`}
        </div>
      </div>
      <div class="panel">
        <h2 class="section-title">Assiduité</h2>
        <div class="feed-list" style="margin-top:18px">
          ${courses.length ? courses.slice(0, 3).map((course) => `<article class="feed-item"><h3>${escapeHtml(course.title)}</h3><p class="meta">Présence : ${computeAttendanceRate(course.id, user.id) ?? "Non disponible"}${computeAttendanceRate(course.id, user.id) === null ? "" : "%"}</p><div class="tiny">${getAttendanceForCourse(course.id).length} séance(s) suivie(s)</div></article>`).join("") : `<div class="empty-state">Aucune donnée d'assiduité.</div>`}
        </div>
      </div>
    </section>
  `;
}

function renderTeacherCourseCard(course) {
  const activities = getActivitiesForCourse(course.id);
  return `
    <article class="course-card">
      <div class="course-cover" style="background-image:url('${escapeHtml(course.image)}')"><span>${escapeHtml(course.status)}</span></div>
      <h3>${escapeHtml(course.title)}</h3>
      <p class="meta">${escapeHtml(course.description)}</p>
      <div class="badge-row">
        <span class="badge primary">${course.modules.length} modules</span>
        <span class="badge success">${course.enrolledUserIds.length} inscrits</span>
        <span class="badge warning">${activities.length} activités</span>
      </div>
      <div class="toolbar" style="justify-content:space-between;margin-top:12px">
        <button class="btn-primary" onclick="openCourse('${course.id}')">Voir</button>
        <div class="toolbar">
          <button class="btn-ghost" onclick="openCourseRosterModal('${course.id}')">Voir les inscrits</button>
          <button class="btn-ghost" onclick="openCourseEnrollmentModal('${course.id}')">Ajouter un élève</button>
          <button class="btn-ghost" onclick="openActivityBuilder('${course.id}')">Ajouter une activité</button>
        </div>
      </div>
    </article>
  `;
}

function renderTeacherDashboard(user) {
  const courses = getVisibleCoursesForUser(user);
  const submissions = state.submissions.filter((submission) => {
    const activity = getActivityById(submission.activityId);
    return activity && getCourseById(activity.courseId)?.teacherId === user.id;
  });
  const pendingReview = submissions.filter((item) => item.status === "submitted");
  return `
    <section class="summary-grid" style="margin-bottom:18px">
      ${metricCard("Cours", courses.length, "Publiés et brouillons")}
      ${metricCard("Apprenants", new Set(courses.flatMap((course) => course.enrolledUserIds)).size, "Inscrits dans vos cours")}
      ${metricCard("À corriger", pendingReview.length, "Travaux en attente")}
      ${metricCard("Activités", state.activities.filter((activity) => activity.createdBy === user.id).length, "Quiz et devoirs")}
    </section>
    <section class="dashboard-grid">
      <div class="panel">
        <div class="toolbar" style="justify-content:space-between">
          <div>
            <h2 class="section-title">Portefeuille de cours</h2>
            <p class="section-subtitle">Gérez le contenu, les modules et les activités de vos cours.</p>
          </div>
          <button class="btn-primary" onclick="openCourseBuilder()">Créer un cours</button>
        </div>
        <div class="course-grid" style="margin-top:18px">
          ${courses.length ? courses.map(renderTeacherCourseCard).join("") : `<div class="empty-state">Aucun cours associé à votre profil.</div>`}
        </div>
      </div>
      <div class="panel">
        <div class="toolbar" style="justify-content:space-between">
          <div>
            <h2 class="section-title">Corrections</h2>
            <p class="section-subtitle">Soumissions à traiter, commentaires et notation.</p>
          </div>
          <button class="btn-ghost" onclick="openReviewCenter()">Ouvrir le centre de correction</button>
        </div>
        <div class="feed-list" style="margin-top:18px">
          ${pendingReview.length ? pendingReview.map(renderSubmissionCard).join("") : `<div class="empty-state">Aucune soumission en attente.</div>`}
        </div>
      </div>
    </section>
    <section class="dashboard-grid" style="margin-top:18px">
      <div class="panel">
        <h2 class="section-title">Annonces</h2>
        <div class="feed-list" style="margin-top:18px">${renderAnnouncements()}</div>
      </div>
      <div class="panel">
        <h2 class="section-title">Calendrier pédagogique</h2>
        <div class="simple-list" style="margin-top:18px">${renderUpcomingEvents(user)}</div>
      </div>
    </section>
    <section class="dashboard-grid" style="margin-top:18px">
      <div class="panel">
        <h2 class="section-title">Messagerie</h2>
        <div class="toolbar" style="justify-content:flex-end">
          <button class="btn-ghost" onclick="openMessageComposer()">Nouveau message</button>
        </div>
        <div class="feed-list" style="margin-top:18px">${renderMessagesForUser(user.id)}</div>
      </div>
      <div class="panel">
        <h2 class="section-title">Suivi des cohortes</h2>
        <div class="feed-list" style="margin-top:18px">
          ${courses.length ? courses.map((course) => `<article class="feed-item"><h3>${escapeHtml(course.title)}</h3><p class="meta">${course.enrolledUserIds.length} apprenant(s) inscrit(s)</p><div class="tiny">${getActivitiesForCourse(course.id).length} activité(s) publiées</div></article>`).join("") : `<div class="empty-state">Aucune cohorte active.</div>`}
        </div>
      </div>
    </section>
    <section class="dashboard-grid" style="margin-top:18px">
      <div class="panel">
        <div class="toolbar" style="justify-content:space-between">
          <div>
            <h2 class="section-title">Forums et annonces</h2>
            <p class="section-subtitle">Animez la communication pédagogique de vos cours.</p>
          </div>
          <div class="toolbar">
            <button class="btn-ghost" onclick="openAnnouncementBuilder()">Publier une annonce</button>
            <button class="btn-ghost" onclick="openForumBuilder()">Nouveau forum</button>
          </div>
        </div>
        <div class="feed-list" style="margin-top:18px">
          ${courses.length ? courses.slice(0, 4).map((course) => `<article class="feed-item"><h3>${escapeHtml(course.title)}</h3><p class="meta">${state.announcements.filter((item) => item.courseId === course.id).length} annonce(s) · ${state.forumThreads.filter((thread) => thread.courseId === course.id).length} forum(s)</p><div class="tiny">${getAttendanceForCourse(course.id).length} séance(s) d'assiduité</div></article>`).join("") : `<div class="empty-state">Aucun cours animé actuellement.</div>`}
        </div>
      </div>
      <div class="panel">
        <div class="toolbar" style="justify-content:space-between">
          <div>
            <h2 class="section-title">Assiduité</h2>
            <p class="section-subtitle">Enregistrez les présences de vos cohortes.</p>
          </div>
          <button class="btn-ghost" onclick="openAttendanceModal()">Nouvelle séance</button>
        </div>
        <div class="feed-list" style="margin-top:18px">
          ${courses.length ? courses.slice(0, 4).map((course) => `<article class="feed-item"><h3>${escapeHtml(course.title)}</h3><p class="meta">${getAttendanceForCourse(course.id).length} séance(s) planifiée(s)</p><div class="tiny">${getCourseStudents(course).length} apprenant(s) dans la cohorte</div></article>`).join("") : `<div class="empty-state">Aucune assiduité enregistrée.</div>`}
        </div>
      </div>
    </section>
    <section class="panel" style="margin-top:18px">
      <div class="toolbar" style="justify-content:space-between">
        <h2 class="section-title">Carnet de notes enseignant</h2>
        <button class="btn-ghost" onclick="exportGradebook()">Exporter</button>
      </div>
      <div class="table-card" style="margin-top:18px">${renderGradebookTable(user)}</div>
    </section>
  `;
}

function renderUsersTable() {
  const query = String(state.ui.adminUserFilter || "").trim().toLowerCase();
  const users = state.users.filter((user) => {
    if (!query) return true;
    return user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query) || user.role.toLowerCase().includes(query);
  });
  return `
    <table>
      <thead><tr><th>Nom</th><th>Email</th><th>Profil</th><th>Inscription</th><th>Actions</th></tr></thead>
      <tbody>${users.map((user) => `<tr><td>${escapeHtml(user.name)}</td><td>${escapeHtml(user.email)}</td><td>${roleLabels[user.role]}</td><td>${formatDate(user.createdAt)}</td><td><div class="toolbar"><button class="btn-ghost" onclick="openUserEditor('${user.id}')">Modifier</button><button class="btn-ghost" onclick="removeUser('${user.id}')">Supprimer</button></div></td></tr>`).join("")}</tbody>
    </table>
  `;
}

function renderCoursesTable() {
  const query = String(state.ui.adminCourseFilter || "").trim().toLowerCase();
  const courses = state.courses.filter((course) => {
    if (!query) return true;
    return course.title.toLowerCase().includes(query) || course.category.toLowerCase().includes(query) || course.status.toLowerCase().includes(query);
  });
  return `
    <table>
      <thead><tr><th>Cours</th><th>Statut</th><th>Modules</th><th>Inscrits</th><th>Actions</th></tr></thead>
      <tbody>${courses.map((course) => `<tr><td>${escapeHtml(course.title)}</td><td>${escapeHtml(statusLabels[course.status] || course.status)}</td><td>${course.modules.length}</td><td>${course.enrolledUserIds.length}</td><td><div class="toolbar"><button class="btn-ghost" onclick="openCourseEditor('${course.id}')">Modifier</button><button class="btn-ghost" onclick="${course.status === "archived" ? `restoreCourse('${course.id}')` : `archiveCourse('${course.id}')`}">${course.status === "archived" ? "Restaurer" : "Archiver"}</button></div></td></tr>`).join("")}</tbody>
    </table>
  `;
}

function renderAuditLog(limit = 8) {
  const items = state.activityLog.slice(0, limit);
  if (!items.length) return `<div class="empty-state">Aucune trace d'audit disponible.</div>`;
  return items.map((item) => `<article class="feed-item"><h3>${escapeHtml(item.label)}</h3><div class="tiny">${formatDate(item.createdAt)}</div></article>`).join("");
}

function renderAdminDashboard() {
  const teachers = state.users.filter((user) => user.role === "teacher");
  const students = state.users.filter((user) => user.role === "student");
  const published = state.courses.filter((course) => course.status === "published");
  const graded = state.submissions.filter((submission) => typeof submission.score === "number");
  const average = graded.length
    ? Math.round(graded.reduce((sum, submission) => sum + (submission.score / Math.max(submission.maxPoints || 1, 1)) * 100, 0) / graded.length)
    : 0;
  return `
    <section class="analytics-grid" style="margin-bottom:18px">
      ${metricCard("Utilisateurs", state.users.length, "Base complète")}
      ${metricCard("Enseignants", teachers.length, "Production de contenu")}
      ${metricCard("Apprenants", students.length, "Population suivie")}
      ${metricCard("Cours publiés", published.length, "Catalogue actif")}
    </section>
    <section class="dashboard-grid">
      <div class="panel">
        <div class="toolbar" style="justify-content:space-between">
          <div>
            <h2 class="section-title">Administration utilisateurs</h2>
            <p class="section-subtitle">Profils, autorisations et accès à la plateforme.</p>
          </div>
          <button class="btn-primary" onclick="openUserBuilder()">Créer un utilisateur</button>
        </div>
        <div class="toolbar" style="justify-content:flex-end;margin-top:12px">
          <input placeholder="Filtrer utilisateurs..." value="${escapeHtml(state.ui.adminUserFilter || "")}" oninput="setAdminFilter('user', this.value)">
        </div>
        <div class="table-card" style="margin-top:18px">${renderUsersTable()}</div>
      </div>
      <div class="panel">
        <div class="toolbar" style="justify-content:space-between">
          <div>
            <h2 class="section-title">Catalogue et contenus</h2>
            <p class="section-subtitle">Supervisez les cours, les activités et leur état de publication.</p>
          </div>
          <div class="toolbar">
            <button class="btn-ghost" onclick="openCourseRosterModal()">Voir les inscrits</button>
            <button class="btn-ghost" onclick="openCourseEnrollmentModal()">Affecter un élève</button>
            <button class="btn-primary" onclick="openCourseBuilder()">Ajouter un cours</button>
          </div>
        </div>
        <div class="toolbar" style="justify-content:flex-end;margin-top:12px">
          <input placeholder="Filtrer cours..." value="${escapeHtml(state.ui.adminCourseFilter || "")}" oninput="setAdminFilter('course', this.value)">
        </div>
        <div class="table-card" style="margin-top:18px">${renderCoursesTable()}</div>
      </div>
    </section>
    <section class="dashboard-grid" style="margin-top:18px">
      <div class="panel">
        <div class="toolbar" style="justify-content:space-between">
          <h2 class="section-title">Messagerie</h2>
          <button class="btn-ghost" onclick="openMessageComposer()">Nouveau message</button>
        </div>
        <div class="feed-list" style="margin-top:18px">${renderMessagesForUser(getCurrentUser().id)}</div>
      </div>
      <div class="panel">
        <div class="toolbar" style="justify-content:space-between">
          <h2 class="section-title">Annonces publiées</h2>
          <button class="btn-ghost" onclick="openAnnouncementBuilder()">Publier</button>
        </div>
        <div class="feed-list" style="margin-top:18px">${renderAnnouncements()}</div>
      </div>
    </section>
    <section class="dashboard-grid" style="margin-top:18px">
      <div class="panel">
        <div class="toolbar" style="justify-content:space-between">
          <div>
            <h2 class="section-title">Pilotage de la plateforme</h2>
            <p class="section-subtitle">Communication, données et administration pédagogique.</p>
          </div>
          <button class="btn-primary" onclick="openPlatformSettings()">Paramètres du site</button>
        </div>
        <div class="summary-grid" style="margin-top:18px">
          ${metricCard("Annonces", state.announcements.length, "Communication publiée")}
          ${metricCard("Messages", state.messages.length, "Boîte interne")}
          ${metricCard("Forums", state.forumThreads.length, "Espaces d'échange")}
          ${metricCard("Présences", state.attendanceSessions.length, "Séances enregistrées")}
        </div>
      </div>
      <div class="panel">
        <div class="toolbar" style="justify-content:space-between">
          <div>
            <h2 class="section-title">Assiduité globale</h2>
            <p class="section-subtitle">Vue transverse des séances de suivi.</p>
          </div>
          <button class="btn-ghost" onclick="openAttendanceModal()">Nouvelle séance</button>
        </div>
        <div class="feed-list" style="margin-top:18px">
          ${state.courses.length ? state.courses.slice(0, 5).map((course) => `<article class="feed-item"><h3>${escapeHtml(course.title)}</h3><p class="meta">${getAttendanceForCourse(course.id).length} séance(s) · ${getCourseStudents(course).length} apprenant(s)</p><div class="tiny">${state.forumThreads.filter((thread) => thread.courseId === course.id).length} forum(s) actif(s)</div></article>`).join("") : `<div class="empty-state">Aucun cours en base.</div>`}
        </div>
      </div>
    </section>
    <section class="dashboard-grid" style="margin-top:18px">
      <div class="panel">
        <h2 class="section-title">Performance globale</h2>
        <div class="summary-grid" style="margin-top:18px">
          ${metricCard("Moyenne globale", `${average}%`, "Toutes évaluations")}
          ${metricCard("Quiz", state.activities.filter((activity) => activity.type === "quiz").length, "Évaluations formatives")}
          ${metricCard("Devoirs", state.activities.filter((activity) => activity.type === "assignment").length, "Évaluations sommatives")}
          ${metricCard("Copies en attente", state.submissions.filter((submission) => submission.status === "submitted").length, "À traiter")}
        </div>
      </div>
      <div class="panel">
        <div class="toolbar" style="justify-content:space-between">
          <h2 class="section-title">Actions rapides</h2>
          <button class="btn-ghost" onclick="openReviewCenter()">Centre de correction</button>
        </div>
        <div class="simple-list" style="margin-top:18px">
          <div class="module-card"><strong>Exporter les notes</strong><div class="meta">Téléchargez le carnet global au format CSV.</div><div class="toolbar" style="margin-top:12px"><button class="btn-ghost" onclick="exportGradebook()">Exporter</button></div></div>
          <div class="module-card"><strong>Gérer les quiz</strong><div class="meta">Réinitialisez les tentatives et suivez les résultats des cohortes.</div></div>
        </div>
      </div>
    </section>
    <section class="dashboard-grid" style="margin-top:18px">
      <div class="panel">
        <h2 class="section-title">Journal d'audit</h2>
        <div class="feed-list" style="margin-top:18px">${renderAuditLog()}</div>
      </div>
      <div class="panel">
        <h2 class="section-title">Supervision contenu</h2>
        <div class="feed-list" style="margin-top:18px">
          ${state.courses.slice(0, 5).map((course) => `<article class="feed-item"><div class="toolbar" style="justify-content:space-between"><div><h3>${escapeHtml(course.title)}</h3><p class="meta">${course.modules.length} module(s) · ${getActivitiesForCourse(course.id).length} activité(s)</p></div><div class="toolbar"><button class="btn-ghost" onclick="openCourseEditor('${course.id}')">Modifier</button><button class="btn-ghost" onclick="openCourse('${course.id}')">Ouvrir</button></div></div></article>`).join("")}
        </div>
      </div>
    </section>
    <section class="panel" style="margin-top:18px">
      <div class="toolbar" style="justify-content:space-between">
        <h2 class="section-title">Carnet de notes global</h2>
        <button class="btn-ghost" onclick="exportGradebook()">Exporter</button>
      </div>
      <div class="table-card" style="margin-top:18px">${renderGradebookTable(getCurrentUser())}</div>
    </section>
  `;
}

function renderDashboard(user) {
  return `
    <div class="page-grid">
      <aside class="sidebar">
        <section class="sidebar-card">
          <p class="eyebrow">Navigation</p>
          <div class="nav-list">
            <button class="nav-button active" onclick="setScreen('dashboard')">Vue d’ensemble</button>
            <button class="nav-button" onclick="openProfileModal()">Profil</button>
            ${user.role !== "student" ? `<button class="nav-button" onclick="openCourseBuilder()">Créer un cours</button>` : ""}
            ${user.role === "admin" ? `<button class="nav-button" onclick="openPlatformSettings()">Paramètres du site</button>` : ""}
          </div>
        </section>
        <section class="sidebar-card">
          <p class="eyebrow">Notifications</p>
          <div class="notification-list">${renderNotifications(user.id)}</div>
        </section>
      </aside>
      <div class="dashboard-body">
        ${renderDashboardHeader(user)}
        ${user.role === "student" ? renderStudentDashboard(user) : ""}
        ${user.role === "teacher" ? renderTeacherDashboard(user) : ""}
        ${user.role === "admin" ? renderAdminDashboard(user) : ""}
      </div>
    </div>
  `;
}

function renderQuizArea(activity, submission) {
  const previousAttempts = state.submissions.filter((item) => item.activityId === activity.id && item.userId === getCurrentUser()?.id).length;
  const limitReached = activity.attemptsAllowed && previousAttempts >= activity.attemptsAllowed;
  if (submission) {
    return `
      <section class="panel" style="margin-top:18px">
        <h3>Quiz déjà soumis</h3>
        <p class="section-subtitle">Votre résultat est déjà enregistré dans l'historique.</p>
        <div class="badge-row" style="margin-top:14px">
          <span class="badge success">Score: ${submission.score}/${submission.maxPoints}</span>
          <span class="badge primary">Soumis le ${formatDate(submission.submittedAt)}</span>
          ${activity.passingScore ? `<span class="badge ${((submission.score / Math.max(submission.maxPoints || 1, 1)) * 100) >= activity.passingScore ? "success" : "warning"}">Seuil ${activity.passingScore}%</span>` : ""}
        </div>
      </section>
    `;
  }
  if (limitReached) {
    return `
      <section class="panel" style="margin-top:18px">
        <h3>Nombre de tentatives atteint</h3>
        <p class="section-subtitle">Ce quiz autorise ${activity.attemptsAllowed} tentative(s). Votre enseignant peut réinitialiser l'activité si nécessaire.</p>
      </section>
    `;
  }
  return `
    <form id="quiz-form" data-activity-id="${activity.id}" class="simple-list" style="margin-top:18px">
      <div class="badge-row" style="margin-bottom:8px">
        <span class="badge primary">${activity.timeLimitMinutes || 0} min</span>
        <span class="badge warning">${activity.attemptsAllowed || 1} tentative(s)</span>
        <span class="badge success">Seuil ${activity.passingScore || 50}%</span>
        <span class="badge primary">Poids ${activity.weight || 1}</span>
      </div>
      ${activity.questions.map((question, index) => `
        <div class="question-card">
          <h3>Question ${index + 1}</h3>
          <p>${escapeHtml(question.prompt)}</p>
          ${question.kind === "open"
            ? `<div class="field" style="margin-top:10px"><textarea name="question-${question.id}" placeholder="Rédigez votre réponse..." required></textarea></div>`
            : question.kind === "short"
              ? `<div class="field" style="margin-top:10px"><input name="question-${question.id}" placeholder="Réponse courte attendue..." required></div>`
              : `<div class="simple-list" style="margin-top:10px">${(question.options || []).map((option) => `<label class="lesson-card"><input type="radio" name="question-${question.id}" value="${escapeHtml(option)}" required> ${escapeHtml(option)}</label>`).join("")}</div>`
          }
          <div class="tiny" style="margin-top:10px">${question.points} point(s) · ${question.kind === "mcq" ? "QCM" : question.kind === "truefalse" ? "Vrai / Faux" : question.kind === "short" ? "Réponse courte" : "Réponse ouverte"}</div>
        </div>
      `).join("")}
      <div class="toolbar">
        <button class="btn-primary" type="submit">Soumettre le quiz</button>
        <span class="tiny">Correction automatique pour QCM, vrai/faux et réponses courtes. Revue manuelle pour les réponses ouvertes.</span>
      </div>
    </form>
  `;
}

function renderAssignmentArea(activity, submission) {
  if (submission) {
    return `
      <section class="panel" style="margin-top:18px">
        <h3>Votre soumission</h3>
        <p class="section-subtitle">${escapeHtml(submission.text || "Soumission envoyée.")}</p>
        <div class="badge-row" style="margin-top:12px">
          <span class="badge warning">${statusLabels[submission.status] || submission.status}</span>
          <span class="badge primary">Envoyé le ${formatDate(submission.submittedAt)}</span>
          ${submission.fileName ? `<span class="badge success">Fichier : ${escapeHtml(submission.fileName)}</span>` : ""}
        </div>
        ${submission.fileName ? `<div class="announcement" style="margin-top:14px">${submission.fileUrl ? `Pièce jointe déposée : <a href="${escapeHtml(submission.fileUrl)}" target="_blank" rel="noreferrer">${escapeHtml(submission.fileName)}</a>` : `Pièce jointe enregistrée : ${escapeHtml(submission.fileName)}`}</div>` : ""}
      </section>
    `;
  }
  return `
    <form id="assignment-form" data-activity-id="${activity.id}" class="form-grid" style="margin-top:18px">
      <div class="field full">
        <label for="assignment-text">Votre réponse</label>
        <textarea id="assignment-text" name="text" placeholder="Expliquez votre démarche, ajoutez votre lien Drive ou résumez votre travail." required></textarea>
      </div>
      <div class="field full">
        <label for="assignment-file">Nom du fichier / lien du devoir</label>
        <input id="assignment-file" name="fileName" placeholder="ex: devoir-probabilites.pdf ou lien Drive">
      </div>
      <div class="field full">
        <label for="assignment-upload">Déposer un fichier</label>
        <input id="assignment-upload" name="fileUpload" type="file">
      </div>
      <div class="field full"><button class="btn-primary" type="submit">Soumettre le devoir</button></div>
    </form>
  `;
}

function renderCourseWorkspace(user) {
  const course = getCourseById(state.ui.activeCourseId);
  if (!course) {
    setScreen("dashboard");
    return "";
  }
  if (!canAccessCourse(user, course)) {
    setScreen("dashboard");
    return "";
  }
  const requestedModule = course.modules.find((item) => item.id === state.ui.currentModuleId);
  const fallbackModule = getFirstAccessibleModule(course, user) || course.modules[0];
  const module = requestedModule && !isModuleLocked(course, user, requestedModule.id) ? requestedModule : fallbackModule;
  const requestedLesson = module?.lessons.find((item) => item.id === state.ui.currentLessonId);
  const fallbackLesson = getFirstAccessibleLesson(course, module, user) || module?.lessons[0];
  const lesson = requestedLesson && !isLessonLocked(course, user, module?.id, requestedLesson.id) ? requestedLesson : fallbackLesson;
  const activities = getActivitiesForCourse(course.id).filter((activity) => !module || activity.moduleId === module.id);
  const progress = user.role === "student" ? computeCourseProgress(course, user.id) : Math.min(100, course.enrolledUserIds.length * 10);
  const completionMetrics = user.role === "student" ? getCourseCompletionMetrics(course, user.id) : null;
  const lessonCompleted = user.role === "student" && lesson ? isLessonCompleted(user.id, course.id, module.id, lesson.id) : false;
  const moduleMetrics = user.role === "student" && module ? getModuleCompletionMetrics(course, module.id, user.id) : null;
  return `
    <section class="panel" style="margin-bottom:18px">
      <div class="toolbar" style="justify-content:space-between">
        <button class="btn-ghost" onclick="setScreen('dashboard')">Retour au tableau de bord</button>
        <div class="badge-row">
          <span class="badge primary">${escapeHtml(course.category)}</span>
          <span class="badge success">${course.modules.length} modules</span>
          <span class="badge warning">${getActivitiesForCourse(course.id).length} activités</span>
        </div>
      </div>
      <div class="layout-split" style="margin-top:18px">
        <div class="panel" style="padding:0;border:none;box-shadow:none;background:transparent">
          <div class="course-cover" style="height:220px;background-image:url('${escapeHtml(course.image)}')"><span>${escapeHtml(course.audience)}</span></div>
          <h2 class="section-title">${escapeHtml(course.title)}</h2>
          <p class="section-subtitle">${escapeHtml(course.description)}</p>
          <div class="progress"><span style="width:${progress}%"></span></div>
          <div class="toolbar" style="justify-content:space-between">
            <span class="tiny">Progression : ${progress}%</span>
            ${user.role !== "student" ? `
              <div class="toolbar">
                <button class="btn-ghost" onclick="openCourseEditor('${course.id}')">Modifier le cours</button>
                <button class="btn-ghost" onclick="removeCourse('${course.id}')">Supprimer le cours</button>
                <button class="btn-primary" onclick="openActivityBuilder('${course.id}')">Ajouter une activité</button>
                <button class="btn-ghost" onclick="openModuleBuilder('${course.id}')">Ajouter un module</button>
                ${module ? `<button class="btn-ghost" onclick="openLessonBuilder('${course.id}','${module.id}')">Ajouter une leçon</button>` : ""}
              </div>
            ` : ""}
          </div>
          ${lesson ? `
            <section class="panel" style="margin-top:18px">
              <div class="toolbar" style="justify-content:space-between">
                <div><p class="eyebrow">Leçon active</p><h3>${escapeHtml(lesson.title)}</h3></div>
                <div class="badge-row">
                  <span class="badge primary">${escapeHtml(lesson.type)}</span>
                  ${user.role === "student" ? `<span class="badge ${lessonCompleted ? "success" : "warning"}">${lessonCompleted ? "Terminée" : "À faire"}</span>` : ""}
                </div>
              </div>
              <p class="section-subtitle">${escapeHtml(lesson.content)}</p>
              <div class="resource-grid">
                ${lesson.resources.map((resource) => `<div class="resource-item"><div><strong>${escapeHtml(resource.title)}</strong><div class="tiny">${escapeHtml(resource.type)}</div></div>${renderResourceAction(course.id, module.id, lesson.id, resource)}</div>`).join("")}
              </div>
              ${user.role === "student" ? `
                <div class="toolbar" style="justify-content:space-between;margin-top:18px">
                  <div class="tiny">${lessonCompleted ? "Cette leçon est prise en compte dans votre progression." : "Validez cette leçon une fois consultée."}</div>
                  <button class="btn-${lessonCompleted ? "ghost" : "primary"}" onclick="toggleLessonCompletion('${course.id}','${module.id}','${lesson.id}')">${lessonCompleted ? "Marquer non terminée" : "Marquer comme terminée"}</button>
                </div>
              ` : ""}
            </section>` : `<div class="empty-state" style="margin-top:18px">Ce cours ne contient pas encore de leçons.</div>`}
          <section class="panel" style="margin-top:18px">
            <h3>Activités du module</h3>
            <div class="activity-grid" style="margin-top:18px">
              ${activities.length ? activities.map(renderActivitySummaryCard).join("") : `<div class="empty-state">Aucune activité sur ce module.</div>`}
            </div>
          </section>
          <section class="dashboard-grid" style="margin-top:18px">
            <div class="panel">
              <div class="toolbar" style="justify-content:space-between">
                <h3>Annonces du cours</h3>
                ${canTeachCourse(user, course) ? `<button class="btn-ghost" onclick="openAnnouncementBuilder('${course.id}')">Publier</button>` : ""}
              </div>
              <div class="feed-list" style="margin-top:18px">${renderAnnouncements(course.id)}</div>
            </div>
            <div class="panel">
              <div class="toolbar" style="justify-content:space-between">
                <h3>Forum du cours</h3>
                <div class="toolbar">
                  <button class="btn-ghost" onclick="openForumBuilder('${course.id}')">Nouvelle discussion</button>
                  <button class="btn-ghost" onclick="openMessageComposer('', '${course.id}')">Message lié au cours</button>
                </div>
              </div>
              <div class="feed-list" style="margin-top:18px">${renderCourseForums(course.id)}</div>
            </div>
          </section>
          <section class="dashboard-grid" style="margin-top:18px">
            <div class="panel">
              <div class="toolbar" style="justify-content:space-between">
                <h3>Assiduité</h3>
                ${canTeachCourse(user, course) ? `<button class="btn-ghost" onclick="openAttendanceModal('${course.id}')">Nouvelle séance</button>` : ""}
              </div>
              <div style="margin-top:18px">${renderAttendanceSummary(course, user)}</div>
            </div>
            <div class="panel">
              <h3>Communication rapide</h3>
              <div class="simple-list" style="margin-top:18px">
                <div class="module-card"><strong>Messages</strong><div class="meta">Échangez avec votre cohorte et l'équipe pédagogique.</div><div class="toolbar" style="margin-top:12px"><button class="btn-ghost" onclick="openMessageComposer('', '${course.id}')">Rédiger</button></div></div>
                <div class="module-card"><strong>Paramètres pédagogiques</strong><div class="meta">Structurez le cours avec modules, leçons, annonces et activités.</div></div>
              </div>
            </div>
          </section>
          ${canTeachCourse(user, course) ? `<section class="panel" style="margin-top:18px"><h3>Rapport du cours</h3>${renderCourseReport(course)}</section>` : ""}
        </div>
        <aside class="sidebar">
          <section class="sidebar-card">
            <p class="eyebrow">Modules</p>
            <div class="module-list">
              ${course.modules.map((item) => {
                const locked = isModuleLocked(course, user, item.id);
                const itemMetrics = user.role === "student" ? getModuleCompletionMetrics(course, item.id, user.id) : null;
                return `<button class="module-card ${module?.id === item.id ? "active" : ""}" onclick="selectModule('${course.id}','${item.id}')" ${locked ? "disabled" : ""}>
                  <strong>${escapeHtml(item.title)}</strong>
                  <div class="meta">${escapeHtml(item.summary)}</div>
                  ${user.role === "student" ? `<div class="tiny" style="margin-top:8px">${locked ? "Verrouillé" : `${itemMetrics.completedItems}/${itemMetrics.totalItems} élément(s) complété(s)`}</div>` : ""}
                </button>`;
              }).join("")}
            </div>
            ${canTeachCourse(user, course) && module ? `<div class="toolbar" style="margin-top:12px"><button class="btn-ghost" onclick="openModuleEditor('${course.id}','${module.id}')">Modifier</button><button class="btn-ghost" onclick="toggleModuleRelease('${course.id}','${module.id}')">${normalizeCourseReleaseState(course.release).modules[module.id] === false ? "Ouvrir aux élèves" : "Fermer aux élèves"}</button><button class="btn-ghost" onclick="removeModule('${course.id}','${module.id}')">Supprimer</button></div>` : ""}
          </section>
          <section class="sidebar-card">
            <p class="eyebrow">Leçons</p>
            <div class="lesson-list">
              ${(module?.lessons || []).map((item) => `<button class="lesson-card ${lesson?.id === item.id ? "active" : ""}" onclick="selectLesson('${course.id}','${module.id}','${item.id}')" ${isLessonLocked(course, user, module.id, item.id) ? "disabled" : ""}><strong>${escapeHtml(item.title)}</strong><div class="meta">${escapeHtml(item.duration)} · ${escapeHtml(item.type)}</div>${user.role === "student" ? `<div class="tiny" style="margin-top:8px">${isLessonLocked(course, user, module.id, item.id) ? "Leçon fermée" : (isLessonCompleted(user.id, course.id, module.id, item.id) ? "Terminé" : "À faire")}</div>` : `<div class="tiny" style="margin-top:8px">${normalizeCourseReleaseState(course.release).lessons[item.id] === false ? "Fermée aux élèves" : "Accessible"}</div>`}</button>`).join("") || `<div class="empty-state">Pas encore de leçons.</div>`}
            </div>
            ${canTeachCourse(user, course) && lesson ? `<div class="toolbar" style="margin-top:12px"><button class="btn-ghost" onclick="openLessonEditor('${course.id}','${module.id}','${lesson.id}')">Modifier</button><button class="btn-ghost" onclick="toggleLessonRelease('${course.id}','${module.id}','${lesson.id}')">${normalizeCourseReleaseState(course.release).lessons[lesson.id] === false ? "Ouvrir la leçon" : "Fermer la leçon"}</button><button class="btn-ghost" onclick="removeLesson('${course.id}','${module.id}','${lesson.id}')">Supprimer</button></div>` : ""}
          </section>
          <section class="sidebar-card">
            <p class="eyebrow">Évaluation</p>
            <div class="simple-list">
              <div class="module-card"><strong>Moyenne</strong><div class="meta">${user.role === "student" ? (computeAverageForCourse(course.id, user.id) ?? "Non disponible") : "Vue enseignant"}</div></div>
              <div class="module-card"><strong>Achèvement</strong><div class="meta">${user.role === "student" ? `${courseCompletionStatus(course, user.id)} · ${completionMetrics.completedItems}/${completionMetrics.totalItems} élément(s)` : `${course.enrolledUserIds.length} inscrit(s)`}</div></div>
              ${user.role === "student" && moduleMetrics ? `<div class="module-card"><strong>Module actif</strong><div class="meta">${moduleMetrics.progress}% · ${moduleMetrics.completedItems}/${moduleMetrics.totalItems} élément(s)</div></div>` : ""}
            </div>
          </section>
        </aside>
      </div>
    </section>
  `;
}

function renderActivityWorkspace(user) {
  const activity = getActivityById(state.ui.activeActivityId);
  if (!activity) {
    setScreen("dashboard");
    return "";
  }
  const course = getCourseById(activity.courseId);
  if (!canAccessCourse(user, course)) {
    setScreen("dashboard");
    return "";
  }
  const submission = getUserSubmission(activity.id, user.id);
  return `
    <section class="panel">
      <div class="toolbar" style="justify-content:space-between">
        <button class="btn-ghost" onclick="openCourse('${course.id}')">Retour au cours</button>
        <span class="badge ${activity.type === "quiz" ? "primary" : "warning"}">${activity.type === "quiz" ? "Quiz" : "Devoir"}</span>
      </div>
      <div class="layout-split" style="margin-top:18px">
        <div class="panel" style="padding:0;border:none;box-shadow:none;background:transparent">
          <h2 class="section-title">${escapeHtml(activity.title)}</h2>
          <p class="section-subtitle">${escapeHtml(activity.description)}</p>
          <div class="announcement" style="margin-top:18px">Échéance : ${formatDate(activity.dueDate)} · Cours : ${escapeHtml(course?.title || "")}</div>
          ${activity.type === "quiz" ? renderQuizArea(activity, submission) : renderAssignmentArea(activity, submission)}
        </div>
        <aside class="sidebar">
          <section class="sidebar-card">
            <p class="eyebrow">État</p>
            <div class="simple-list">
              <div class="module-card"><strong>Statut</strong><div class="meta">${submission ? statusLabels[submission.status] || submission.status : "Non soumis"}</div></div>
              <div class="module-card"><strong>Notation</strong><div class="meta">${typeof submission?.score === "number" ? `${submission.score}/${submission.maxPoints}` : "Pas encore noté"}</div></div>
              <div class="module-card"><strong>Correction</strong><div class="meta">${escapeHtml(submission?.feedback || "Pas de feedback disponible.")}</div></div>
            </div>
          </section>
          ${activity.type === "quiz" ? `
            <section class="sidebar-card">
              <p class="eyebrow">Paramètres du quiz</p>
              <div class="simple-list">
                <div class="module-card"><strong>Temps imparti</strong><div class="meta">${activity.timeLimitMinutes || 20} minutes</div></div>
                <div class="module-card"><strong>Tentatives</strong><div class="meta">${activity.attemptsAllowed || 1}</div></div>
                <div class="module-card"><strong>Banque de questions</strong><div class="meta">${getQuestionBankForCourse(course.id).length} question(s) disponible(s)</div></div>
              </div>
              ${canTeachCourse(user, course) ? `<div class="toolbar" style="margin-top:12px"><button class="btn-ghost" onclick="openQuizEditor('${activity.id}')">Configurer</button><button class="btn-ghost" onclick="openQuestionBankBuilder('${course.id}','${activity.id}')">Banque</button></div>` : ""}
            </section>
          ` : ""}
        </aside>
      </div>
    </section>
  `;
}

function renderApp() {
  renderTopbar();
  const app = document.getElementById("app");
  const user = getCurrentUser();
  if (state.ui.screen === "contact") app.innerHTML = renderContactPage();
  else if (state.ui.screen === "schoolCatalog") app.innerHTML = renderCatalogPage("school");
  else if (state.ui.screen === "proCatalog") app.innerHTML = renderCatalogPage("pro");
  else if (!user) app.innerHTML = renderLanding();
  else if (state.ui.screen === "course") app.innerHTML = renderCourseWorkspace(user);
  else if (state.ui.screen === "activity") app.innerHTML = renderActivityWorkspace(user);
  else if (state.ui.screen === "landing") app.innerHTML = renderLanding();
  else app.innerHTML = renderDashboard(user);
  bindForms();
}

function openCourse(courseId) {
  const course = getCourseById(courseId);
  const firstModule = getFirstAccessibleModule(course, getCurrentUser()) || course?.modules[0];
  const firstLesson = getFirstAccessibleLesson(course, firstModule, getCurrentUser()) || firstModule?.lessons[0];
  setScreen("course", { activeCourseId: courseId, currentModuleId: firstModule?.id || null, currentLessonId: firstLesson?.id || null });
}

function openActivity(activityId) {
  setScreen("activity", { activeActivityId: activityId });
}

function selectModule(courseId, moduleId) {
  const course = getCourseById(courseId);
  const user = getCurrentUser();
  if (isModuleLocked(course, user, moduleId)) {
    openModal(`
      <h2>Module verrouillé</h2>
      <p class="section-subtitle">Terminez d'abord les leçons et activités du module précédent pour débloquer cette partie du parcours.</p>
    `);
    return;
  }
  const module = course?.modules.find((item) => item.id === moduleId);
  setScreen("course", { activeCourseId: courseId, currentModuleId: moduleId, currentLessonId: module?.lessons[0]?.id || null });
}

function selectLesson(courseId, moduleId, lessonId) {
  const course = getCourseById(courseId);
  const user = getCurrentUser();
  if (isLessonLocked(course, user, moduleId, lessonId)) {
    openModal(`
      <h2>Leçon non ouverte</h2>
      <p class="section-subtitle">Cette leçon n'est pas encore ouverte aux apprenants. Consultez la leçon précédente ou attendez l'ouverture par l'enseignant.</p>
    `);
    return;
  }
  setScreen("course", { activeCourseId: courseId, currentModuleId: moduleId, currentLessonId: lessonId });
}

function openLessonResource(courseId, moduleId, lessonId, resourceId) {
  const course = getCourseById(courseId);
  const module = course?.modules.find((item) => item.id === moduleId);
  const lesson = module?.lessons.find((item) => item.id === lessonId);
  const resource = lesson?.resources?.find((item) => item.id === resourceId);
  if (!course || !module || !lesson || !resource) return;
  const user = getCurrentUser();
  if (isLessonLocked(course, user, moduleId, lessonId)) {
    openModal(`
      <h2>Contenu non disponible</h2>
      <p class="section-subtitle">Cette ressource sera accessible lorsque la leçon sera ouverte par l'enseignant.</p>
    `);
    return;
  }
  const safeUrl = escapeHtml(resource.url || "");
  const safeTitle = escapeHtml(resource.title || "Ressource");
  const safeType = escapeHtml(resource.type || "resource");
  const fallback = `<div class="panel" style="margin-top:18px"><h3>${safeTitle}</h3><p class="section-subtitle">${escapeHtml(lesson.content || "Consultez cette ressource dans votre progression de cours.")}</p>${resource.url ? `<div class="toolbar" style="margin-top:18px"><a class="btn-primary" href="${safeUrl}" target="_blank" rel="noreferrer">Ouvrir dans un nouvel onglet</a></div>` : `<div class="empty-state" style="margin-top:18px">Aucun lien externe n'est encore renseigné pour cette ressource.</div>`}</div>`;
  let body = fallback;
  if (resource.url && resource.url !== "#") {
    if (resource.type === "video") {
      body = `<div class="panel"><h3>${safeTitle}</h3><div class="tiny" style="margin:8px 0 18px 0">${safeType}</div><video controls style="width:100%;border-radius:18px;background:#0f172a"><source src="${safeUrl}"></video><div class="toolbar" style="margin-top:18px"><a class="btn-ghost" href="${safeUrl}" target="_blank" rel="noreferrer">Ouvrir le fichier vidéo</a></div></div>`;
    } else if (resource.type === "pdf") {
      body = `<div class="panel"><h3>${safeTitle}</h3><div class="tiny" style="margin:8px 0 18px 0">${safeType}</div><iframe src="${safeUrl}" title="${safeTitle}" style="width:100%;min-height:70vh;border:1px solid rgba(37,82,187,.16);border-radius:18px;background:#fff"></iframe><div class="toolbar" style="margin-top:18px"><a class="btn-ghost" href="${safeUrl}" target="_blank" rel="noreferrer">Télécharger / ouvrir le PDF</a></div></div>`;
    } else {
      body = `<div class="panel"><h3>${safeTitle}</h3><p class="section-subtitle">${escapeHtml(lesson.content || "Accédez au support lié à cette leçon.")}</p><div class="toolbar" style="margin-top:18px"><a class="btn-primary" href="${safeUrl}" target="_blank" rel="noreferrer">Ouvrir le contenu</a></div></div>`;
    }
  }
  openModal(body);
}

async function toggleModuleRelease(courseId, moduleId) {
  const course = getCourseById(courseId);
  const module = course?.modules.find((item) => item.id === moduleId);
  const actor = getCurrentUser();
  if (!course || !module || !canTeachCourse(actor, course)) return;
  course.release = normalizeCourseReleaseState(course.release);
  const isCurrentlyClosed = course.release.modules[moduleId] === false;
  course.release.modules[moduleId] = isCurrentlyClosed;
  if (!isCurrentlyClosed) {
    (module.lessons || []).forEach((lesson) => {
      if (course.release.lessons[lesson.id] === undefined) course.release.lessons[lesson.id] = false;
    });
  }
  course.enrolledUserIds.forEach((userId) => addNotification({
    userId,
    title: isCurrentlyClosed ? "Module ouvert" : "Module temporairement fermé",
    message: isCurrentlyClosed ? `Le module ${module.title} est désormais accessible.` : `Le module ${module.title} sera rouvert par votre enseignant au moment prévu.`,
    level: isCurrentlyClosed ? "success" : "warning"
  }));
  addLog(actor.id, `${isCurrentlyClosed ? "Ouverture" : "Fermeture"} du module - ${module.title}`);
  if (shouldUseSupabasePersistence()) {
    try {
      await supabaseUpsert("courses", mapCourseToSupabaseRow(course));
    } catch (error) {
      console.warn("Supabase course release sync ignored:", error);
    }
  }
  await publishPlatformEvent("course.release.updated", {
    courseId,
    moduleId,
    release: course.release,
    entity: "module",
    isOpen: isCurrentlyClosed
  });
  saveState();
  renderApp();
}

async function toggleLessonRelease(courseId, moduleId, lessonId) {
  const course = getCourseById(courseId);
  const module = course?.modules.find((item) => item.id === moduleId);
  const lesson = module?.lessons.find((item) => item.id === lessonId);
  const actor = getCurrentUser();
  if (!course || !module || !lesson || !canTeachCourse(actor, course)) return;
  course.release = normalizeCourseReleaseState(course.release);
  const isCurrentlyClosed = course.release.lessons[lessonId] === false;
  course.release.lessons[lessonId] = isCurrentlyClosed;
  if (isCurrentlyClosed) {
    course.release.modules[moduleId] = true;
  }
  course.enrolledUserIds.forEach((userId) => addNotification({
    userId,
    title: isCurrentlyClosed ? "Leçon ouverte" : "Leçon temporairement fermée",
    message: isCurrentlyClosed ? `La leçon ${lesson.title} est maintenant disponible.` : `La leçon ${lesson.title} a été refermée par votre enseignant.`,
    level: isCurrentlyClosed ? "success" : "warning"
  }));
  addLog(actor.id, `${isCurrentlyClosed ? "Ouverture" : "Fermeture"} de la leçon - ${lesson.title}`);
  if (shouldUseSupabasePersistence()) {
    try {
      await supabaseUpsert("courses", mapCourseToSupabaseRow(course));
    } catch (error) {
      console.warn("Supabase lesson release sync ignored:", error);
    }
  }
  await publishPlatformEvent("course.release.updated", {
    courseId,
    moduleId,
    lessonId,
    release: course.release,
    entity: "lesson",
    isOpen: isCurrentlyClosed
  });
  saveState();
  renderApp();
}

async function toggleLessonCompletion(courseId, moduleId, lessonId) {
  const user = getCurrentUser();
  const course = getCourseById(courseId);
  const module = course?.modules.find((item) => item.id === moduleId);
  const lesson = module?.lessons.find((item) => item.id === lessonId);
  if (!user || user.role !== "student" || !course || !module || !lesson) return;
  const existing = getCompletionRecord(user.id, courseId, moduleId, lessonId);
  if (existing) {
    state.completionRecords = state.completionRecords.filter((record) => record.id !== existing.id);
    if (shouldUseSupabasePersistence()) {
      try {
        await supabaseDelete("completion_records", { id: existing.id });
      } catch (error) {
        console.warn("Supabase completion delete ignored:", error);
      }
    }
    addLog(user.id, `Leçon reprise - ${lesson.title}`);
    await publishPlatformEvent("lesson.completion.updated", {
      completionRecord: existing,
      completed: false
    });
  } else {
    const record = {
      id: crypto.randomUUID(),
      userId: user.id,
      courseId,
      moduleId,
      lessonId,
      completedAt: nowISO()
    };
    state.completionRecords.push(record);
    if (shouldUseSupabasePersistence()) {
      try {
        await supabaseUpsert("completion_records", {
          id: record.id,
          course_id: record.courseId,
          module_id: record.moduleId || null,
          lesson_id: record.lessonId || null,
          profile_id: record.userId,
          completed_at: record.completedAt || nowISO()
        });
      } catch (error) {
        console.warn("Supabase completion sync ignored:", error);
      }
    }
    addLog(user.id, `Leçon terminée - ${lesson.title}`);
    const remote = await publishPlatformEvent("lesson.completion.updated", { completionRecord: record, completed: true });
    mergeRemoteEntity(record, extractRemoteEntity(remote, "completionRecord"));
  }
  saveState();
  renderApp();
}

function focusFirstStudentCourse() {
  const user = getCurrentUser();
  const firstCourse = getVisibleCoursesForUser(user)[0];
  if (firstCourse) openCourse(firstCourse.id);
}

async function enrollUser(courseId, userId) {
  const course = getCourseById(courseId);
  const actor = getCurrentUser();
  if (!course || course.enrolledUserIds.includes(userId)) return;
  if (actor && !canManageEnrollment(course, actor) && actor.id !== userId) return;
  course.enrolledUserIds.push(userId);
  if (shouldUseSupabasePersistence()) {
    try {
      await supabaseUpsert("enrollments", {
        course_id: courseId,
        profile_id: userId,
        status: "active",
        enrolled_at: nowISO()
      }, "course_id,profile_id");
    } catch (error) {
      console.warn("Supabase enrollment sync ignored:", error);
    }
  }
  addNotification({ userId, title: "Inscription confirmee", message: `Vous etes maintenant inscrit au cours ${course.title}.`, level: "success" });
  addLog(userId, `Inscription au cours ${course.title}`);
  await publishPlatformEvent("enrollment.created", {
    courseId,
    userId,
    actorId: actor?.id || userId
  });
  saveState();
}

async function unenrollUser(courseId, userId) {
  const course = getCourseById(courseId);
  const actor = getCurrentUser();
  if (!course || !course.enrolledUserIds.includes(userId)) return;
  if (actor && !canManageEnrollment(course, actor)) return;
  course.enrolledUserIds = course.enrolledUserIds.filter((id) => id !== userId);
  state.submissions = state.submissions.filter((submission) => {
    const activity = getActivityById(submission.activityId);
    return !(submission.userId === userId && activity?.courseId === courseId);
  });
  state.completionRecords = state.completionRecords.filter((record) => !(record.userId === userId && record.courseId === courseId));
  if (shouldUseSupabasePersistence()) {
    try {
      await supabaseDelete("enrollments", { course_id: courseId, profile_id: userId });
      const courseActivityIds = state.activities.filter((activity) => activity.courseId === courseId).map((activity) => activity.id);
      await Promise.all([
        ...courseActivityIds.map((activityId) => supabaseDelete("submissions", { activity_id: activityId, profile_id: userId })),
        supabaseDelete("completion_records", { course_id: courseId, profile_id: userId })
      ]);
    } catch (error) {
      console.warn("Supabase unenrollment sync ignored:", error);
    }
  }
  addNotification({ userId, title: "Retrait du cours", message: `Votre accès au cours ${course.title} a été retiré.`, level: "warning" });
  addLog(userId, `Retrait du cours ${course.title}`);
  await publishPlatformEvent("enrollment.removed", {
    courseId,
    userId,
    actorId: actor?.id || null
  });
  saveState();
}

function openEnrollmentModal() {
  const user = getCurrentUser();
  const available = state.courses.filter((course) => course.status === "published" && !course.enrolledUserIds.includes(user.id));
  openModal(`
    <h2>Inscription à un cours</h2>
    <p class="section-subtitle">Choisissez un parcours à ajouter à votre espace personnel.</p>
    <div class="simple-list" style="margin-top:18px">
      ${available.length ? available.map((course) => `<div class="module-card"><div class="toolbar" style="justify-content:space-between"><div><strong>${escapeHtml(course.title)}</strong><div class="meta">${escapeHtml(course.description)}</div></div><button class="btn-primary" onclick="enrollUser('${course.id}','${user.id}'); closeModal();">S'inscrire</button></div></div>`).join("") : `<div class="empty-state">Tous les cours publiés sont déjà présents dans votre espace.</div>`}
    </div>
  `);
}

function openCourseEnrollmentModal(courseId = "") {
  const actor = getCurrentUser();
  const eligibleCourses = state.courses.filter((course) => canManageEnrollment(course, actor) && course.status !== "archived");
  const selectedCourse = eligibleCourses.find((course) => course.id === courseId) || eligibleCourses[0] || null;
  const availableStudents = state.users.filter((user) => user.role === "student");
  openModal(`
    <h2>Affecter un élève à un cours</h2>
    <p class="section-subtitle">L'administrateur peut affecter un apprenant à tout cours. L'enseignant peut affecter un apprenant à ses propres cours.</p>
    ${eligibleCourses.length ? `<div class="toolbar" style="margin-top:18px"><button class="btn-ghost" onclick="openBulkEnrollmentModal('${selectedCourse?.id || ""}')">Import en masse</button></div>` : ""}
    <form id="course-enrollment-form" class="form-grid" style="margin-top:18px">
      <div class="field">
        <label for="enrollment-course">Cours</label>
        <select id="enrollment-course" name="courseId" required>
          ${eligibleCourses.map((course) => `<option value="${course.id}" ${selectedCourse?.id === course.id ? "selected" : ""}>${escapeHtml(course.title)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label for="enrollment-student">Élève</label>
        <select id="enrollment-student" name="userId" required>
          ${availableStudents.map((student) => `<option value="${student.id}">${escapeHtml(student.name)} · ${escapeHtml(student.email)}</option>`).join("")}
        </select>
      </div>
      <div class="field full">
        <button class="btn-primary" type="submit" ${!eligibleCourses.length || !availableStudents.length ? "disabled" : ""}>Ajouter au cours</button>
      </div>
    </form>
    ${!eligibleCourses.length ? `<div class="empty-state" style="margin-top:18px">Aucun cours disponible pour cette affectation.</div>` : ""}
    ${eligibleCourses.length ? `<div class="simple-list" style="margin-top:18px">
      ${eligibleCourses.map((course) => `<div class="module-card"><strong>${escapeHtml(course.title)}</strong><div class="meta">${course.enrolledUserIds.length} élève(s) inscrit(s)</div></div>`).join("")}
    </div>` : ""}
  `);
}

function openCourseRosterModal(courseId = "") {
  const actor = getCurrentUser();
  const eligibleCourses = state.courses.filter((course) => canManageEnrollment(course, actor));
  const selectedCourse = eligibleCourses.find((course) => course.id === courseId) || eligibleCourses[0] || null;
  const students = selectedCourse ? getCourseStudents(selectedCourse) : [];
  openModal(`
    <h2>Élèves inscrits</h2>
    <p class="section-subtitle">Consultez la cohorte du cours sélectionné et retirez un élève si nécessaire.</p>
    ${eligibleCourses.length ? `
      <div class="field" style="margin-top:18px">
        <label for="roster-course">Cours</label>
        <select id="roster-course" onchange="openCourseRosterModal(this.value)">
          ${eligibleCourses.map((course) => `<option value="${course.id}" ${selectedCourse?.id === course.id ? "selected" : ""}>${escapeHtml(course.title)}</option>`).join("")}
        </select>
      </div>
    ` : ""}
    <div class="simple-list" style="margin-top:18px">
      ${selectedCourse ? (
        students.length
          ? students.map((student) => `<div class="module-card"><div class="toolbar" style="justify-content:space-between"><div><strong>${escapeHtml(student.name)}</strong><div class="meta">${escapeHtml(student.email)}</div></div><button class="btn-ghost" onclick="unenrollUser('${selectedCourse.id}','${student.id}'); openCourseRosterModal('${selectedCourse.id}')">Retirer</button></div></div>`).join("")
          : `<div class="empty-state">Aucun élève inscrit dans ce cours.</div>`
      ) : `<div class="empty-state">Aucun cours disponible pour cette gestion.</div>`}
    </div>
  `);
}

function openBulkEnrollmentModal(courseId = "") {
  const actor = getCurrentUser();
  const eligibleCourses = state.courses.filter((course) => canManageEnrollment(course, actor) && course.status !== "archived");
  const selectedCourse = eligibleCourses.find((course) => course.id === courseId) || eligibleCourses[0] || null;
  openModal(`
    <h2>Import en masse des élèves</h2>
    <p class="section-subtitle">Collez une liste avec une ligne par élève. Formats acceptés : <strong>Nom, email</strong>, <strong>Nom; email</strong> ou simplement <strong>email</strong>.</p>
    <form id="bulk-enrollment-form" class="form-grid" style="margin-top:18px">
      <div class="field">
        <label for="bulk-course">Cours</label>
        <select id="bulk-course" name="courseId" required>
          ${eligibleCourses.map((course) => `<option value="${course.id}" ${selectedCourse?.id === course.id ? "selected" : ""}>${escapeHtml(course.title)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label for="bulk-default-password">Mot de passe initial</label>
        <input id="bulk-default-password" name="defaultPassword" value="Student123!" required>
      </div>
      <div class="field full">
        <label for="bulk-students">Liste des élèves</label>
        <textarea id="bulk-students" name="studentsRaw" placeholder="Ama Kossi, ama@email.com&#10;yaovi@email.com&#10;Kokou Mensah; kokou@email.com" required></textarea>
      </div>
      <div class="field full">
        <button class="btn-primary" type="submit" ${!eligibleCourses.length ? "disabled" : ""}>Importer et inscrire</button>
      </div>
    </form>
    ${!eligibleCourses.length ? `<div class="empty-state" style="margin-top:18px">Aucun cours disponible pour cet import.</div>` : ""}
  `);
}

function openProfileModal() {
  const user = getCurrentUser();
  openModal(`
    <h2>Profil utilisateur</h2>
    <div class="simple-list" style="margin-top:18px">
      <div class="module-card"><strong>Nom</strong><div class="meta">${escapeHtml(user.name)}</div></div>
      <div class="module-card"><strong>Email</strong><div class="meta">${escapeHtml(user.email)}</div></div>
      <div class="module-card"><strong>Profil</strong><div class="meta">${roleLabels[user.role]}</div></div>
      <div class="module-card"><strong>Biographie</strong><div class="meta">${escapeHtml(user.bio || "Aucune biographie")}</div></div>
    </div>
  `);
}

function showContactSalesModal() {
  openModal(`
    <h2>Demande d'inscription Formation Pro</h2>
    <p class="section-subtitle">Utilisez ce formulaire pour être recontacté par notre équipe avant validation de l'inscription et du paiement.</p>
    <div class="simple-list" style="margin-top:18px">
      <div class="module-card"><strong>WhatsApp</strong><div class="meta">+228 93 76 76 21</div></div>
      <div class="module-card"><strong>Email commercial</strong><div class="meta">contact@adsl2ef.tg</div></div>
      <div class="module-card"><strong>Mode de traitement</strong><div class="meta">Pré-inscription, validation du paiement Mixx ou Flooz, puis activation de l'accès.</div></div>
    </div>
  `);
}

function openPlatformSettings() {
  const persistence = state.config.persistence || structuredClone(starterData).config.persistence;
  const config = state.config.googleSheets;
  const jsonbin = state.config.jsonbin;
  const supabase = state.config.supabase || structuredClone(starterData).config.supabase;
  const site = state.config.site;
  const payments = state.config.payments;
  const apiStatusText = persistence.mode === "supabase"
    ? (supabase.enabled && supabase.url && supabase.anonKey
      ? "Mode Supabase préparé. Appliquez le schéma SQL puis branchez l'authentification et les tables."
      : "Mode Supabase sélectionné. Renseignez l'URL, la clé anonyme et appliquez le schéma SQL.")
    : runtimeState.apiStatus === "error"
      ? `Backend indisponible : ${runtimeState.apiMessage || "le serveur backend local n'est pas lancé ou l'URL n'est pas correcte"}`
      : runtimeState.apiStatus === "success"
        ? "Backend connecté"
        : runtimeState.apiStatus === "syncing"
          ? "Synchronisation backend en cours"
          : "Backend prêt à être configuré";
  openModal(`
    <h2>Paramètres du site</h2>
    <p class="section-subtitle">Modifiez ici l'identité du site, les contacts, les paiements et la synchronisation des données.</p>
    <div class="announcement" style="margin-top:14px">${escapeHtml(apiStatusText)}</div>
    <form id="settings-form" class="form-grid" style="margin-top:18px">
      <div class="field full"><label for="site-headline">Titre du site</label><input id="site-headline" name="siteHeadline" value="${escapeHtml(site.headline)}"></div>
      <div class="field full"><label for="site-banner">Bannière principale</label><input id="site-banner" name="siteBanner" value="${escapeHtml(site.banner)}"></div>
      <div class="field full"><label for="site-subbanner">Sous-bannière</label><input id="site-subbanner" name="siteSubBanner" value="${escapeHtml(site.subBanner)}"></div>
      <div class="field"><label for="site-phone">Téléphone</label><input id="site-phone" name="sitePhone" value="${escapeHtml(site.contactPhone)}"></div>
      <div class="field"><label for="site-email">Email</label><input id="site-email" name="siteEmail" value="${escapeHtml(site.contactEmail)}"></div>
      <div class="field full"><label for="site-address">Adresse</label><input id="site-address" name="siteAddress" value="${escapeHtml(site.contactAddress)}"></div>
      <div class="field full"><label for="site-whatsapp">Lien WhatsApp</label><input id="site-whatsapp" name="siteWhatsapp" value="${escapeHtml(site.whatsappUrl)}"></div>
      <div class="field"><label for="mixx-enabled">Mixx by Yas</label><select id="mixx-enabled" name="mixxEnabled"><option value="true" ${payments.mixxEnabled ? "selected" : ""}>Activé</option><option value="false" ${!payments.mixxEnabled ? "selected" : ""}>Désactivé</option></select></div>
      <div class="field"><label for="flooz-enabled">Flooz</label><select id="flooz-enabled" name="floozEnabled"><option value="true" ${payments.floozEnabled ? "selected" : ""}>Activé</option><option value="false" ${!payments.floozEnabled ? "selected" : ""}>Désactivé</option></select></div>
      <div class="field"><label for="payment-mode">Mode de paiement</label><select id="payment-mode" name="paymentMode"><option value="manual" ${payments.mode === "manual" ? "selected" : ""}>Validation manuelle</option><option value="callback" ${payments.mode === "callback" ? "selected" : ""}>Callback automatique</option></select></div>
      <div class="field"><label for="payment-callback">URL callback</label><input id="payment-callback" name="paymentCallback" value="${escapeHtml(payments.callbackUrl)}" placeholder="https://votre-api/paiement"></div>
      <div class="field"><label for="merchant-mixx">Compte Mixx</label><input id="merchant-mixx" name="merchantMixx" value="${escapeHtml(payments.merchantMixx)}"></div>
      <div class="field"><label for="merchant-flooz">Compte Flooz</label><input id="merchant-flooz" name="merchantFlooz" value="${escapeHtml(payments.merchantFlooz)}"></div>
      <div class="field"><label for="persistence-mode">Mode de persistance</label><select id="persistence-mode" name="persistenceMode"><option value="local" ${persistence.mode === "local" ? "selected" : ""}>Local sécurisé temporaire</option><option value="jsonbin" ${persistence.mode === "jsonbin" ? "selected" : ""}>JSONBin pour contenus</option><option value="api" ${persistence.mode === "api" ? "selected" : ""}>API backend</option><option value="supabase" ${persistence.mode === "supabase" ? "selected" : ""}>Supabase</option></select></div>
      <div class="field"><label for="persistence-api-base">Base URL API</label><input id="persistence-api-base" name="persistenceApiBaseUrl" value="${escapeHtml(persistence.apiBaseUrl || "")}" placeholder="https://votre-api.com"></div>
      <div class="field"><label for="persistence-health-path">Route test backend</label><input id="persistence-health-path" name="persistenceHealthPath" value="${escapeHtml(persistence.healthPath || "/health")}" placeholder="/health"></div>
      <div class="field"><label for="persistence-api-path">Chemin snapshot</label><input id="persistence-api-path" name="persistenceApiSnapshotPath" value="${escapeHtml(persistence.apiSnapshotPath || "/lms/state")}" placeholder="/lms/state"></div>
      <div class="field"><label for="persistence-auth-me-path">Route session courante</label><input id="persistence-auth-me-path" name="persistenceAuthMePath" value="${escapeHtml(persistence.authMePath || "/auth/me")}" placeholder="/auth/me"></div>
      <div class="field"><label for="persistence-summary-path">Route résumé</label><input id="persistence-summary-path" name="persistenceSummaryPath" value="${escapeHtml(persistence.summaryPath || "/lms/summary")}" placeholder="/lms/summary"></div>
      <div class="field"><label for="persistence-events-read-path">Route événements</label><input id="persistence-events-read-path" name="persistenceEventsReadPath" value="${escapeHtml(persistence.eventsReadPath || "/lms/events")}" placeholder="/lms/events"></div>
      <div class="field full"><label for="persistence-api-token">Jeton API</label><input id="persistence-api-token" name="persistenceApiToken" value="${escapeHtml(persistence.apiToken || "")}" placeholder="Bearer token ou clé d'API"></div>
      <div class="field"><label for="persistence-login-path">Route connexion</label><input id="persistence-login-path" name="persistenceAuthLoginPath" value="${escapeHtml(persistence.authLoginPath || "/auth/login")}" placeholder="/auth/login"></div>
      <div class="field"><label for="persistence-register-path">Route inscription</label><input id="persistence-register-path" name="persistenceAuthRegisterPath" value="${escapeHtml(persistence.authRegisterPath || "/auth/register")}" placeholder="/auth/register"></div>
        <div class="field"><label for="persistence-payment-path">Route paiement</label><input id="persistence-payment-path" name="persistencePaymentInitPath" value="${escapeHtml(persistence.paymentInitPath || "/payments/init")}" placeholder="/payments/init"></div>
        <div class="field"><label for="persistence-payment-status-path">Route statut paiement</label><input id="persistence-payment-status-path" name="persistencePaymentStatusPath" value="${escapeHtml(persistence.paymentStatusPath || "/payments/status")}" placeholder="/payments/status"></div>
        <div class="field full"><label for="persistence-operations-path">Route événements métier</label><input id="persistence-operations-path" name="persistenceOperationsPath" value="${escapeHtml(persistence.operationsPath || "/lms/events")}" placeholder="/lms/events"></div>
      <div class="field"><label for="sheet-enabled">Activation</label><select id="sheet-enabled" name="enabled"><option value="false" ${!config.enabled ? "selected" : ""}>Desactive</option><option value="true" ${config.enabled ? "selected" : ""}>Active</option></select></div>
      <div class="field"><label for="sheet-url">Google Apps Script URL</label><input id="sheet-url" name="webAppUrl" value="${escapeHtml(config.webAppUrl || "")}" placeholder="https://script.google.com/macros/s/.../exec"></div>
      <div class="field"><label for="jsonbin-enabled">JSONBin</label><select id="jsonbin-enabled" name="jsonbinEnabled"><option value="false" ${!jsonbin.enabled ? "selected" : ""}>Desactive</option><option value="true" ${jsonbin.enabled ? "selected" : ""}>Active</option></select></div>
      <div class="field"><label for="jsonbin-binid">Bin ID</label><input id="jsonbin-binid" name="jsonbinBinId" value="${escapeHtml(jsonbin.binId || "")}" placeholder="6789abcd..."></div>
      <div class="field full"><label for="jsonbin-key">Master Key</label><input id="jsonbin-key" name="jsonbinApiKey" value="${escapeHtml(jsonbin.apiKey || "")}" placeholder="$2b$10$..."></div>
      <div class="field full"><label for="jsonbin-access">Access Key optionnelle</label><input id="jsonbin-access" name="jsonbinAccessKey" value="${escapeHtml(jsonbin.accessKey || "")}" placeholder="$2a$..."></div>
      <div class="field"><label for="supabase-enabled">Supabase</label><select id="supabase-enabled" name="supabaseEnabled"><option value="false" ${!supabase.enabled ? "selected" : ""}>Désactivé</option><option value="true" ${supabase.enabled ? "selected" : ""}>Activé</option></select></div>
      <div class="field"><label for="supabase-project-ref">Project Ref</label><input id="supabase-project-ref" name="supabaseProjectRef" value="${escapeHtml(supabase.projectRef || "")}" placeholder="cawhebskwvnnvwetmxyd"></div>
      <div class="field full"><label for="supabase-url">URL Supabase</label><input id="supabase-url" name="supabaseUrl" value="${escapeHtml(supabase.url || "")}" placeholder="https://xxxx.supabase.co"></div>
      <div class="field full"><label for="supabase-anon-key">Clé anonyme</label><input id="supabase-anon-key" name="supabaseAnonKey" value="${escapeHtml(supabase.anonKey || "")}" placeholder="eyJhbGciOi..."></div>
      <div class="field"><label for="supabase-storage-bucket">Bucket de fichiers</label><input id="supabase-storage-bucket" name="supabaseStorageBucket" value="${escapeHtml(supabase.storageBucket || "adsl2ef-files")}" placeholder="adsl2ef-files"></div>
      <div class="field full"><button class="btn-primary" type="submit">Enregistrer</button></div>
    </form>
    <div class="toolbar" style="margin-top:14px">
      <button class="btn-ghost" onclick="refreshCoursesFromJsonBin()">Recharger les cours depuis JSONBin</button>
      <span class="tiny">Dernière synchro JSONBin : ${escapeHtml(jsonbin.lastSyncAt ? formatDate(jsonbin.lastSyncAt) : "jamais")}</span>
    </div>
    <div class="toolbar" style="margin-top:8px">
      <button class="btn-ghost" onclick="testApiConnection()">Tester le backend</button>
      <button class="btn-ghost" onclick="openBackendSummary()">Résumé backend</button>
      <button class="btn-ghost" onclick="openBackendEvents()">Événements backend</button>
      <button class="btn-ghost" onclick="syncPlatformNow()">Synchroniser la plateforme</button>
      <button class="btn-ghost" onclick="exportSupabaseSeedSql()">Exporter l'amorçage SQL</button>
      <span class="tiny">Dernière synchro backend : ${escapeHtml(persistence.lastRemoteSyncAt ? formatDate(persistence.lastRemoteSyncAt) : "jamais")}</span>
    </div>
    <div class="toolbar" style="margin-top:8px">
      <span class="tiny">Supabase : ${escapeHtml(supabase.lastSyncAt ? formatDate(supabase.lastSyncAt) : "non configuré")}</span>
      <span class="tiny">Schéma conseillé : /supabase/schema.sql</span>
    </div>
  `);
}

function openUserBuilder() {
  openModal(`
    <h2>Créer un utilisateur</h2>
    <form id="admin-user-form" class="form-grid" style="margin-top:18px">
      <div class="field"><label for="admin-user-name">Nom complet</label><input id="admin-user-name" name="name" required></div>
      <div class="field"><label for="admin-user-role">Profil</label><select id="admin-user-role" name="role"><option value="student">Apprenant</option><option value="teacher">Enseignant</option><option value="admin">Administrateur</option></select></div>
      <div class="field full"><label for="admin-user-email">Email</label><input id="admin-user-email" name="email" type="email" required></div>
      <div class="field full"><label for="admin-user-password">Mot de passe</label><input id="admin-user-password" name="password" type="password" required></div>
      <div class="field full"><button class="btn-primary" type="submit">Créer l'utilisateur</button></div>
    </form>
  `);
}

function openCourseBuilder() {
  const teachers = state.users.filter((user) => user.role === "teacher");
  openModal(`
    <h2>Créer un cours</h2>
    <p class="section-subtitle">Le cours est créé avec un premier module et une première leçon pour accélérer la mise en place.</p>
    <form id="course-form" class="form-grid" style="margin-top:18px">
      <div class="field"><label for="course-title">Titre</label><input id="course-title" name="title" required></div>
      <div class="field"><label for="course-category">Catégorie</label><input id="course-category" name="category" required placeholder="Lycée, Formation Pro..."></div>
      <div class="field"><label for="course-audience">Audience</label><input id="course-audience" name="audience" required placeholder="Terminale D, Enseignants..."></div>
      <div class="field"><label for="course-duration">Durée</label><input id="course-duration" name="duration" required placeholder="8 semaines"></div>
      <div class="field full"><label for="course-image">Image de couverture</label><input id="course-image" name="image" placeholder="https://..."></div>
      <div class="field full"><label for="course-description">Description</label><textarea id="course-description" name="description" required></textarea></div>
      <div class="field"><label for="course-teacher">Enseignant</label><select id="course-teacher" name="teacherId">${teachers.map((teacher) => `<option value="${teacher.id}">${escapeHtml(teacher.name)}</option>`).join("")}</select></div>
      <div class="field"><label for="course-status">Statut</label><select id="course-status" name="status"><option value="draft">Brouillon</option><option value="published">Publié</option></select></div>
      <div class="field full"><button class="btn-primary" type="submit">Créer le cours</button></div>
    </form>
  `);
}

function openActivityBuilder(courseId) {
  const course = getCourseById(courseId || state.ui.activeCourseId);
  if (!course) return;
  openModal(`
    <h2>Ajouter une activité</h2>
    <form id="activity-form" data-course-id="${course.id}" class="form-grid" style="margin-top:18px">
      <div class="field"><label for="activity-title">Titre</label><input id="activity-title" name="title" required></div>
      <div class="field"><label for="activity-type">Type</label><select id="activity-type" name="type"><option value="assignment">Devoir</option><option value="quiz">Quiz</option></select></div>
      <div class="field"><label for="activity-module">Module</label><select id="activity-module" name="moduleId">${course.modules.map((module) => `<option value="${module.id}">${escapeHtml(module.title)}</option>`).join("")}</select></div>
      <div class="field"><label for="activity-due">Échéance</label><input id="activity-due" name="dueDate" type="date" required></div>
      <div class="field"><label for="activity-time-limit">Temps quiz (min)</label><input id="activity-time-limit" name="timeLimitMinutes" type="number" min="5" value="20"></div>
      <div class="field"><label for="activity-attempts">Tentatives</label><input id="activity-attempts" name="attemptsAllowed" type="number" min="1" value="1"></div>
      <div class="field"><label for="activity-passing">Seuil de réussite (%)</label><input id="activity-passing" name="passingScore" type="number" min="0" max="100" value="60"></div>
      <div class="field"><label for="activity-max-points">Barème devoir</label><input id="activity-max-points" name="maxPoints" type="number" min="1" value="20"></div>
      <div class="field"><label for="activity-weight">Poids dans la note</label><input id="activity-weight" name="weight" type="number" min="1" value="1"></div>
      <div class="field full"><label for="activity-description">Description</label><textarea id="activity-description" name="description" required></textarea></div>
      <div class="field full"><button class="btn-primary" type="submit">Créer l'activité</button></div>
    </form>
  `);
}

function openUserEditor(userId) {
  const user = getUserById(userId);
  if (!user) return;
  openModal(`
    <h2>Modifier l'utilisateur</h2>
    <form id="admin-user-edit-form" data-user-id="${user.id}" class="form-grid" style="margin-top:18px">
      <div class="field"><label for="edit-user-name">Nom complet</label><input id="edit-user-name" name="name" value="${escapeHtml(user.name)}" required></div>
      <div class="field"><label for="edit-user-role">Profil</label><select id="edit-user-role" name="role"><option value="student" ${user.role === "student" ? "selected" : ""}>Apprenant</option><option value="teacher" ${user.role === "teacher" ? "selected" : ""}>Enseignant</option><option value="admin" ${user.role === "admin" ? "selected" : ""}>Administrateur</option></select></div>
      <div class="field full"><label for="edit-user-email">Email</label><input id="edit-user-email" name="email" type="email" value="${escapeHtml(user.email)}" required></div>
      <div class="field full"><label for="edit-user-password">Mot de passe</label><input id="edit-user-password" name="password" type="text" value="${escapeHtml(user.password)}" required></div>
      <div class="field full"><label for="edit-user-bio">Biographie</label><textarea id="edit-user-bio" name="bio">${escapeHtml(user.bio || "")}</textarea></div>
      <div class="field full"><button class="btn-primary" type="submit">Enregistrer</button></div>
    </form>
  `);
}

function openCourseEditor(courseId) {
  const course = getCourseById(courseId);
  const teachers = state.users.filter((user) => user.role === "teacher");
  if (!course) return;
  openModal(`
    <h2>Modifier le cours</h2>
    <form id="course-edit-form" data-course-id="${course.id}" class="form-grid" style="margin-top:18px">
      <div class="field"><label for="edit-course-title">Titre</label><input id="edit-course-title" name="title" value="${escapeHtml(course.title)}" required></div>
      <div class="field"><label for="edit-course-category">Catégorie</label><input id="edit-course-category" name="category" value="${escapeHtml(course.category)}" required></div>
      <div class="field"><label for="edit-course-audience">Audience</label><input id="edit-course-audience" name="audience" value="${escapeHtml(course.audience || "")}" required></div>
      <div class="field"><label for="edit-course-duration">Durée</label><input id="edit-course-duration" name="duration" value="${escapeHtml(course.duration || "")}" required></div>
      <div class="field full"><label for="edit-course-image">Image</label><input id="edit-course-image" name="image" value="${escapeHtml(course.image || "")}"></div>
      <div class="field full"><label for="edit-course-description">Description</label><textarea id="edit-course-description" name="description" required>${escapeHtml(course.description)}</textarea></div>
      <div class="field"><label for="edit-course-teacher">Enseignant</label><select id="edit-course-teacher" name="teacherId">${teachers.map((teacher) => `<option value="${teacher.id}" ${teacher.id === course.teacherId ? "selected" : ""}>${escapeHtml(teacher.name)}</option>`).join("")}</select></div>
      <div class="field"><label for="edit-course-status">Statut</label><select id="edit-course-status" name="status"><option value="draft" ${course.status === "draft" ? "selected" : ""}>Brouillon</option><option value="published" ${course.status === "published" ? "selected" : ""}>Publié</option></select></div>
      <div class="field full"><button class="btn-primary" type="submit">Enregistrer</button></div>
    </form>
  `);
}

function openActivityEditor(activityId) {
  const activity = getActivityById(activityId);
  const course = getCourseById(activity?.courseId);
  if (!activity || !course) return;
  openModal(`
    <h2>Modifier l'activité</h2>
    <form id="activity-edit-form" data-activity-id="${activity.id}" class="form-grid" style="margin-top:18px">
      <div class="field"><label for="edit-activity-title">Titre</label><input id="edit-activity-title" name="title" value="${escapeHtml(activity.title)}" required></div>
      <div class="field"><label for="edit-activity-type">Type</label><select id="edit-activity-type" name="type"><option value="assignment" ${activity.type === "assignment" ? "selected" : ""}>Devoir</option><option value="quiz" ${activity.type === "quiz" ? "selected" : ""}>Quiz</option></select></div>
      <div class="field"><label for="edit-activity-module">Module</label><select id="edit-activity-module" name="moduleId">${course.modules.map((module) => `<option value="${module.id}" ${activity.moduleId === module.id ? "selected" : ""}>${escapeHtml(module.title)}</option>`).join("")}</select></div>
      <div class="field"><label for="edit-activity-due">Échéance</label><input id="edit-activity-due" name="dueDate" type="date" value="${new Date(activity.dueDate).toISOString().slice(0, 10)}" required></div>
      <div class="field"><label for="edit-activity-time-limit">Temps quiz (min)</label><input id="edit-activity-time-limit" name="timeLimitMinutes" type="number" min="5" value="${activity.timeLimitMinutes || 20}"></div>
      <div class="field"><label for="edit-activity-attempts">Tentatives</label><input id="edit-activity-attempts" name="attemptsAllowed" type="number" min="1" value="${activity.attemptsAllowed || 1}"></div>
      <div class="field"><label for="edit-activity-passing">Seuil de réussite (%)</label><input id="edit-activity-passing" name="passingScore" type="number" min="0" max="100" value="${activity.passingScore || 60}"></div>
      <div class="field"><label for="edit-activity-max-points">Barème devoir</label><input id="edit-activity-max-points" name="maxPoints" type="number" min="1" value="${activity.maxPoints || 20}"></div>
      <div class="field"><label for="edit-activity-weight">Poids dans la note</label><input id="edit-activity-weight" name="weight" type="number" min="1" value="${activity.weight || 1}"></div>
      <div class="field full"><label for="edit-activity-description">Description</label><textarea id="edit-activity-description" name="description" required>${escapeHtml(activity.description)}</textarea></div>
      <div class="field full"><button class="btn-primary" type="submit">Enregistrer les modifications</button></div>
    </form>
  `);
}

function openQuizEditor(activityId) {
  const activity = getActivityById(activityId);
  if (!activity || activity.type !== "quiz") return;
  openModal(`
    <h2>Configurer le quiz</h2>
    <p class="section-subtitle">Ajustez les paramètres pédagogiques et enrichissez les questions.</p>
    <form id="quiz-settings-form" data-activity-id="${activity.id}" class="form-grid" style="margin-top:18px">
      <div class="field full"><label for="quiz-title">Titre</label><input id="quiz-title" name="title" value="${escapeHtml(activity.title)}" required></div>
      <div class="field"><label for="quiz-time">Temps imparti (min)</label><input id="quiz-time" name="timeLimitMinutes" type="number" min="5" value="${activity.timeLimitMinutes || 20}"></div>
      <div class="field"><label for="quiz-attempts">Tentatives autorisées</label><input id="quiz-attempts" name="attemptsAllowed" type="number" min="1" value="${activity.attemptsAllowed || 1}"></div>
      <div class="field"><label for="quiz-passing">Seuil de réussite (%)</label><input id="quiz-passing" name="passingScore" type="number" min="0" max="100" value="${activity.passingScore || 60}"></div>
      <div class="field"><label for="quiz-weight">Poids dans la note</label><input id="quiz-weight" name="weight" type="number" min="1" value="${activity.weight || 1}"></div>
      <div class="field full"><label for="quiz-description">Consignes</label><textarea id="quiz-description" name="description" required>${escapeHtml(activity.description)}</textarea></div>
      <div class="field full"><button class="btn-primary" type="submit">Enregistrer</button></div>
    </form>
    <div class="panel" style="margin-top:18px">
      <div class="toolbar" style="justify-content:space-between">
        <h3>Questions actuelles</h3>
        <div class="toolbar">
          <button class="btn-ghost" onclick="openQuestionBankBuilder('${activity.courseId}','${activity.id}')">Ajouter depuis la banque</button>
          <button class="btn-ghost" onclick="exportQuizResults('${activity.id}')">Exporter les résultats</button>
        </div>
      </div>
      <div class="simple-list" style="margin-top:18px">
        ${(activity.questions || []).map((question, index) => `
          <div class="module-card">
            <div class="toolbar" style="justify-content:space-between">
              <div>
                <strong>Question ${index + 1}</strong>
                <div class="meta">${escapeHtml(question.prompt)}</div>
                <div class="tiny" style="margin-top:8px">${question.points} point(s) · ${escapeHtml(question.kind)}</div>
              </div>
              <div class="toolbar">
                <button class="btn-ghost" onclick="openQuizQuestionEditor('${activity.id}','${question.id}')">Modifier</button>
                <button class="btn-ghost" onclick="removeQuestionFromQuiz('${activity.id}','${question.id}')">Supprimer</button>
              </div>
            </div>
          </div>
        `).join("") || `<div class="empty-state">Aucune question pour ce quiz.</div>`}
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <h3>Créer une question</h3>
      <form id="question-bank-form" data-course-id="${activity.courseId}" data-activity-id="${activity.id}" class="form-grid" style="margin-top:18px">
        <div class="field full"><label for="qb-prompt">Intitulé</label><textarea id="qb-prompt" name="prompt" required></textarea></div>
        <div class="field"><label for="qb-kind">Type</label><select id="qb-kind" name="kind"><option value="mcq">QCM</option><option value="truefalse">Vrai / Faux</option><option value="short">Réponse courte</option><option value="open">Réponse ouverte</option></select></div>
        <div class="field"><label for="qb-points">Points</label><input id="qb-points" name="points" type="number" min="1" value="5"></div>
        <div class="field full"><label for="qb-options">Options (une par ligne pour QCM / vrai-faux)</label><textarea id="qb-options" name="options" placeholder="Option A&#10;Option B&#10;Option C"></textarea></div>
        <div class="field full"><label for="qb-answer">Bonne réponse ou repère</label><input id="qb-answer" name="answer" placeholder="Option A ou réponse attendue"></div>
        <div class="field full"><button class="btn-primary" type="submit">Ajouter à la banque et au quiz</button></div>
      </form>
    </div>
  `);
}

function openQuestionBankBuilder(courseId, activityId = "") {
  const questions = getQuestionBankForCourse(courseId);
  openModal(`
    <h2>Banque de questions</h2>
    <p class="section-subtitle">Réutilisez les questions existantes ou créez-en de nouvelles.</p>
    <div class="simple-list" style="margin-top:18px">
      ${questions.length ? questions.map((question) => `
        <div class="module-card">
          <div class="toolbar" style="justify-content:space-between">
            <div>
              <strong>${escapeHtml(question.prompt)}</strong>
              <div class="meta">${escapeHtml(question.kind)} · ${question.points} point(s)</div>
            </div>
            <div class="toolbar">
              ${activityId ? `<button class="btn-ghost" onclick="attachQuestionToQuiz('${activityId}','${question.id}')">Ajouter au quiz</button>` : ""}
              <button class="btn-ghost" onclick="openQuestionBankEditModal('${question.id}','${activityId}')">Modifier</button>
              <button class="btn-ghost" onclick="removeQuestionFromBank('${question.id}','${activityId}')">Supprimer</button>
            </div>
          </div>
        </div>
      `).join("") : `<div class="empty-state">Aucune question enregistrée pour ce cours.</div>`}
    </div>
    <form id="question-bank-form" data-course-id="${courseId}" data-activity-id="${activityId}" class="form-grid" style="margin-top:18px">
      <div class="field full"><label for="bank-prompt">Nouvelle question</label><textarea id="bank-prompt" name="prompt" required></textarea></div>
      <div class="field"><label for="bank-kind">Type</label><select id="bank-kind" name="kind"><option value="mcq">QCM</option><option value="truefalse">Vrai / Faux</option><option value="short">Réponse courte</option><option value="open">Réponse ouverte</option></select></div>
      <div class="field"><label for="bank-points">Points</label><input id="bank-points" name="points" type="number" min="1" value="5"></div>
      <div class="field full"><label for="bank-options">Options (une par ligne)</label><textarea id="bank-options" name="options"></textarea></div>
      <div class="field full"><label for="bank-answer">Réponse attendue</label><input id="bank-answer" name="answer"></div>
      <div class="field full"><button class="btn-primary" type="submit">Enregistrer la question</button></div>
    </form>
  `);
}

function openQuestionBankEditModal(questionId, activityId = "") {
  const question = getQuestionById(questionId);
  if (!question) return;
  openModal(`
    <h2>Modifier la question</h2>
    <form id="question-edit-form" data-question-id="${question.id}" data-activity-id="${activityId}" class="form-grid" style="margin-top:18px">
      <div class="field full"><label for="edit-question-prompt">Intitulé</label><textarea id="edit-question-prompt" name="prompt" required>${escapeHtml(question.prompt)}</textarea></div>
      <div class="field"><label for="edit-question-kind">Type</label><select id="edit-question-kind" name="kind"><option value="mcq" ${question.kind === "mcq" ? "selected" : ""}>QCM</option><option value="truefalse" ${question.kind === "truefalse" ? "selected" : ""}>Vrai / Faux</option><option value="short" ${question.kind === "short" ? "selected" : ""}>Réponse courte</option><option value="open" ${question.kind === "open" ? "selected" : ""}>Réponse ouverte</option></select></div>
      <div class="field"><label for="edit-question-points">Points</label><input id="edit-question-points" name="points" type="number" min="1" value="${question.points || 5}"></div>
      <div class="field full"><label for="edit-question-options">Options</label><textarea id="edit-question-options" name="options">${escapeHtml((question.options || []).join("\n"))}</textarea></div>
      <div class="field full"><label for="edit-question-answer">Réponse attendue</label><input id="edit-question-answer" name="answer" value="${escapeHtml(question.answer || "")}"></div>
      <div class="field full"><button class="btn-primary" type="submit">Enregistrer les modifications</button></div>
    </form>
  `);
}

function openQuizQuestionEditor(activityId, questionId) {
  const activity = getActivityById(activityId);
  const question = activity?.questions.find((item) => item.id === questionId);
  if (!activity || !question) return;
  openModal(`
    <h2>Modifier la question du quiz</h2>
    <form id="quiz-question-edit-form" data-activity-id="${activity.id}" data-question-id="${question.id}" class="form-grid" style="margin-top:18px">
      <div class="field full"><label for="edit-quiz-question-prompt">Intitulé</label><textarea id="edit-quiz-question-prompt" name="prompt" required>${escapeHtml(question.prompt)}</textarea></div>
      <div class="field"><label for="edit-quiz-question-kind">Type</label><select id="edit-quiz-question-kind" name="kind"><option value="mcq" ${question.kind === "mcq" ? "selected" : ""}>QCM</option><option value="truefalse" ${question.kind === "truefalse" ? "selected" : ""}>Vrai / Faux</option><option value="short" ${question.kind === "short" ? "selected" : ""}>Réponse courte</option><option value="open" ${question.kind === "open" ? "selected" : ""}>Réponse ouverte</option></select></div>
      <div class="field"><label for="edit-quiz-question-points">Points</label><input id="edit-quiz-question-points" name="points" type="number" min="1" value="${question.points || 5}"></div>
      <div class="field full"><label for="edit-quiz-question-options">Options</label><textarea id="edit-quiz-question-options" name="options">${escapeHtml((question.options || []).join("\n"))}</textarea></div>
      <div class="field full"><label for="edit-quiz-question-answer">Réponse attendue</label><input id="edit-quiz-question-answer" name="answer" value="${escapeHtml(question.answer || "")}"></div>
      <div class="field full"><button class="btn-primary" type="submit">Enregistrer</button></div>
    </form>
  `);
}

function getManageableCourses(user = getCurrentUser()) {
  if (!user) return [];
  if (user.role === "admin") return state.courses;
  if (user.role === "teacher") return state.courses.filter((course) => course.teacherId === user.id);
  return getVisibleCoursesForUser(user);
}

function openAnnouncementBuilder(courseId = "") {
  const courses = getManageableCourses();
  openModal(`
    <h2>Publier une annonce</h2>
    <form id="announcement-form" class="form-grid" style="margin-top:18px">
      <div class="field full">
        <label for="announcement-course">Cours</label>
        <select id="announcement-course" name="courseId">
          <option value="">Annonce générale</option>
          ${courses.map((course) => `<option value="${course.id}" ${course.id === courseId ? "selected" : ""}>${escapeHtml(course.title)}</option>`).join("")}
        </select>
      </div>
      <div class="field full"><label for="announcement-title">Titre</label><input id="announcement-title" name="title" required></div>
      <div class="field full"><label for="announcement-body">Message</label><textarea id="announcement-body" name="body" required></textarea></div>
      <div class="field full"><button class="btn-primary" type="submit">Publier l'annonce</button></div>
    </form>
  `);
}

function openMessageComposer(toUserId = "", courseId = "") {
  const currentUser = getCurrentUser();
  const recipients = getMessageRecipients(currentUser, courseId);
  const courses = getManageableCourses(currentUser);
  openModal(`
    <h2>Nouveau message</h2>
    <form id="message-form" class="form-grid" style="margin-top:18px">
      <div class="field">
        <label for="message-to">Destinataire</label>
        <select id="message-to" name="toUserId">
          ${recipients.length ? recipients.map((user) => `<option value="${user.id}" ${user.id === toUserId ? "selected" : ""}>${escapeHtml(user.name)} · ${roleLabels[user.role]}</option>`).join("") : `<option value="">Aucun destinataire disponible</option>`}
        </select>
      </div>
      <div class="field">
        <label for="message-course">Cours lié</label>
        <select id="message-course" name="courseId">
          <option value="">Aucun cours spécifique</option>
          ${courses.map((course) => `<option value="${course.id}" ${course.id === courseId ? "selected" : ""}>${escapeHtml(course.title)}</option>`).join("")}
        </select>
      </div>
      <div class="field full"><label for="message-subject">Sujet</label><input id="message-subject" name="subject" required></div>
      <div class="field full"><label for="message-content">Message</label><textarea id="message-content" name="content" required></textarea></div>
      <div class="field full"><button class="btn-primary" type="submit">Envoyer</button></div>
    </form>
  `);
}

function openForumBuilder(courseId = "") {
  const courses = getManageableCourses();
  openModal(`
    <h2>Nouvelle discussion</h2>
    <form id="forum-form" class="form-grid" style="margin-top:18px">
      <div class="field full">
        <label for="forum-course">Cours</label>
        <select id="forum-course" name="courseId" required>
          ${courses.map((course) => `<option value="${course.id}" ${course.id === courseId ? "selected" : ""}>${escapeHtml(course.title)}</option>`).join("")}
        </select>
      </div>
      <div class="field full"><label for="forum-title">Titre du sujet</label><input id="forum-title" name="title" required></div>
      <div class="field full"><label for="forum-content">Premier message</label><textarea id="forum-content" name="content" required></textarea></div>
      <div class="field full"><button class="btn-primary" type="submit">Créer la discussion</button></div>
    </form>
  `);
}

function openForumThreadModal(threadId) {
  const thread = state.forumThreads.find((item) => item.id === threadId);
  if (!thread) return;
  openModal(`
    <h2>${escapeHtml(thread.title)}</h2>
    <div class="simple-list" style="margin-top:18px">
      ${thread.posts.map((post) => {
        const author = getUserById(post.authorId);
        return `<div class="module-card"><strong>${escapeHtml(author?.name || "Utilisateur")}</strong><div class="meta" style="margin-top:8px">${escapeHtml(post.content)}</div><div class="tiny" style="margin-top:8px">${formatDate(post.createdAt)}</div></div>`;
      }).join("")}
    </div>
    <form id="forum-post-form" data-thread-id="${thread.id}" class="form-grid" style="margin-top:18px">
      <div class="field full"><label for="forum-reply">Répondre</label><textarea id="forum-reply" name="content" required placeholder="Ajoutez votre contribution..."></textarea></div>
      <div class="field full"><button class="btn-primary" type="submit">Publier la réponse</button></div>
    </form>
  `);
}

function openAttendanceModal(courseId = "") {
  const courses = getManageableCourses();
  const defaultCourseId = courseId || courses[0]?.id || "";
  const defaultCourse = getCourseById(defaultCourseId);
  const students = defaultCourse ? getCourseStudents(defaultCourse) : [];
  openModal(`
    <h2>Nouvelle séance d'assiduité</h2>
    <p class="section-subtitle">Enregistrez les présences d'une cohorte.</p>
    <form id="attendance-form" class="form-grid" style="margin-top:18px">
      <div class="field full">
        <label for="attendance-course">Cours</label>
        <select id="attendance-course" name="courseId">
          ${courses.map((course) => `<option value="${course.id}" ${course.id === defaultCourseId ? "selected" : ""}>${escapeHtml(course.title)}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label for="attendance-title">Intitulé</label><input id="attendance-title" name="title" required value="Séance de suivi"></div>
      <div class="field"><label for="attendance-date">Date</label><input id="attendance-date" name="sessionDate" type="date" required></div>
      <div class="field full">
        <label>Présences</label>
        <div class="simple-list">
          ${students.length ? students.map((student) => `
            <label class="module-card attendance-option">
              <div>
                <strong>${escapeHtml(student.name)}</strong>
                <div class="meta">${escapeHtml(student.email)}</div>
              </div>
              <select name="attendance-${student.id}">
                <option value="present">Présent</option>
                <option value="absent">Absent</option>
                <option value="late">Retard</option>
              </select>
            </label>
          `).join("") : `<div class="empty-state">Aucun apprenant inscrit dans cette cohorte.</div>`}
        </div>
      </div>
      <div class="field full"><button class="btn-primary" type="submit">Enregistrer la séance</button></div>
    </form>
  `);
}

function openModuleBuilder(courseId) {
  const course = getCourseById(courseId || state.ui.activeCourseId);
  if (!course) return;
  openModal(`
    <h2>Ajouter un module</h2>
    <form id="module-form" data-course-id="${course.id}" class="form-grid" style="margin-top:18px">
      <div class="field full"><label for="module-title">Titre du module</label><input id="module-title" name="title" required></div>
      <div class="field full"><label for="module-summary">Résumé</label><textarea id="module-summary" name="summary" required></textarea></div>
      <div class="field full"><button class="btn-primary" type="submit">Créer le module</button></div>
    </form>
  `);
}

function openModuleEditor(courseId, moduleId) {
  const course = getCourseById(courseId);
  const module = course?.modules.find((item) => item.id === moduleId);
  if (!course || !module) return;
  openModal(`
    <h2>Modifier le module</h2>
    <form id="module-edit-form" data-course-id="${course.id}" data-module-id="${module.id}" class="form-grid" style="margin-top:18px">
      <div class="field full"><label for="edit-module-title">Titre</label><input id="edit-module-title" name="title" value="${escapeHtml(module.title)}" required></div>
      <div class="field full"><label for="edit-module-summary">Résumé</label><textarea id="edit-module-summary" name="summary" required>${escapeHtml(module.summary)}</textarea></div>
      <div class="field full"><button class="btn-primary" type="submit">Enregistrer</button></div>
    </form>
  `);
}

function openLessonBuilder(courseId, moduleId) {
  const course = getCourseById(courseId || state.ui.activeCourseId);
  const module = course?.modules.find((item) => item.id === moduleId) || course?.modules[0];
  if (!course || !module) return;
  openModal(`
    <h2>Ajouter une leçon</h2>
    <form id="lesson-form" data-course-id="${course.id}" data-module-id="${module.id}" class="form-grid" style="margin-top:18px">
      <div class="field full"><label for="lesson-title">Titre</label><input id="lesson-title" name="title" required></div>
      <div class="field"><label for="lesson-type">Type</label><select id="lesson-type" name="type"><option value="reading">Lecture</option><option value="video">Vidéo</option><option value="pdf">PDF</option></select></div>
      <div class="field"><label for="lesson-duration">Durée</label><input id="lesson-duration" name="duration" required placeholder="15 min"></div>
      <div class="field full"><label for="lesson-content">Contenu</label><textarea id="lesson-content" name="content" required></textarea></div>
      <div class="field full"><label for="lesson-resource-title">Ressource principale</label><input id="lesson-resource-title" name="resourceTitle" placeholder="Support PDF"></div>
      <div class="field full"><label for="lesson-resource-url">Lien ressource</label><input id="lesson-resource-url" name="resourceUrl" placeholder="https://..."></div>
      <div class="field full"><button class="btn-primary" type="submit">Créer la leçon</button></div>
    </form>
  `);
}

function openLessonEditor(courseId, moduleId, lessonId) {
  const course = getCourseById(courseId);
  const module = course?.modules.find((item) => item.id === moduleId);
  const lesson = module?.lessons.find((item) => item.id === lessonId);
  if (!course || !module || !lesson) return;
  openModal(`
    <h2>Modifier la leçon</h2>
    <form id="lesson-edit-form" data-course-id="${course.id}" data-module-id="${module.id}" data-lesson-id="${lesson.id}" class="form-grid" style="margin-top:18px">
      <div class="field full"><label for="edit-lesson-title">Titre</label><input id="edit-lesson-title" name="title" value="${escapeHtml(lesson.title)}" required></div>
      <div class="field"><label for="edit-lesson-type">Type</label><select id="edit-lesson-type" name="type"><option value="reading" ${lesson.type === "reading" ? "selected" : ""}>Lecture</option><option value="video" ${lesson.type === "video" ? "selected" : ""}>Vidéo</option><option value="pdf" ${lesson.type === "pdf" ? "selected" : ""}>PDF</option></select></div>
      <div class="field"><label for="edit-lesson-duration">Durée</label><input id="edit-lesson-duration" name="duration" value="${escapeHtml(lesson.duration || "")}" required></div>
      <div class="field full"><label for="edit-lesson-content">Contenu</label><textarea id="edit-lesson-content" name="content" required>${escapeHtml(lesson.content || "")}</textarea></div>
      <div class="field full"><label for="edit-lesson-resource-title">Ressource principale</label><input id="edit-lesson-resource-title" name="resourceTitle" value="${escapeHtml(lesson.resources?.[0]?.title || "")}"></div>
      <div class="field full"><label for="edit-lesson-resource-url">Lien ressource</label><input id="edit-lesson-resource-url" name="resourceUrl" value="${escapeHtml(lesson.resources?.[0]?.url || "")}"></div>
      <div class="field full"><button class="btn-primary" type="submit">Enregistrer</button></div>
    </form>
  `);
}

function openReviewCenter() {
  const user = getCurrentUser();
  const pending = state.submissions.filter((submission) => {
    const activity = getActivityById(submission.activityId);
    const course = activity ? getCourseById(activity.courseId) : null;
    return submission.status === "submitted" && course?.teacherId === user.id;
  });
  const quizzes = getManageableCourses(user).flatMap((course) => getActivitiesForCourse(course.id).filter((activity) => activity.type === "quiz"));
  openModal(`
    <h2>Centre de correction</h2>
    <div class="simple-list" style="margin-top:18px">
      ${pending.length ? pending.map(renderSubmissionCard).join("") : `<div class="empty-state">Rien a corriger actuellement.</div>`}
    </div>
    <div class="panel" style="margin-top:18px">
      <h3>Réinitialiser les tentatives</h3>
      <div class="simple-list" style="margin-top:18px">
        ${quizzes.length ? quizzes.map((activity) => `<div class="module-card"><div class="toolbar" style="justify-content:space-between"><div><strong>${escapeHtml(activity.title)}</strong><div class="meta">${escapeHtml(getCourseById(activity.courseId)?.title || "")}</div></div><button class="btn-ghost" onclick="openAttemptResetModal('${activity.id}')">Gérer</button></div></div>`).join("") : `<div class="empty-state">Aucun quiz disponible.</div>`}
      </div>
    </div>
  `);
}

function openReviewModal(submissionId) {
  const submission = state.submissions.find((item) => item.id === submissionId);
  const learner = getUserById(submission?.userId);
  const activity = getActivityById(submission?.activityId);
  if (!submission || !activity) return;
  const reviewMaxPoints = activity.maxPoints || submission.maxPoints || activity.questions?.reduce((sum, question) => sum + question.points, 0) || 20;
  const answerBlock = submission.answers?.length
    ? submission.answers.map((answer) => {
        const question = activity.questions?.find((item) => item.id === answer.questionId);
        return `<div class="module-card" style="margin-bottom:10px"><strong>${escapeHtml(question?.prompt || "Question")}</strong><div class="meta" style="margin-top:8px">${escapeHtml(answer.value)}</div></div>`;
      }).join("")
    : `${escapeHtml(submission.text || "Quiz auto-corrige")}${submission.fileName ? `<div class="announcement" style="margin-top:12px">Pièce jointe simulée : ${escapeHtml(submission.fileName)}</div>` : ""}`;
  openModal(`
    <h2>Corriger la soumission</h2>
    <p class="section-subtitle">${escapeHtml(learner?.name || "")} · ${escapeHtml(activity.title)}</p>
    <div style="margin:18px 0">${answerBlock}</div>
    <form id="review-form" data-submission-id="${submission.id}" class="form-grid">
      <div class="field"><label for="review-score">Score</label><input id="review-score" name="score" type="number" min="0" max="${reviewMaxPoints}" required></div>
      <div class="field"><label for="review-max">Bareme</label><input id="review-max" name="maxPoints" type="number" value="${reviewMaxPoints}" required></div>
      <div class="field full"><label for="review-feedback">Feedback</label><textarea id="review-feedback" name="feedback" required></textarea></div>
      <div class="field full"><button class="btn-primary" type="submit">Valider la correction</button></div>
    </form>
  `);
}

function openAttemptResetModal(activityId) {
  const activity = getActivityById(activityId);
  const course = getCourseById(activity?.courseId);
  if (!activity || !course) return;
  const students = getCourseStudents(course);
  openModal(`
    <h2>Réinitialiser les tentatives</h2>
    <p class="section-subtitle">${escapeHtml(activity.title)} · ${escapeHtml(course.title)}</p>
    <div class="simple-list" style="margin-top:18px">
      ${students.length ? students.map((student) => {
        const attempts = state.submissions.filter((submission) => submission.activityId === activity.id && submission.userId === student.id).length;
        return `<div class="module-card"><div class="toolbar" style="justify-content:space-between"><div><strong>${escapeHtml(student.name)}</strong><div class="meta">${attempts} tentative(s) enregistrée(s)</div></div><button class="btn-ghost" onclick="resetQuizAttempts('${activity.id}','${student.id}')">Réinitialiser</button></div></div>`;
      }).join("") : `<div class="empty-state">Aucun apprenant dans ce cours.</div>`}
    </div>
  `);
}

function resetQuizAttempts(activityId, userId) {
  const activity = getActivityById(activityId);
  const learner = getUserById(userId);
  state.submissions = state.submissions.filter((submission) => !(submission.activityId === activityId && submission.userId === userId));
  if (learner && activity) {
    addNotification({ userId, title: "Tentatives réinitialisées", message: `Vos tentatives pour ${activity.title} ont été réinitialisées par l'enseignant.`, level: "warning" });
  }
  saveState();
  openAttemptResetModal(activityId);
}

function markAllNotificationsRead(userId) {
  state.notifications.filter((notification) => notification.userId === userId).forEach((notification) => { notification.read = true; });
  if (shouldUseSupabasePersistence()) {
    const items = state.notifications.filter((notification) => notification.userId === userId);
    supabaseUpsert("notifications", items.map((notification) => ({
      id: notification.id,
      profile_id: notification.userId,
      title: notification.title,
      message: notification.message,
      level: notification.level || "primary",
      is_read: true,
      created_at: notification.createdAt || nowISO()
    }))).catch((error) => console.warn("Supabase notification update ignored:", error));
  }
  saveState();
}

function purchaseCourse(courseId) {
  const user = getCurrentUser();
  if (!user) {
    showAuthModal("register");
    return;
  }
  if (user.role !== "student") {
    openModal(`
      <h2>Achat reserve aux comptes apprenants</h2>
      <p class="section-subtitle">Connectez-vous avec un compte apprenant pour acheter ce parcours, ou creez un nouveau compte etudiant.</p>
    `);
    return;
  }
  const course = getCourseById(courseId);
  const payments = state.config.payments;
  const paymentChoices = [];
  if (payments.mixxEnabled) paymentChoices.push(`<button class="btn-primary" onclick="processPayment('${courseId}','mixx')">Payer avec Mixx by Yas</button>`);
  if (payments.floozEnabled) paymentChoices.push(`<button class="btn-primary" onclick="processPayment('${courseId}','flooz')">Payer avec Flooz</button>`);
  openModal(`
    <h2>Paiement du parcours</h2>
    <p class="section-subtitle">Choisissez votre mode de paiement pour le cours <strong>${escapeHtml(course?.title || "")}</strong>.</p>
    <div class="module-card" style="margin-top:16px">
      <strong>Montant : ${formatPrice(course?.price || 0)}</strong>
      <div class="meta" style="margin-top:8px">Mixx et Flooz sont disponibles selon votre configuration administrateur.</div>
    </div>
    <div class="toolbar" style="margin-top:18px">
      ${paymentChoices.join("") || `<button class="btn-primary" onclick="processPayment('${courseId}','manual')">Valider manuellement</button>`}
    </div>
  `);
}

async function processPayment(courseId, provider) {
  const user = getCurrentUser();
  const course = getCourseById(courseId);
  if (!user || !course) return;
  if (!shouldUseApiPersistence()) {
    openModal(`
      <h2>Backend paiement requis</h2>
      <p class="section-subtitle">Les paiements réels Mixx/Flooz doivent être initialisés et confirmés côté serveur. Activez d'abord le mode <strong>API backend</strong> pour utiliser ce flux.</p>
    `);
    return;
  }
  let remotePayment = null;
  try {
    remotePayment = await initializePaymentWithApi({ provider, course, user });
  } catch (error) {
    console.warn("Payment API init failed:", error);
    openModal(`
      <h2>Initialisation impossible</h2>
      <p class="section-subtitle">${escapeHtml(formatApiErrorMessage("L'initialisation du paiement"))}</p>
    `);
    return;
  }
  const paymentRecord = upsertPaymentRecord({
    id: remotePayment.paymentId || crypto.randomUUID(),
    provider,
    courseId,
    userId: user.id,
    amount: course.price,
    currency: remotePayment.currency || "XOF",
    status: remotePayment.status || "pending",
    merchantReference: remotePayment.merchantReference || "",
    providerReference: remotePayment.providerReference || "",
    paymentUrl: remotePayment.paymentUrl || "",
    failureReason: remotePayment.failureReason || "",
    createdAt: remotePayment.createdAt || nowISO(),
    updatedAt: remotePayment.updatedAt || nowISO()
  });
  addNotification({
    userId: user.id,
    title: "Paiement initié",
    message: `Une transaction ${paymentProviderLabel(provider)} a été ouverte pour ${course.title}.`,
    level: "primary"
  });
  saveState();
  openModal(`
    <h2>Paiement initié</h2>
    <p class="section-subtitle">Le parcours <strong>${escapeHtml(course.title)}</strong> sera ajouté à votre espace uniquement après confirmation effective du paiement.</p>
    <div class="module-card" style="margin-top:16px">
      <strong>${escapeHtml(paymentProviderLabel(paymentRecord.provider))}</strong>
      <div class="meta" style="margin-top:8px">${escapeHtml(paymentStatusLabel(paymentRecord.status))}</div>
      <div class="tiny" style="margin-top:8px">Référence : ${escapeHtml(paymentRecord.merchantReference || paymentRecord.id)}</div>
    </div>
    <div class="toolbar" style="margin-top:18px">
      ${paymentRecord.paymentUrl ? `<a class="btn-primary" href="${escapeHtml(paymentRecord.paymentUrl)}" target="_blank" rel="noreferrer">Ouvrir le paiement</a>` : ""}
      <button class="btn-ghost" onclick="checkPaymentStatus('${paymentRecord.id}')">Vérifier le paiement</button>
    </div>
  `);
}

async function refreshCoursesFromJsonBin() {
  const loaded = await loadCoursesFromJsonBin();
  if (loaded) {
    closeModal();
    renderApp();
    openModal(`
      <h2>Catalogue rechargé</h2>
      <p class="section-subtitle">Les cours et activités ont bien été récupérés depuis JSONBin.</p>
    `);
  } else {
    openModal(`
      <h2>Synchronisation impossible</h2>
      <p class="section-subtitle">Vérifiez le Bin ID et les clés JSONBin dans les paramètres du site.</p>
    `);
  }
}

async function syncPlatformNow() {
  const persistence = getPersistenceConfig();
  if (persistence.mode === "supabase") {
    try {
      const client = getSupabaseClient();
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData?.session?.user) {
        throw new Error("Aucune session Supabase active. Connectez-vous avec un compte créé via Supabase pour synchroniser les données protégées.");
      }
      await syncSupabaseSnapshot();
      openModal(`
        <h2>Synchronisation Supabase terminée</h2>
        <p class="section-subtitle">Les profils, cours, modules, leçons, ressources, inscriptions, activités, soumissions et achèvements ont été envoyés vers Supabase.</p>
      `);
    } catch (error) {
      openModal(`
        <h2>Synchronisation Supabase bloquée</h2>
        <p class="section-subtitle">${escapeHtml(error.message || "Supabase refuse actuellement l'écriture. Vérifiez la session ouverte et les politiques RLS.")}</p>
      `);
    }
    return;
  }
  if (persistence.mode === "api") {
    await syncApiSnapshot();
    openModal(`
      <h2>Synchronisation terminée</h2>
      <p class="section-subtitle">Le snapshot complet de la plateforme a été envoyé vers votre backend API.</p>
    `);
    return;
  }
  if (persistence.mode === "jsonbin") {
    await syncJsonBin();
    openModal(`
      <h2>Synchronisation terminée</h2>
      <p class="section-subtitle">Les contenus synchronisables ont été envoyés vers JSONBin.</p>
    `);
    return;
  }
  openModal(`
    <h2>Mode local actif</h2>
    <p class="section-subtitle">La plateforme est encore en mode local. Activez le mode API ou JSONBin dans les paramètres du site pour une synchronisation distante.</p>
  `);
}

function bindForms() {
  document.getElementById("login-form")?.addEventListener("submit", handleLogin);
  document.getElementById("register-form")?.addEventListener("submit", handleRegister);
  document.getElementById("contact-form")?.addEventListener("submit", handleContactSubmit);
  document.getElementById("course-form")?.addEventListener("submit", handleCourseCreate);
  document.getElementById("course-edit-form")?.addEventListener("submit", handleCourseEdit);
  document.getElementById("activity-form")?.addEventListener("submit", handleActivityCreate);
  document.getElementById("activity-edit-form")?.addEventListener("submit", handleActivityEdit);
  document.getElementById("quiz-settings-form")?.addEventListener("submit", handleQuizSettingsSave);
  document.getElementById("question-bank-form")?.addEventListener("submit", handleQuestionBankCreate);
  document.getElementById("question-edit-form")?.addEventListener("submit", handleQuestionBankEdit);
  document.getElementById("quiz-question-edit-form")?.addEventListener("submit", handleQuizQuestionEdit);
  document.getElementById("module-form")?.addEventListener("submit", handleModuleCreate);
  document.getElementById("module-edit-form")?.addEventListener("submit", handleModuleEdit);
  document.getElementById("lesson-form")?.addEventListener("submit", handleLessonCreate);
  document.getElementById("lesson-edit-form")?.addEventListener("submit", handleLessonEdit);
  document.getElementById("announcement-form")?.addEventListener("submit", handleAnnouncementCreate);
  document.getElementById("message-form")?.addEventListener("submit", handleMessageCreate);
  document.getElementById("forum-form")?.addEventListener("submit", handleForumCreate);
  document.getElementById("forum-post-form")?.addEventListener("submit", handleForumReplyCreate);
  document.getElementById("attendance-form")?.addEventListener("submit", handleAttendanceCreate);
  document.getElementById("quiz-form")?.addEventListener("submit", handleQuizSubmit);
  document.getElementById("assignment-form")?.addEventListener("submit", handleAssignmentSubmit);
  document.getElementById("review-form")?.addEventListener("submit", handleReviewSubmit);
  document.getElementById("settings-form")?.addEventListener("submit", handleSettingsSave);
  document.getElementById("course-enrollment-form")?.addEventListener("submit", handleCourseEnrollmentAssign);
  document.getElementById("bulk-enrollment-form")?.addEventListener("submit", handleBulkEnrollmentAssign);
  document.getElementById("admin-user-form")?.addEventListener("submit", handleAdminUserCreate);
  document.getElementById("admin-user-edit-form")?.addEventListener("submit", handleAdminUserEdit);
}

async function handleCourseEnrollmentAssign(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const courseId = String(formData.get("courseId") || "").trim();
  const userId = String(formData.get("userId") || "").trim();
  if (!courseId || !userId) return;
  await enrollUser(courseId, userId);
  closeModal();
  renderApp();
}

function parseBulkStudents(raw) {
  return String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
      if (!parts.length) return null;
      if (parts.length === 1) {
        const email = parts[0].toLowerCase();
        const fallbackName = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
        return { name: fallbackName || "Nouvel élève", email };
      }
      return { name: parts[0], email: parts[1].toLowerCase() };
    })
    .filter((item) => item?.email);
}

async function handleBulkEnrollmentAssign(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const courseId = String(formData.get("courseId") || "").trim();
  const defaultPassword = String(formData.get("defaultPassword") || "Student123!").trim() || "Student123!";
  const entries = parseBulkStudents(formData.get("studentsRaw"));
  const created = [];
  const enrolled = [];
  for (const entry of entries) {
    let user = state.users.find((item) => item.email.toLowerCase() === entry.email.toLowerCase());
    if (!user) {
      user = {
        id: crypto.randomUUID(),
        name: entry.name || entry.email,
        email: entry.email,
        password: await secureLocalPassword(defaultPassword),
        role: "student",
        bio: "Compte élève importé par lot.",
        avatar: initials(entry.name || entry.email),
        createdAt: nowISO()
      };
      state.users.push(user);
      created.push(user);
      await publishPlatformEvent("user.created", { user });
    }
    if (user.role !== "student") continue;
    const course = getCourseById(courseId);
    if (course && !course.enrolledUserIds.includes(user.id)) {
      await enrollUser(courseId, user.id);
      enrolled.push(user);
    }
  }
  saveState();
  openModal(`
    <h2>Import terminé</h2>
    <div class="simple-list" style="margin-top:18px">
      <div class="module-card"><strong>Comptes créés</strong><div class="meta">${created.length}</div></div>
      <div class="module-card"><strong>Élèves inscrits</strong><div class="meta">${enrolled.length}</div></div>
      <div class="module-card"><strong>Mot de passe initial</strong><div class="meta">${escapeHtml(defaultPassword)}</div></div>
    </div>
    <div class="feed-list" style="margin-top:18px">
      ${enrolled.length ? enrolled.map((user) => `<article class="feed-item"><h3>${escapeHtml(user.name)}</h3><p class="meta">${escapeHtml(user.email)}</p></article>`).join("") : `<div class="empty-state">Aucun élève inscrit.</div>`}
    </div>
  `);
  renderApp();
}

async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const email = String(formData.get("email")).trim().toLowerCase();
  const password = String(formData.get("password"));
  const loginLimit = getLoginRateLimitState(email);
  if (loginLimit.lockedUntil > Date.now()) {
    alert("Trop de tentatives de connexion. Réessayez dans quelques minutes.");
    return;
  }
  let user = null;
  try {
    if (shouldUseSupabasePersistence()) {
      try {
        user = await loginWithSupabase(email, password);
      } catch (error) {
        console.warn("Supabase login fallback:", error);
        alert(`Connexion Supabase impossible : ${error.message || "erreur inconnue"}`);
        return;
      }
    }
    if (!user && !shouldUseSupabasePersistence() && shouldUseApiPersistence()) {
      try {
        user = await loginWithApi(email, password);
      } catch (error) {
        console.warn("API login fallback:", error);
        if (!state.users.some((item) => item.email.toLowerCase() === email)) {
          alert(formatApiErrorMessage("La connexion"));
        }
      }
    }
    if (!user && !shouldUseSupabasePersistence() && !shouldUseApiPersistence()) {
      user = await verifyLocalCredentials(email, password);
      if (user) {
        state.currentUserId = user.id;
        state.session = { accessToken: "", authProvider: "local", lastAuthAt: nowISO() };
      }
    }
    if (!user) {
      registerFailedLoginAttempt(email);
      alert("Identifiants invalides.");
      return;
    }
    clearFailedLoginAttempts(email);
    state.ui.screen = "dashboard";
    closeModal();
    addLog(user.id, "Connexion à la plateforme");
    saveState();
  } catch (error) {
    console.warn("Login error:", error);
    alert("Connexion impossible pour le moment.");
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const email = String(formData.get("email")).trim().toLowerCase();
  const name = String(formData.get("name")).trim();
  const password = String(formData.get("password"));
  const requestedRole = String(formData.get("role")).trim().toLowerCase();
  const role = isRoleAllowedForPublicRegistration(requestedRole) ? requestedRole : "student";
  const registerLocally = async () => {
    if (state.users.some((user) => user.email.toLowerCase() === email)) return null;
    const user = { id: crypto.randomUUID(), name, email, password: await secureLocalPassword(password), role, bio: "Nouveau compte plateforme.", avatar: initials(name), createdAt: nowISO() };
    state.users.push(user);
    state.currentUserId = user.id;
    state.session = { accessToken: "", authProvider: "local", lastAuthAt: nowISO() };
    return user;
  };
  try {
    let user = null;
    if (shouldUseSupabasePersistence()) {
      try {
        user = await registerWithSupabase({ name, email, password, role });
      } catch (error) {
        console.warn("Supabase register fallback:", error);
        alert(`Inscription Supabase impossible : ${error.message || "erreur inconnue"}`);
        return;
      }
    }
    if (user?.pendingConfirmation) {
      closeModal();
      openModal(`
        <h2>Confirmation requise</h2>
        <p class="section-subtitle">Votre compte Supabase a été créé pour <strong>${escapeHtml(user.email)}</strong>. Consultez votre messagerie puis confirmez l'inscription avant de vous connecter.</p>
      `);
      return;
    }
    if (!user && !shouldUseSupabasePersistence() && shouldUseApiPersistence()) {
      try {
        user = await registerWithApi({ name, email, password, role });
      } catch (error) {
        console.warn("API register fallback:", error);
        if (!state.users.some((item) => item.email.toLowerCase() === email)) {
          alert(formatApiErrorMessage("L'inscription"));
        }
      }
    }
    if (!user && !shouldUseSupabasePersistence() && !shouldUseApiPersistence()) {
      user = await registerLocally();
    }
    if (!user) {
      alert("Cet email existe déjà.");
      return;
    }
    state.ui.screen = "dashboard";
    addNotification({ userId: user.id, title: "Bienvenue sur ADSL-2EF", message: "Votre compte est prêt. Explorez votre tableau de bord personnalisé.", level: "success" });
    closeModal();
    saveState();
  } catch (error) {
    console.warn("Register error:", error);
    alert("Inscription impossible pour le moment.");
  }
}

function handleContactSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const admin = state.users.find((user) => user.role === "admin");
  if (admin) {
    state.messages.unshift({
      id: crypto.randomUUID(),
      fromUserId: getCurrentUser()?.id || null,
      toUserId: admin.id,
      subject: String(formData.get("subject")),
      content: `${String(formData.get("name"))} · ${String(formData.get("phone"))} · ${String(formData.get("email") || "")}\n${String(formData.get("message"))}`,
      createdAt: nowISO(),
      read: false
    });
  }
  addNotification({
    userId: admin?.id || state.users[0].id,
    title: "Nouveau message de contact",
    message: `${String(formData.get("name"))} a envoyé une demande depuis la page Contact.`,
    level: "primary"
  });
  openModal(`
    <h2>Message envoyé</h2>
    <p class="section-subtitle">Merci. Votre demande a été enregistrée et l'équipe ADSL-2EF vous répondra rapidement.</p>
  `);
  event.currentTarget.reset();
  saveState();
}

async function handleCourseCreate(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const newCourse = {
    id: crypto.randomUUID(),
    title: String(formData.get("title")).trim(),
    category: String(formData.get("category")).trim(),
    description: String(formData.get("description")).trim(),
    image: String(formData.get("image")).trim() || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    teacherId: String(formData.get("teacherId")),
    status: String(formData.get("status")),
    audience: String(formData.get("audience")).trim(),
    duration: String(formData.get("duration")).trim(),
    createdAt: nowISO(),
    enrolledUserIds: [],
    modules: [{ id: crypto.randomUUID(), title: "Module 1 - Demarrage", summary: "Module initial genere automatiquement.", order: 1, lessons: [{ id: crypto.randomUUID(), title: "Lecon d'introduction", type: "reading", duration: "10 min", content: "Ajoutez ici les objectifs, contenus et consignes de depart.", resources: [] }] }]
  };
  state.courses.unshift(newCourse);
  if (shouldUseSupabasePersistence()) {
    try {
      await supabaseUpsert("courses", mapCourseToSupabaseRow(newCourse));
      await supabaseUpsert("course_modules", mapModuleToSupabaseRow(newCourse.id, newCourse.modules[0], 0));
      await supabaseUpsert("lessons", mapLessonToSupabaseRow(newCourse.modules[0].id, newCourse.modules[0].lessons[0], 0));
    } catch (error) {
      console.warn("Supabase course create sync ignored:", error);
    }
  }
  const teacher = getUserById(newCourse.teacherId);
  if (teacher) addNotification({ userId: teacher.id, title: "Nouveau cours assigne", message: `Le cours ${newCourse.title} est disponible dans votre espace enseignant.`, level: "primary" });
  addLog(getCurrentUser().id, `Cours créé - ${newCourse.title}`);
  const remote = await publishPlatformEvent("course.created", { course: newCourse });
  mergeRemoteEntity(newCourse, extractRemoteEntity(remote, "course"));
  closeModal();
  saveState();
}

async function handleCourseEdit(event) {
  event.preventDefault();
  const course = getCourseById(event.currentTarget.dataset.courseId);
  if (!course) return;
  const formData = new FormData(event.currentTarget);
  course.title = String(formData.get("title")).trim();
  course.category = String(formData.get("category")).trim();
  course.audience = String(formData.get("audience")).trim();
  course.duration = String(formData.get("duration")).trim();
  course.image = String(formData.get("image")).trim();
  course.description = String(formData.get("description")).trim();
  course.teacherId = String(formData.get("teacherId")).trim();
  course.status = String(formData.get("status")).trim();
  if (shouldUseSupabasePersistence()) {
    try {
      await supabaseUpsert("courses", mapCourseToSupabaseRow(course));
    } catch (error) {
      console.warn("Supabase course edit sync ignored:", error);
    }
  }
  addLog(getCurrentUser().id, `Cours modifié - ${course.title}`);
  const remote = await publishPlatformEvent("course.updated", { course });
  mergeRemoteEntity(course, extractRemoteEntity(remote, "course"));
  closeModal();
  saveState();
}

async function handleActivityCreate(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const courseId = event.currentTarget.dataset.courseId;
  const course = getCourseById(courseId);
  const moduleId = String(formData.get("moduleId"));
  const module = course.modules.find((item) => item.id === moduleId);
  const base = {
    id: crypto.randomUUID(),
    courseId,
    moduleId,
    lessonId: module?.lessons[0]?.id || null,
    title: String(formData.get("title")).trim(),
    type: String(formData.get("type")),
    description: String(formData.get("description")).trim(),
    dueDate: new Date(String(formData.get("dueDate"))).toISOString(),
    createdBy: getCurrentUser().id,
    weight: Number(formData.get("weight")) || 1
  };
  if (base.type === "quiz") {
    base.questions = [
      { id: crypto.randomUUID(), prompt: "Question exemple 1", kind: "mcq", options: ["Option A", "Option B", "Option C"], answer: "Option A", points: 5 },
      { id: crypto.randomUUID(), prompt: "Question exemple 2", kind: "mcq", options: ["Option A", "Option B", "Option C"], answer: "Option B", points: 5 }
    ];
    base.timeLimitMinutes = Number(formData.get("timeLimitMinutes")) || 20;
    base.attemptsAllowed = Number(formData.get("attemptsAllowed")) || 1;
    base.passingScore = Number(formData.get("passingScore")) || 60;
  } else {
    base.maxPoints = Number(formData.get("maxPoints")) || 20;
  }
  state.activities.unshift(base);
  if (shouldUseSupabasePersistence()) {
    try {
      await supabaseUpsert("activities", mapActivityToSupabaseRow(base));
      if (base.type === "quiz" && base.questions?.length) {
        await supabaseUpsert("activity_questions", base.questions.map((question, index) => ({
          id: question.id,
          activity_id: base.id,
          question_bank_id: question.questionBankId || null,
          kind: question.kind || "mcq",
          prompt: question.prompt || "",
          options: question.options || [],
          answer: question.answer || "",
          points: Number(question.points || 1),
          position: index + 1
        })));
      }
    } catch (error) {
      console.warn("Supabase activity create sync ignored:", error);
    }
  }
  course.enrolledUserIds.forEach((userId) => addNotification({ userId, title: "Nouvelle activite disponible", message: `${base.title} a ete ajoute au cours ${course.title}.`, level: "warning" }));
  const remote = await publishPlatformEvent("activity.created", { activity: base, courseId });
  mergeRemoteEntity(base, extractRemoteEntity(remote, "activity"));
  closeModal();
  saveState();
}

async function handleActivityEdit(event) {
  event.preventDefault();
  const activity = getActivityById(event.currentTarget.dataset.activityId);
  if (!activity) return;
  const formData = new FormData(event.currentTarget);
  activity.title = String(formData.get("title")).trim();
  activity.type = String(formData.get("type")).trim();
  activity.moduleId = String(formData.get("moduleId")).trim();
  activity.description = String(formData.get("description")).trim();
  activity.dueDate = new Date(String(formData.get("dueDate"))).toISOString();
  activity.weight = Number(formData.get("weight")) || 1;
  if (activity.type === "quiz") {
    activity.timeLimitMinutes = Number(formData.get("timeLimitMinutes")) || 20;
    activity.attemptsAllowed = Number(formData.get("attemptsAllowed")) || 1;
    activity.passingScore = Number(formData.get("passingScore")) || 60;
  } else {
    activity.maxPoints = Number(formData.get("maxPoints")) || 20;
  }
  if (shouldUseSupabasePersistence()) {
    try {
      await supabaseUpsert("activities", mapActivityToSupabaseRow(activity));
    } catch (error) {
      console.warn("Supabase activity edit sync ignored:", error);
    }
  }
  const remote = await publishPlatformEvent("activity.updated", { activity });
  mergeRemoteEntity(activity, extractRemoteEntity(remote, "activity"));
  closeModal();
  saveState();
}

function handleQuizSettingsSave(event) {
  event.preventDefault();
  const activity = getActivityById(event.currentTarget.dataset.activityId);
  if (!activity || activity.type !== "quiz") return;
  const formData = new FormData(event.currentTarget);
  activity.title = String(formData.get("title")).trim();
  activity.description = String(formData.get("description")).trim();
  activity.timeLimitMinutes = Number(formData.get("timeLimitMinutes")) || 20;
  activity.attemptsAllowed = Number(formData.get("attemptsAllowed")) || 1;
  activity.passingScore = Number(formData.get("passingScore")) || 60;
  activity.weight = Number(formData.get("weight")) || 1;
  if (shouldUseSupabasePersistence()) {
    supabaseUpsert("activities", mapActivityToSupabaseRow(activity)).catch((error) => console.warn("Supabase quiz settings sync ignored:", error));
  }
  closeModal();
  saveState();
}

function normalizeQuestionOptions(kind, rawOptions) {
  if (kind === "truefalse") return ["Vrai", "Faux"];
  if (kind === "mcq") {
    const values = rawOptions.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    return values.length ? values : ["Option A", "Option B", "Option C"];
  }
  return [];
}

function handleQuestionBankCreate(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const courseId = String(formData.get("courseId") || event.currentTarget.dataset.courseId).trim();
  const activityId = String(formData.get("activityId") || event.currentTarget.dataset.activityId || "").trim();
  const kind = String(formData.get("kind")).trim();
  const question = {
    id: crypto.randomUUID(),
    courseId,
    prompt: String(formData.get("prompt")).trim(),
    kind,
    options: normalizeQuestionOptions(kind, String(formData.get("options") || "")),
    answer: String(formData.get("answer") || "").trim(),
    points: Number(formData.get("points")) || 5,
    createdBy: getCurrentUser().id,
    createdAt: nowISO()
  };
  state.questionBank.unshift(question);
  if (shouldUseSupabasePersistence()) {
    supabaseUpsert("question_bank", {
      id: question.id,
      course_id: question.courseId,
      kind: question.kind || "mcq",
      prompt: question.prompt || "",
      options: question.options || [],
      answer: question.answer || "",
      points: Number(question.points || 1),
      created_at: question.createdAt || nowISO()
    }).catch((error) => console.warn("Supabase question bank sync ignored:", error));
  }
  if (activityId) {
    const activity = getActivityById(activityId);
    if (activity?.type === "quiz") {
      const attachedQuestion = { ...structuredClone(question), id: crypto.randomUUID(), questionBankId: question.id };
      activity.questions.push(attachedQuestion);
      if (shouldUseSupabasePersistence()) {
        supabaseUpsert("activity_questions", {
          id: attachedQuestion.id,
          activity_id: activity.id,
          question_bank_id: question.id,
          kind: attachedQuestion.kind || "mcq",
          prompt: attachedQuestion.prompt || "",
          options: attachedQuestion.options || [],
          answer: attachedQuestion.answer || "",
          points: Number(attachedQuestion.points || 1),
          position: activity.questions.length
        }).catch((error) => console.warn("Supabase activity question sync ignored:", error));
      }
    }
  }
  saveState();
  if (activityId) openQuizEditor(activityId);
  else openQuestionBankBuilder(courseId);
}

function attachQuestionToQuiz(activityId, questionId) {
  const activity = getActivityById(activityId);
  const question = state.questionBank.find((item) => item.id === questionId);
  if (!activity || activity.type !== "quiz" || !question) return;
  const attachedQuestion = { ...structuredClone(question), id: crypto.randomUUID(), questionBankId: question.id };
  activity.questions.push(attachedQuestion);
  if (shouldUseSupabasePersistence()) {
    supabaseUpsert("activity_questions", {
      id: attachedQuestion.id,
      activity_id: activity.id,
      question_bank_id: question.id,
      kind: attachedQuestion.kind || "mcq",
      prompt: attachedQuestion.prompt || "",
      options: attachedQuestion.options || [],
      answer: attachedQuestion.answer || "",
      points: Number(attachedQuestion.points || 1),
      position: activity.questions.length
    }).catch((error) => console.warn("Supabase attach question sync ignored:", error));
  }
  saveState();
  openQuizEditor(activityId);
}

function handleQuestionBankEdit(event) {
  event.preventDefault();
  const question = getQuestionById(event.currentTarget.dataset.questionId);
  if (!question) return;
  const formData = new FormData(event.currentTarget);
  const kind = String(formData.get("kind")).trim();
  question.prompt = String(formData.get("prompt")).trim();
  question.kind = kind;
  question.points = Number(formData.get("points")) || 5;
  question.options = normalizeQuestionOptions(kind, String(formData.get("options") || ""));
  question.answer = String(formData.get("answer") || "").trim();
  if (shouldUseSupabasePersistence()) {
    supabaseUpsert("question_bank", {
      id: question.id,
      course_id: question.courseId,
      kind: question.kind || "mcq",
      prompt: question.prompt || "",
      options: question.options || [],
      answer: question.answer || "",
      points: Number(question.points || 1),
      created_at: question.createdAt || nowISO()
    }).catch((error) => console.warn("Supabase question edit sync ignored:", error));
  }
  saveState();
  openQuestionBankBuilder(question.courseId, event.currentTarget.dataset.activityId || "");
}

function handleQuizQuestionEdit(event) {
  event.preventDefault();
  const activity = getActivityById(event.currentTarget.dataset.activityId);
  const question = activity?.questions.find((item) => item.id === event.currentTarget.dataset.questionId);
  if (!activity || !question) return;
  const formData = new FormData(event.currentTarget);
  const kind = String(formData.get("kind")).trim();
  question.prompt = String(formData.get("prompt")).trim();
  question.kind = kind;
  question.points = Number(formData.get("points")) || 5;
  question.options = normalizeQuestionOptions(kind, String(formData.get("options") || ""));
  question.answer = String(formData.get("answer") || "").trim();
  if (shouldUseSupabasePersistence()) {
    supabaseUpsert("activity_questions", {
      id: question.id,
      activity_id: activity.id,
      question_bank_id: question.questionBankId || null,
      kind: question.kind || "mcq",
      prompt: question.prompt || "",
      options: question.options || [],
      answer: question.answer || "",
      points: Number(question.points || 1),
      position: (activity.questions || []).findIndex((item) => item.id === question.id) + 1
    }).catch((error) => console.warn("Supabase quiz question edit sync ignored:", error));
  }
  saveState();
  openQuizEditor(activity.id);
}

function removeQuestionFromQuiz(activityId, questionId) {
  const activity = getActivityById(activityId);
  if (!activity?.questions?.length) return;
  activity.questions = activity.questions.filter((question) => question.id !== questionId);
  if (shouldUseSupabasePersistence()) {
    supabaseDelete("activity_questions", { id: questionId }).catch((error) => console.warn("Supabase quiz question delete ignored:", error));
  }
  saveState();
  openQuizEditor(activityId);
}

function removeQuestionFromBank(questionId, activityId = "") {
  const question = getQuestionById(questionId);
  if (!question) return;
  state.questionBank = state.questionBank.filter((item) => item.id !== questionId);
  state.activities.forEach((activity) => {
    if (activity.type === "quiz") {
      activity.questions = (activity.questions || []).filter((item) => item.id !== questionId);
    }
  });
  if (shouldUseSupabasePersistence()) {
    Promise.all([
      supabaseDelete("question_bank", { id: questionId }),
      supabaseDelete("activity_questions", { question_bank_id: questionId })
    ]).catch((error) => console.warn("Supabase question bank delete ignored:", error));
  }
  saveState();
  openQuestionBankBuilder(question.courseId, activityId);
}

function exportQuizResults(activityId) {
  const activity = getActivityById(activityId);
  if (!activity) return;
  const rows = state.submissions
    .filter((submission) => submission.activityId === activityId)
    .map((submission) => {
      const learner = getUserById(submission.userId);
      const percent = submission.maxPoints ? Math.round((Number(submission.score || 0) / submission.maxPoints) * 100) : 0;
      return [
        learner?.name || "Utilisateur",
        learner?.email || "",
        submission.status,
        submission.score ?? "",
        submission.maxPoints ?? "",
        `${percent}%`,
        formatDate(submission.submittedAt),
        formatDate(submission.reviewedAt || submission.submittedAt)
      ].join(";");
    });
  const header = "Nom;Email;Statut;Score;Bareme;Pourcentage;Soumis le;Corrige le";
  const content = [header, ...rows].join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${activity.title.replace(/[^\w\-]+/g, "_")}_resultats.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function handleModuleCreate(event) {
  event.preventDefault();
  const course = getCourseById(event.currentTarget.dataset.courseId);
  if (!course) return;
  const formData = new FormData(event.currentTarget);
  const module = {
    id: crypto.randomUUID(),
    title: String(formData.get("title")).trim(),
    summary: String(formData.get("summary")).trim(),
    order: course.modules.length + 1,
    lessons: []
  };
  course.modules.push(module);
  if (shouldUseSupabasePersistence()) {
    try {
      await supabaseUpsert("course_modules", mapModuleToSupabaseRow(course.id, module, course.modules.length - 1));
    } catch (error) {
      console.warn("Supabase module create sync ignored:", error);
    }
  }
  addLog(getCurrentUser().id, `Module ajouté - ${course.title}`);
  const remote = await publishPlatformEvent("module.created", { courseId: course.id, module });
  mergeRemoteEntity(module, extractRemoteEntity(remote, "module"));
  closeModal();
  openCourse(course.id);
}

async function handleModuleEdit(event) {
  event.preventDefault();
  const course = getCourseById(event.currentTarget.dataset.courseId);
  const module = course?.modules.find((item) => item.id === event.currentTarget.dataset.moduleId);
  if (!course || !module) return;
  const formData = new FormData(event.currentTarget);
  module.title = String(formData.get("title")).trim();
  module.summary = String(formData.get("summary")).trim();
  if (shouldUseSupabasePersistence()) {
    try {
      await supabaseUpsert("course_modules", mapModuleToSupabaseRow(course.id, module, course.modules.findIndex((item) => item.id === module.id)));
    } catch (error) {
      console.warn("Supabase module edit sync ignored:", error);
    }
  }
  addLog(getCurrentUser().id, `Module modifié - ${course.title}`);
  const remote = await publishPlatformEvent("module.updated", { courseId: course.id, module });
  mergeRemoteEntity(module, extractRemoteEntity(remote, "module"));
  closeModal();
  openCourse(course.id);
}

async function handleLessonCreate(event) {
  event.preventDefault();
  const course = getCourseById(event.currentTarget.dataset.courseId);
  const module = course?.modules.find((item) => item.id === event.currentTarget.dataset.moduleId);
  if (!course || !module) return;
  const formData = new FormData(event.currentTarget);
  const resourceTitle = String(formData.get("resourceTitle")).trim();
  const resourceUrl = String(formData.get("resourceUrl")).trim();
  const lesson = {
    id: crypto.randomUUID(),
    title: String(formData.get("title")).trim(),
    type: String(formData.get("type")).trim(),
    duration: String(formData.get("duration")).trim(),
    content: String(formData.get("content")).trim(),
    resources: resourceTitle && resourceUrl ? [{ id: crypto.randomUUID(), title: resourceTitle, type: "link", url: resourceUrl }] : []
  };
  module.lessons.push(lesson);
  if (shouldUseSupabasePersistence()) {
    try {
      await supabaseUpsert("lessons", mapLessonToSupabaseRow(module.id, lesson, module.lessons.length - 1));
      if (lesson.resources.length) await supabaseUpsert("lesson_resources", mapLessonResourcesToSupabaseRows(lesson));
    } catch (error) {
      console.warn("Supabase lesson create sync ignored:", error);
    }
  }
  addLog(getCurrentUser().id, `Leçon ajoutée - ${course.title}`);
  const remote = await publishPlatformEvent("lesson.created", { courseId: course.id, moduleId: module.id, lesson });
  mergeRemoteEntity(lesson, extractRemoteEntity(remote, "lesson"));
  closeModal();
  setScreen("course", {
    activeCourseId: course.id,
    currentModuleId: module.id,
    currentLessonId: module.lessons[module.lessons.length - 1].id
  });
}

async function handleLessonEdit(event) {
  event.preventDefault();
  const course = getCourseById(event.currentTarget.dataset.courseId);
  const module = course?.modules.find((item) => item.id === event.currentTarget.dataset.moduleId);
  const lesson = module?.lessons.find((item) => item.id === event.currentTarget.dataset.lessonId);
  if (!course || !module || !lesson) return;
  const formData = new FormData(event.currentTarget);
  const resourceTitle = String(formData.get("resourceTitle")).trim();
  const resourceUrl = String(formData.get("resourceUrl")).trim();
  lesson.title = String(formData.get("title")).trim();
  lesson.type = String(formData.get("type")).trim();
  lesson.duration = String(formData.get("duration")).trim();
  lesson.content = String(formData.get("content")).trim();
  lesson.resources = resourceTitle && resourceUrl ? [{ id: crypto.randomUUID(), title: resourceTitle, type: "link", url: resourceUrl }] : [];
  if (shouldUseSupabasePersistence()) {
    try {
      await supabaseUpsert("lessons", mapLessonToSupabaseRow(module.id, lesson, module.lessons.findIndex((item) => item.id === lesson.id)));
      await supabaseDelete("lesson_resources", { lesson_id: lesson.id });
      if (lesson.resources.length) await supabaseUpsert("lesson_resources", mapLessonResourcesToSupabaseRows(lesson));
    } catch (error) {
      console.warn("Supabase lesson edit sync ignored:", error);
    }
  }
  addLog(getCurrentUser().id, `Leçon modifiée - ${course.title}`);
  const remote = await publishPlatformEvent("lesson.updated", { courseId: course.id, moduleId: module.id, lesson });
  mergeRemoteEntity(lesson, extractRemoteEntity(remote, "lesson"));
  closeModal();
  setScreen("course", { activeCourseId: course.id, currentModuleId: module.id, currentLessonId: lesson.id });
}

async function archiveCourse(courseId) {
  const course = getCourseById(courseId);
  if (!course) return;
  course.status = "archived";
  if (shouldUseSupabasePersistence()) {
    try {
      await supabaseUpsert("courses", mapCourseToSupabaseRow(course));
    } catch (error) {
      console.warn("Supabase course archive sync ignored:", error);
    }
  }
  addLog(getCurrentUser().id, `Cours archivé - ${course.title}`);
  const remote = await publishPlatformEvent("course.archived", { courseId, course });
  mergeRemoteEntity(course, extractRemoteEntity(remote, "course"));
  if (state.ui.activeCourseId === courseId) state.ui.screen = "dashboard";
  saveState();
}

async function restoreCourse(courseId) {
  const course = getCourseById(courseId);
  if (!course) return;
  course.status = "published";
  if (shouldUseSupabasePersistence()) {
    try {
      await supabaseUpsert("courses", mapCourseToSupabaseRow(course));
    } catch (error) {
      console.warn("Supabase course restore sync ignored:", error);
    }
  }
  addLog(getCurrentUser().id, `Cours restauré - ${course.title}`);
  const remote = await publishPlatformEvent("course.restored", { courseId, course });
  mergeRemoteEntity(course, extractRemoteEntity(remote, "course"));
  saveState();
}

function removeCourse(courseId) {
  archiveCourse(courseId);
}

async function removeModule(courseId, moduleId) {
  const course = getCourseById(courseId);
  const module = course?.modules.find((item) => item.id === moduleId);
  if (!course || !module) return;
  course.modules = course.modules.filter((item) => item.id !== moduleId);
  state.activities = state.activities.filter((activity) => !(activity.courseId === courseId && activity.moduleId === moduleId));
  if (shouldUseSupabasePersistence()) {
    try {
      await Promise.all([
        supabaseDelete("activities", { module_id: moduleId }),
        supabaseDelete("course_modules", { id: moduleId })
      ]);
    } catch (error) {
      console.warn("Supabase module delete sync ignored:", error);
    }
  }
  addLog(getCurrentUser().id, `Module supprimé - ${course.title}`);
  await publishPlatformEvent("module.deleted", { courseId, moduleId });
  openCourse(courseId);
}

async function removeLesson(courseId, moduleId, lessonId) {
  const course = getCourseById(courseId);
  const module = course?.modules.find((item) => item.id === moduleId);
  const lesson = module?.lessons.find((item) => item.id === lessonId);
  if (!course || !module || !lesson) return;
  module.lessons = module.lessons.filter((item) => item.id !== lessonId);
  state.activities = state.activities.filter((activity) => !(activity.courseId === courseId && activity.lessonId === lessonId));
  state.completionRecords = state.completionRecords.filter((record) => record.lessonId !== lessonId);
  if (shouldUseSupabasePersistence()) {
    try {
      await Promise.all([
        supabaseDelete("activities", { lesson_id: lessonId }),
        supabaseDelete("completion_records", { lesson_id: lessonId }),
        supabaseDelete("lesson_resources", { lesson_id: lessonId }),
        supabaseDelete("lessons", { id: lessonId })
      ]);
    } catch (error) {
      console.warn("Supabase lesson delete sync ignored:", error);
    }
  }
  addLog(getCurrentUser().id, `Leçon supprimée - ${course.title}`);
  await publishPlatformEvent("lesson.deleted", { courseId, moduleId, lessonId });
  openCourse(courseId);
}

async function removeUser(userId) {
  const user = getUserById(userId);
  if (!user || user.id === getCurrentUser()?.id) return;
  state.users = state.users.filter((item) => item.id !== userId);
  state.messages = state.messages.filter((item) => item.fromUserId !== userId && item.toUserId !== userId);
  state.notifications = state.notifications.filter((item) => item.userId !== userId);
  state.submissions = state.submissions.filter((item) => item.userId !== userId);
  state.courses.forEach((course) => {
    course.enrolledUserIds = course.enrolledUserIds.filter((id) => id !== userId);
    if (course.teacherId === userId) course.teacherId = state.users.find((item) => item.role === "teacher")?.id || course.teacherId;
  });
  addLog(getCurrentUser().id, `Utilisateur supprimé - ${user.name}`);
  await publishPlatformEvent("user.deleted", { userId, user });
  saveState();
}

function setAdminFilter(type, value) {
  if (type === "user") state.ui.adminUserFilter = value;
  if (type === "course") state.ui.adminCourseFilter = value;
  renderApp();
}

async function handleAnnouncementCreate(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const courseId = String(formData.get("courseId")).trim() || null;
  const announcement = {
    id: crypto.randomUUID(),
    courseId,
    title: String(formData.get("title")).trim(),
    body: String(formData.get("body")).trim(),
    createdAt: nowISO(),
    authorId: getCurrentUser().id
  };
  state.announcements.unshift(announcement);
  if (shouldUseSupabasePersistence()) {
    try {
      await supabaseUpsert("announcements", {
        id: announcement.id,
        course_id: announcement.courseId || null,
        author_profile_id: announcement.authorId || null,
        title: announcement.title,
        body: announcement.body || "",
        created_at: announcement.createdAt
      });
    } catch (error) {
      console.warn("Supabase announcement sync ignored:", error);
    }
  }
  const recipients = courseId
    ? getCourseById(courseId)?.enrolledUserIds || []
    : state.users.filter((user) => user.role !== "admin").map((user) => user.id);
  recipients.forEach((userId) => addNotification({ userId, title: "Nouvelle annonce", message: "Une annonce vient d'être publiée sur votre espace.", level: "primary" }));
  const remote = await publishPlatformEvent("announcement.created", { announcement });
  mergeRemoteEntity(announcement, extractRemoteEntity(remote, "announcement"));
  closeModal();
  saveState();
}

async function handleMessageCreate(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const courseId = String(formData.get("courseId")).trim();
  const subjectPrefix = courseId ? `[${getCourseById(courseId)?.title || "Cours"}] ` : "";
  const toUserId = String(formData.get("toUserId")).trim();
  if (!toUserId) {
    alert("Aucun destinataire disponible pour ce message.");
    return;
  }
  const message = {
    id: crypto.randomUUID(),
    fromUserId: getCurrentUser().id,
    toUserId,
    courseId,
    subject: `${subjectPrefix}${String(formData.get("subject")).trim()}`,
    content: String(formData.get("content")).trim(),
    createdAt: nowISO(),
    read: false
  };
  state.messages.unshift(message);
  if (shouldUseSupabasePersistence()) {
    try {
      await supabaseUpsert("messages", {
        id: message.id,
        from_profile_id: message.fromUserId || null,
        to_profile_id: message.toUserId,
        subject: message.subject || "",
        content: message.content || "",
        related_course_id: message.courseId || null,
        is_read: false,
        created_at: message.createdAt
      });
    } catch (error) {
      console.warn("Supabase message sync ignored:", error);
    }
  }
  addNotification({ userId: toUserId, title: "Nouveau message", message: "Un nouveau message vous attend dans la messagerie.", level: "primary" });
  const remote = await publishPlatformEvent("message.created", { message, courseId });
  mergeRemoteEntity(message, extractRemoteEntity(remote, "message"));
  closeModal();
  saveState();
}

async function handleForumCreate(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const courseId = String(formData.get("courseId")).trim();
  const thread = {
    id: crypto.randomUUID(),
    courseId,
    title: String(formData.get("title")).trim(),
    createdBy: getCurrentUser().id,
    createdAt: nowISO(),
    posts: [
      {
        id: crypto.randomUUID(),
        authorId: getCurrentUser().id,
        content: String(formData.get("content")).trim(),
        createdAt: nowISO()
      }
    ]
  };
  state.forumThreads.unshift(thread);
  if (shouldUseSupabasePersistence()) {
    try {
      await supabaseUpsert("forum_threads", {
        id: thread.id,
        course_id: thread.courseId,
        title: thread.title,
        created_by: thread.createdBy || null,
        created_at: thread.createdAt
      });
      await supabaseUpsert("forum_posts", {
        id: thread.posts[0].id,
        thread_id: thread.id,
        author_profile_id: thread.posts[0].authorId || null,
        content: thread.posts[0].content || "",
        created_at: thread.posts[0].createdAt
      });
    } catch (error) {
      console.warn("Supabase forum thread sync ignored:", error);
    }
  }
  const remote = await publishPlatformEvent("forum.thread.created", { thread, courseId });
  mergeRemoteEntity(thread, extractRemoteEntity(remote, "thread"));
  closeModal();
  saveState();
}

async function handleForumReplyCreate(event) {
  event.preventDefault();
  const thread = state.forumThreads.find((item) => item.id === event.currentTarget.dataset.threadId);
  if (!thread) return;
  const formData = new FormData(event.currentTarget);
  const post = {
    id: crypto.randomUUID(),
    authorId: getCurrentUser().id,
    content: String(formData.get("content")).trim(),
    createdAt: nowISO()
  };
  thread.posts.push(post);
  if (shouldUseSupabasePersistence()) {
    supabaseUpsert("forum_posts", {
      id: post.id,
      thread_id: thread.id,
      author_profile_id: post.authorId || null,
      content: post.content || "",
      created_at: post.createdAt
    }).catch((error) => console.warn("Supabase forum reply sync ignored:", error));
  }
  const remote = await publishPlatformEvent("forum.post.created", { threadId: thread.id, post });
  mergeRemoteEntity(post, extractRemoteEntity(remote, "post"));
  saveState();
  openForumThreadModal(thread.id);
}

async function handleAttendanceCreate(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const courseId = String(formData.get("courseId")).trim();
  const course = getCourseById(courseId);
  if (!course) return;
  const records = getCourseStudents(course).map((student) => ({
    userId: student.id,
    status: String(formData.get(`attendance-${student.id}`) || "present"),
    note: ""
  }));
  const session = {
    id: crypto.randomUUID(),
    courseId,
    title: String(formData.get("title")).trim(),
    sessionDate: new Date(String(formData.get("sessionDate"))).toISOString(),
    createdBy: getCurrentUser().id,
    records
  };
  state.attendanceSessions.unshift(session);
  if (shouldUseSupabasePersistence()) {
    try {
      await supabaseUpsert("attendance_sessions", {
        id: session.id,
        course_id: session.courseId,
        title: session.title,
        session_date: session.sessionDate || nowISO(),
        created_by: session.createdBy || null,
        created_at: session.createdAt || nowISO()
      });
      await supabaseUpsert("attendance_records", session.records.map((record) => ({
        session_id: session.id,
        profile_id: record.userId,
        status: record.status || "present",
        note: record.note || ""
      })), "session_id,profile_id");
    } catch (error) {
      console.warn("Supabase attendance sync ignored:", error);
    }
  }
  const remote = await publishPlatformEvent("attendance.created", { session, courseId });
  mergeRemoteEntity(session, extractRemoteEntity(remote, "session"));
  closeModal();
  saveState();
}

async function handleQuizSubmit(event) {
  event.preventDefault();
  const activityId = event.currentTarget.dataset.activityId;
  const activity = getActivityById(activityId);
  const user = getCurrentUser();
  const previousAttempts = state.submissions.filter((item) => item.activityId === activityId && item.userId === user.id).length;
  if (activity.attemptsAllowed && previousAttempts >= activity.attemptsAllowed) {
    alert("Le nombre maximal de tentatives a été atteint pour ce quiz.");
    return;
  }
  const formData = new FormData(event.currentTarget);
  let score = 0;
  let needsManualReview = false;
  const answers = activity.questions.map((question) => {
    const value = String(formData.get(`question-${question.id}`) || "");
    const normalizedValue = value.trim().toLowerCase();
    const normalizedAnswer = String(question.answer || "").trim().toLowerCase();
    if (["mcq", "truefalse", "short"].includes(question.kind) && normalizedValue === normalizedAnswer) score += question.points;
    if (question.kind === "open") needsManualReview = true;
    return { questionId: question.id, value };
  });
  const maxPoints = activity.questions.reduce((sum, question) => sum + question.points, 0);
  const submission = {
    id: crypto.randomUUID(),
    activityId,
    userId: user.id,
    status: needsManualReview ? "submitted" : "graded",
    score: needsManualReview ? score : score,
    maxPoints,
    answers,
    feedback: needsManualReview ? "Le quiz a ete soumis. Les questions ouvertes seront corrigees par un enseignant." : "Correction automatique terminee.",
    submittedAt: nowISO(),
    reviewedAt: needsManualReview ? null : nowISO()
  };
  state.submissions.push(submission);
  if (shouldUseSupabasePersistence()) {
    supabaseUpsert("submissions", {
      id: submission.id,
      activity_id: submission.activityId,
      profile_id: submission.userId,
      status: submission.status || "submitted",
      score: typeof submission.score === "number" ? submission.score : null,
      max_points: submission.maxPoints || null,
      answers: submission.answers || [],
      feedback: submission.feedback || "",
      submitted_at: submission.submittedAt || nowISO(),
      reviewed_at: submission.reviewedAt || null
    }).catch((error) => console.warn("Supabase quiz submission sync ignored:", error));
  }
  addLog(user.id, `Quiz soumis - ${activity.title}`);
  addNotification({
    userId: user.id,
    title: needsManualReview ? "Quiz soumis pour correction" : "Quiz corrige automatiquement",
    message: needsManualReview ? `Votre quiz ${activity.title} attend une validation de l'enseignant.` : `Votre score pour ${activity.title} est disponible.`,
    level: needsManualReview ? "warning" : "success"
  });
  const course = getCourseById(activity.courseId);
  if (needsManualReview && course?.teacherId) {
    addNotification({
      userId: course.teacherId,
      title: "Quiz avec question ouverte a corriger",
      message: `${user.name} a soumis ${activity.title}.`,
      level: "primary"
    });
  }
  const remote = await publishPlatformEvent("quiz.submitted", {
    submission,
    activityId,
    courseId: activity.courseId
  });
  mergeRemoteEntity(submission, extractRemoteEntity(remote, "submission"));
  saveState();
}

async function handleAssignmentSubmit(event) {
  event.preventDefault();
  const activityId = event.currentTarget.dataset.activityId;
  const activity = getActivityById(activityId);
  const user = getCurrentUser();
  const formData = new FormData(event.currentTarget);
  let uploaded = { fileName: "", fileUrl: "", storagePath: "" };
  const selectedFile = formData.get("fileUpload");
  if (selectedFile instanceof File && selectedFile.size > 0 && shouldUseSupabasePersistence()) {
    try {
      uploaded = await uploadAssignmentFileToSupabase(selectedFile, activity, user);
    } catch (error) {
      alert(`Upload Supabase impossible : ${error.message || "erreur inconnue"}`);
    }
  }
  const manualFileName = String(formData.get("fileName") || "").trim();
  const submission = {
    id: crypto.randomUUID(),
    activityId,
    userId: user.id,
    status: "submitted",
    score: null,
    maxPoints: activity.maxPoints || 20,
    text: String(formData.get("text")).trim(),
    fileName: uploaded.fileName || manualFileName,
    fileUrl: uploaded.fileUrl || (manualFileName.startsWith("http://") || manualFileName.startsWith("https://") ? manualFileName : ""),
    storagePath: uploaded.storagePath || "",
    submittedAt: nowISO()
  };
  state.submissions.push(submission);
  if (shouldUseSupabasePersistence()) {
    supabaseUpsert("submissions", {
      id: submission.id,
      activity_id: submission.activityId,
      profile_id: submission.userId,
      status: submission.status || "submitted",
      score: null,
      max_points: submission.maxPoints || null,
      text_answer: submission.text || "",
      file_name: submission.fileName || "",
      file_url: submission.fileUrl || "",
      feedback: submission.feedback || "",
      submitted_at: submission.submittedAt || nowISO()
    }).catch((error) => console.warn("Supabase assignment submission sync ignored:", error));
  }
  const course = getCourseById(activity.courseId);
  if (course?.teacherId) addNotification({ userId: course.teacherId, title: "Nouvelle copie a corriger", message: `${user.name} a soumis ${activity.title}.`, level: "primary" });
  addLog(user.id, `Devoir soumis - ${activity.title}`);
  const remote = await publishPlatformEvent("assignment.submitted", {
    submission,
    activityId,
    courseId: activity.courseId
  });
  mergeRemoteEntity(submission, extractRemoteEntity(remote, "submission"));
  saveState();
}

async function handleReviewSubmit(event) {
  event.preventDefault();
  const submission = state.submissions.find((item) => item.id === event.currentTarget.dataset.submissionId);
  if (!submission) return;
  const formData = new FormData(event.currentTarget);
  submission.score = Number(formData.get("score"));
  submission.maxPoints = Number(formData.get("maxPoints"));
  submission.feedback = String(formData.get("feedback")).trim();
  submission.status = "reviewed";
  submission.reviewedAt = nowISO();
  if (shouldUseSupabasePersistence()) {
    supabaseUpsert("submissions", {
      id: submission.id,
      activity_id: submission.activityId,
      profile_id: submission.userId,
      status: submission.status,
      score: submission.score,
      max_points: submission.maxPoints,
      text_answer: submission.text || "",
      file_name: submission.fileName || "",
      file_url: submission.fileUrl || "",
      answers: submission.answers || [],
      feedback: submission.feedback || "",
      submitted_at: submission.submittedAt || nowISO(),
      reviewed_at: submission.reviewedAt || nowISO()
    }).catch((error) => console.warn("Supabase review sync ignored:", error));
  }
  addNotification({ userId: submission.userId, title: "Correction disponible", message: "Une nouvelle note a ete publiee sur votre espace.", level: "success" });
  const remote = await publishPlatformEvent("submission.reviewed", { submission });
  mergeRemoteEntity(submission, extractRemoteEntity(remote, "submission"));
  closeModal();
  saveState();
}

function handleSettingsSave(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  state.config.site.headline = String(formData.get("siteHeadline")).trim();
  state.config.site.banner = String(formData.get("siteBanner")).trim();
  state.config.site.subBanner = String(formData.get("siteSubBanner")).trim();
  state.config.site.contactPhone = String(formData.get("sitePhone")).trim();
  state.config.site.contactEmail = String(formData.get("siteEmail")).trim();
  state.config.site.contactAddress = String(formData.get("siteAddress")).trim();
  state.config.site.whatsappUrl = String(formData.get("siteWhatsapp")).trim();
  state.config.payments.mixxEnabled = String(formData.get("mixxEnabled")) === "true";
  state.config.payments.floozEnabled = String(formData.get("floozEnabled")) === "true";
  state.config.payments.mode = String(formData.get("paymentMode")).trim();
  state.config.payments.callbackUrl = String(formData.get("paymentCallback")).trim();
  state.config.payments.merchantMixx = String(formData.get("merchantMixx")).trim();
  state.config.payments.merchantFlooz = String(formData.get("merchantFlooz")).trim();
  state.config.persistence.mode = String(formData.get("persistenceMode")).trim();
  state.config.persistence.apiBaseUrl = String(formData.get("persistenceApiBaseUrl")).trim();
  state.config.persistence.healthPath = String(formData.get("persistenceHealthPath")).trim() || "/health";
  state.config.persistence.apiSnapshotPath = String(formData.get("persistenceApiSnapshotPath")).trim() || "/lms/state";
  state.config.persistence.authMePath = String(formData.get("persistenceAuthMePath")).trim() || "/auth/me";
  state.config.persistence.summaryPath = String(formData.get("persistenceSummaryPath")).trim() || "/lms/summary";
  state.config.persistence.eventsReadPath = String(formData.get("persistenceEventsReadPath")).trim() || "/lms/events";
  state.config.persistence.apiToken = String(formData.get("persistenceApiToken")).trim();
  state.config.persistence.authLoginPath = String(formData.get("persistenceAuthLoginPath")).trim() || "/auth/login";
  state.config.persistence.authRegisterPath = String(formData.get("persistenceAuthRegisterPath")).trim() || "/auth/register";
  state.config.persistence.paymentInitPath = String(formData.get("persistencePaymentInitPath")).trim() || "/payments/init";
  state.config.persistence.paymentStatusPath = String(formData.get("persistencePaymentStatusPath")).trim() || "/payments/status";
  state.config.persistence.operationsPath = String(formData.get("persistenceOperationsPath")).trim() || "/lms/events";
  state.config.googleSheets.enabled = String(formData.get("enabled")) === "true";
  state.config.googleSheets.webAppUrl = String(formData.get("webAppUrl")).trim();
  state.config.jsonbin.enabled = String(formData.get("jsonbinEnabled")) === "true";
  state.config.jsonbin.binId = String(formData.get("jsonbinBinId")).trim();
  state.config.jsonbin.apiKey = String(formData.get("jsonbinApiKey")).trim();
  state.config.jsonbin.accessKey = String(formData.get("jsonbinAccessKey")).trim();
  state.config.supabase.enabled = String(formData.get("supabaseEnabled")) === "true";
  state.config.supabase.projectRef = String(formData.get("supabaseProjectRef")).trim();
  state.config.supabase.url = String(formData.get("supabaseUrl")).trim();
  state.config.supabase.anonKey = String(formData.get("supabaseAnonKey")).trim();
  state.config.supabase.storageBucket = String(formData.get("supabaseStorageBucket")).trim() || "adsl2ef-files";
  state.config.supabase.lastSyncAt = state.config.supabase.enabled ? nowISO() : "";
  closeModal();
  saveState();
}

async function handleAdminUserCreate(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const name = String(formData.get("name")).trim();
  const email = String(formData.get("email")).trim().toLowerCase();
  if (state.users.some((user) => user.email.toLowerCase() === email)) return alert("Email deja utilise.");
  const createdUser = {
    id: crypto.randomUUID(),
    name,
    email,
    password: await secureLocalPassword(String(formData.get("password"))),
    role: String(formData.get("role")),
    bio: "Compte cree par l'administration.",
    avatar: initials(name),
    createdAt: nowISO()
  };
  state.users.push(createdUser);
  addLog(getCurrentUser().id, `Utilisateur créé - ${name}`);
  const remote = await publishPlatformEvent("user.created", { user: createdUser });
  mergeRemoteEntity(createdUser, extractRemoteEntity(remote, "user"));
  closeModal();
  saveState();
}

async function handleAdminUserEdit(event) {
  event.preventDefault();
  const user = getUserById(event.currentTarget.dataset.userId);
  if (!user) return;
  const formData = new FormData(event.currentTarget);
  const email = String(formData.get("email")).trim().toLowerCase();
  if (state.users.some((item) => item.id !== user.id && item.email.toLowerCase() === email)) return alert("Email deja utilise.");
  user.name = String(formData.get("name")).trim();
  user.email = email;
  const nextPassword = String(formData.get("password")).trim();
  if (nextPassword) {
    user.password = await secureLocalPassword(nextPassword);
  }
  user.role = String(formData.get("role")).trim();
  user.bio = String(formData.get("bio")).trim();
  user.avatar = initials(user.name);
  addLog(getCurrentUser().id, `Utilisateur modifié - ${user.name}`);
  const remote = await publishPlatformEvent("user.updated", { user });
  mergeRemoteEntity(user, extractRemoteEntity(remote, "user"));
  closeModal();
  saveState();
}

async function initializeApp() {
  renderApp();
  const persistence = getPersistenceConfig();
  let remoteLoaded = false;
  if (persistence.mode === "api") {
    if (state.session?.accessToken) {
      try {
        await restoreSessionWithApi();
      } catch (error) {
        console.warn("API session restore ignored:", error);
        state.session = { accessToken: "", authProvider: "local", lastAuthAt: "" };
      }
    }
    remoteLoaded = await loadStateFromApi();
  } else if (persistence.mode === "supabase") {
    try {
      await restoreSessionWithSupabase();
    } catch (error) {
      console.warn("Supabase session restore ignored:", error);
      state.session = { accessToken: "", authProvider: "local", lastAuthAt: "" };
    }
    try {
      remoteLoaded = await loadStateFromSupabase();
    } catch (error) {
      console.warn("Supabase load ignored:", error);
    }
  } else if (persistence.mode === "jsonbin") {
    remoteLoaded = await loadCoursesFromJsonBin();
  } else if (state.config.jsonbin?.enabled) {
    remoteLoaded = await loadCoursesFromJsonBin();
  }
  if (remoteLoaded) renderApp();
}

initializeApp();

window.showAuthModal = showAuthModal;
window.logout = logout;
window.setScreen = setScreen;
window.setSchoolCategory = setSchoolCategory;
window.openCourse = openCourse;
window.openLessonResource = openLessonResource;
window.openActivity = openActivity;
window.selectModule = selectModule;
window.selectLesson = selectLesson;
window.toggleModuleRelease = toggleModuleRelease;
window.toggleLessonRelease = toggleLessonRelease;
window.focusFirstStudentCourse = focusFirstStudentCourse;
window.openEnrollmentModal = openEnrollmentModal;
window.openProfileModal = openProfileModal;
window.openPlatformSettings = openPlatformSettings;
window.openUserBuilder = openUserBuilder;
window.openUserEditor = openUserEditor;
window.openCourseBuilder = openCourseBuilder;
window.openCourseEditor = openCourseEditor;
window.openActivityBuilder = openActivityBuilder;
window.openActivityEditor = openActivityEditor;
window.openQuizEditor = openQuizEditor;
window.openQuestionBankBuilder = openQuestionBankBuilder;
window.attachQuestionToQuiz = attachQuestionToQuiz;
window.openModuleBuilder = openModuleBuilder;
window.openModuleEditor = openModuleEditor;
window.openLessonBuilder = openLessonBuilder;
window.openLessonEditor = openLessonEditor;
window.openAnnouncementBuilder = openAnnouncementBuilder;
window.openMessageComposer = openMessageComposer;
window.openForumBuilder = openForumBuilder;
window.openForumThreadModal = openForumThreadModal;
window.openAttendanceModal = openAttendanceModal;
window.openAttemptResetModal = openAttemptResetModal;
window.openReviewCenter = openReviewCenter;
window.openReviewModal = openReviewModal;
window.resetQuizAttempts = resetQuizAttempts;
window.markAllNotificationsRead = markAllNotificationsRead;
window.closeModal = closeModal;
window.enrollUser = enrollUser;
window.unenrollUser = unenrollUser;
window.openCourseEnrollmentModal = openCourseEnrollmentModal;
window.openCourseRosterModal = openCourseRosterModal;
window.openBulkEnrollmentModal = openBulkEnrollmentModal;
window.purchaseCourse = purchaseCourse;
window.processPayment = processPayment;
window.checkPaymentStatus = checkPaymentStatus;
window.showContactSalesModal = showContactSalesModal;
window.refreshCoursesFromJsonBin = refreshCoursesFromJsonBin;
window.syncPlatformNow = syncPlatformNow;
window.exportSupabaseSeedSql = exportSupabaseSeedSql;
window.testApiConnection = testApiConnection;
window.openBackendSummary = openBackendSummary;
window.openBackendEvents = openBackendEvents;
window.openCertificateModal = openCertificateModal;
window.exportGradebook = exportGradebook;
window.archiveCourse = archiveCourse;
window.restoreCourse = restoreCourse;
window.removeCourse = removeCourse;
window.removeModule = removeModule;
window.removeLesson = removeLesson;
window.toggleLessonCompletion = toggleLessonCompletion;
window.setAdminFilter = setAdminFilter;
window.removeUser = removeUser;

