// ---------------------------------------------------------------------------
// Benkyo Flow — Worker Cloudflare
// ---------------------------------------------------------------------------
// Rôle :
//   1. Servir les fichiers statiques buildés (dist/) via le binding ASSETS.
//   2. Authentifier les utilisateurs (email + mot de passe) avec une session
//      par cookie httpOnly, stockée dans D1 (/api/auth/*).
//   3. Exposer une API REST protégée (/api/subjects, /api/homework,
//      /api/goals) pour synchroniser les données du compte connecté.
//
// Si le binding D1 (env.DB) n'est pas configuré, toutes les routes /api/*
// répondent 503 avec un message clair — l'app statique continue de
// fonctionner normalement en mode local (localStorage) dans ce cas.
// ---------------------------------------------------------------------------

// Types minimalistes pour éviter d'ajouter la dépendance @cloudflare/workers-types
// à ce projet volontairement simple. Wrangler fournit les vraies implémentations
// à l'exécution ; ces déclarations ne servent qu'à guider l'éditeur.
interface Fetcher {
  fetch(request: Request): Promise<Response>;
}
interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
  all<T = unknown>(): Promise<D1Result<T>>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}
interface Ai {
  run(model: string, input: unknown): Promise<unknown>;
}

export interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  AI?: Ai;
  // Récupération de mot de passe par email (via l'API Resend).
  RESEND_API_KEY?: string; // secret : npx wrangler secret put RESEND_API_KEY
  RESET_EMAIL_FROM?: string; // ex. "Benkyō Flow <no-reply@tondomaine.fr>"
  APP_URL?: string; // ex. "https://benkyo-flow.tondomaine.workers.dev" ; sinon déduit de la requête
  // Récupération de mot de passe manuelle (page admin, envoi du code via WhatsApp).
  ADMIN_ACCESS_CODE?: string; // secret : npx wrangler secret put ADMIN_ACCESS_CODE
}

const SESSION_COOKIE = "bf_session";
const SESSION_DAYS = 30;
const RESET_TOKEN_MINUTES = 30;
const MANUAL_CODE_MINUTES = 30;
const MANUAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I, pour éviter les confusions à la lecture/écriture

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) headers.append(key, value);
  }
  return new Response(JSON.stringify(data), { status, headers });
}

// --- Cryptographie (Web Crypto, native sur Workers) ------------------------

function randomHex(byteLength: number): string {
  const arr = new Uint8Array(byteLength);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Code court (8 caractères) pensé pour être lu/tapé à la main — utilisé
// pour la récupération manuelle de mot de passe (envoi du code par WhatsApp
// depuis la page admin).
function randomManualCode(length = 8): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => MANUAL_CODE_ALPHABET[b % MANUAL_CODE_ALPHABET.length]).join("");
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Utilisé pour les tokens de réinitialisation : on stocke uniquement ce
// hash en base, jamais le token brut envoyé par email.
async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Compare deux chaînes en temps constant (en comparant leurs hashs de même
// longueur fixe) pour protéger le mot de passe admin contre une attaque par
// mesure du temps de réponse.
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [hashA, hashB] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  if (hashA.length !== hashB.length) return false;
  let diff = 0;
  for (let i = 0; i < hashA.length; i++) diff |= hashA.charCodeAt(i) ^ hashB.charCodeAt(i);
  return diff === 0;
}

async function sendPasswordResetEmail(env: Env, to: string, resetUrl: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY manquant.");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESET_EMAIL_FROM || "Benkyō Flow <onboarding@resend.dev>",
      to: [to],
      subject: "Réinitialise ton mot de passe — Benkyō Flow",
      html:
        `<div style="font-family: sans-serif; line-height: 1.5; color: #1f2937;">` +
        `<p>Bonjour,</p>` +
        `<p>Tu as demandé à réinitialiser ton mot de passe Benkyō Flow. ` +
        `Ce lien est valable ${RESET_TOKEN_MINUTES} minutes :</p>` +
        `<p><a href="${resetUrl}" style="color:#4f46e5;">${resetUrl}</a></p>` +
        `<p>Si tu n'es pas à l'origine de cette demande, ignore simplement cet email : ` +
        `ton mot de passe actuel reste inchangé.</p>` +
        `</div>`,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Échec d'envoi Resend (${res.status}) ${detail}`);
  }
}

// --- Cookies & sessions ------------------------------------------------------

function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get("Cookie") || "";
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function buildSessionCookie(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === "https:";
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
    secure ? "; Secure" : ""
  }`;
}

function buildClearCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

async function createSession(env: Env, userId: string): Promise<string> {
  const token = randomHex(32);
  const now = Date.now();
  const expiresAt = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await env
    .DB!.prepare("INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(token, userId, expiresAt, now)
    .run();
  return token;
}

async function getUserIdFromRequest(request: Request, env: Env): Promise<string | null> {
  if (!env.DB) return null;
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const row = await env.DB.prepare("SELECT user_id, expires_at FROM sessions WHERE token = ?")
    .bind(token)
    .first<{ user_id: string; expires_at: number }>();
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    return null;
  }
  return row.user_id;
}

// --- Routes d'authentification (/api/auth/*) --------------------------------
//
// Toutes les routes ci-dessous répondent en JSON. Sauf mention contraire,
// aucune ne nécessite d'être déjà authentifié (elles servent justement à
// le devenir), et aucune ne prend de paramètre d'URL — tout passe par le
// corps JSON de la requête. Résumé des endpoints :
//
//   GET  /api/auth/me                → session courante
//     Auth requise (cookie de session). 200 { user } · 401 si non connecté.
//
//   POST /api/auth/register          → création de compte
//     Corps : { email, password, name }. password ≥ 8 caractères.
//     200 { user } + Set-Cookie (session ouverte immédiatement) ·
//     400 champs invalides · 409 email déjà utilisé.
//
//   POST /api/auth/login             → connexion
//     Corps : { email, password }.
//     200 { user } + Set-Cookie · 400 champs manquants ·
//     401 email/mot de passe incorrect.
//
//   POST /api/auth/logout            → déconnexion
//     Invalide la session courante côté serveur et efface le cookie.
//     200 { ok: true } (toujours, même sans session active).
//
//   POST /api/auth/forgot-password   → demande de réinitialisation par email
//     Corps : { email }. Réponse volontairement identique que le compte
//     existe ou non (200 { ok, message } dans tous les cas), pour ne pas
//     laisser deviner quels emails sont inscrits. Envoie un email (Resend)
//     avec un lien à usage unique, valable RESET_TOKEN_MINUTES minutes.
//     503 si l'envoi échoue faute de secret RESEND_API_KEY configuré.
//
//   POST /api/auth/reset-password    → application du nouveau mot de passe
//     Corps : { token, password }. Le token vient du lien envoyé par email.
//     200 { ok: true } · 400 lien invalide/expiré ou mot de passe trop
//     court. Effet de bord : déconnecte aussi toutes les sessions
//     existantes du compte par précaution.
//
//   POST /api/auth/admin-generate-code → réinitialisation manuelle (secours)
//     Corps : { adminAccessCode, email }. Réservé à l'administrateur du
//     déploiement (secret ADMIN_ACCESS_CODE, comparé en temps constant) ;
//     génère un code à usage unique à transmettre manuellement au titulaire
//     du compte (ex. par WhatsApp) plutôt que par email.
//     200 { code, expiresInMinutes } · 401 code admin incorrect ·
//     404 aucun compte avec cet email · 503 fonctionnalité non configurée.
//
//   POST /api/auth/admin-stats       → statistiques des comptes
//     Corps : { adminAccessCode }. Même protection que ci-dessus.
//     200 { totalUsers, newUsersLast7Days, newUsersLast30Days,
//           activeSessionsNow, activeUsersLast7Days, activeUsersLast30Days
//           (basés sur une création de contenu, pas juste une connexion),
//           totalStudyMinutesAll, totalHomeworkAll, totalNotionsAll,
//           totalGoalsAll, totalEventsAll, totalSubjectsAll,
//           signupsLast30Days: [{ day, count }], users: [...] } ·
//     401 code admin incorrect · 503 fonctionnalité non configurée.
//
// Toute route inconnue sous /api/auth/* renvoie 404.

async function handleAuth(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.DB) {
    return json({ error: "Les comptes ne sont pas configurés sur ce déploiement (D1 manquant)." }, 503);
  }

  const action = url.pathname.split("/")[3]; // /api/auth/<action>

  if (action === "me" && request.method === "GET") {
    const userId = await getUserIdFromRequest(request, env);
    if (!userId) return json({ error: "Non authentifié." }, 401);
    const user = await env.DB.prepare("SELECT id, email, name FROM users WHERE id = ?").bind(userId).first();
    if (!user) return json({ error: "Non authentifié." }, 401);
    return json({ user });
  }

  if (action === "register" && request.method === "POST") {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const name = String(body?.name ?? "").trim();

    if (!email || !email.includes("@") || password.length < 8 || !name) {
      return json({ error: "Email, prénom et mot de passe (8 caractères min.) requis." }, 400);
    }

    const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existing) return json({ error: "Un compte existe déjà avec cet email." }, 409);

    const salt = randomHex(16);
    const passwordHash = await hashPassword(password, salt);
    const id = crypto.randomUUID();
    const now = Date.now();

    await env.DB.prepare(
      "INSERT INTO users (id, email, name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(id, email, name, passwordHash, salt, now)
      .run();

    const token = await createSession(env, id);
    return json({ user: { id, email, name } }, 200, { "Set-Cookie": buildSessionCookie(token, request) });
  }

  if (action === "login" && request.method === "POST") {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    if (!email || !password) return json({ error: "Email et mot de passe requis." }, 400);

    const user = await env.DB.prepare(
      "SELECT id, email, name, password_hash, password_salt FROM users WHERE email = ?"
    )
      .bind(email)
      .first<{ id: string; email: string; name: string; password_hash: string; password_salt: string }>();

    if (!user) return json({ error: "Email ou mot de passe incorrect." }, 401);

    const computed = await hashPassword(password, user.password_salt);
    if (computed !== user.password_hash) {
      return json({ error: "Email ou mot de passe incorrect." }, 401);
    }

    const token = await createSession(env, user.id);
    return json(
      { user: { id: user.id, email: user.email, name: user.name } },
      200,
      { "Set-Cookie": buildSessionCookie(token, request) }
    );
  }

  if (action === "logout" && request.method === "POST") {
    const token = parseCookies(request)[SESSION_COOKIE];
    if (token) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    return json({ ok: true }, 200, { "Set-Cookie": buildClearCookie(request) });
  }

  if (action === "forgot-password" && request.method === "POST") {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const email = String(body?.email ?? "").trim().toLowerCase();

    // Réponse volontairement identique que le compte existe ou non, pour ne
    // pas permettre à quelqu'un de deviner quels emails sont inscrits.
    const generic = {
      ok: true,
      message: "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.",
    };
    if (!email || !email.includes("@")) return json(generic);

    const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first<{ id: string }>();
    if (!user) return json(generic);

    const rawToken = randomHex(32);
    const tokenHash = await sha256Hex(rawToken);
    const now = Date.now();
    const expiresAt = now + RESET_TOKEN_MINUTES * 60 * 1000;

    // Un seul lien valide à la fois par compte : une nouvelle demande
    // invalide les précédentes.
    await env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").bind(user.id).run();
    await env.DB.prepare(
      "INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
    )
      .bind(tokenHash, user.id, expiresAt, now)
      .run();

    const appUrl = env.APP_URL || new URL(request.url).origin;
    const resetUrl = `${appUrl}/?reset_token=${rawToken}`;

    try {
      await sendPasswordResetEmail(env, email, resetUrl);
    } catch (err) {
      console.error("Échec d'envoi de l'email de reset :", err);
      // Si l'envoi échoue à cause d'une config manquante, autant le dire
      // clairement (utile en dev) plutôt que de faire croire qu'un email
      // vient de partir alors que ce n'est pas le cas.
      if (!env.RESEND_API_KEY) {
        return json(
          { error: "Envoi d'email non configuré sur ce déploiement (secret RESEND_API_KEY manquant)." },
          503
        );
      }
    }

    return json(generic);
  }

  if (action === "reset-password" && request.method === "POST") {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const token = String(body?.token ?? "");
    const password = String(body?.password ?? "");
    if (!token || password.length < 8) {
      return json({ error: "Lien invalide ou mot de passe trop court (8 caractères min.)." }, 400);
    }

    const tokenHash = await sha256Hex(token);
    const row = await env.DB.prepare(
      "SELECT user_id, expires_at FROM password_reset_tokens WHERE token_hash = ?"
    )
      .bind(tokenHash)
      .first<{ user_id: string; expires_at: number }>();

    if (!row) {
      return json({ error: "Ce lien de réinitialisation est invalide ou a déjà été utilisé." }, 400);
    }
    if (row.expires_at < Date.now()) {
      await env.DB.prepare("DELETE FROM password_reset_tokens WHERE token_hash = ?").bind(tokenHash).run();
      return json({ error: "Ce lien de réinitialisation a expiré. Refais une demande." }, 400);
    }

    const salt = randomHex(16);
    const passwordHash = await hashPassword(password, salt);
    await env.DB.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?")
      .bind(passwordHash, salt, row.user_id)
      .run();

    // Le lien est à usage unique. On déconnecte aussi toutes les sessions
    // existantes du compte : si le mot de passe a fuité, une session déjà
    // ouverte ailleurs ne doit pas rester valide indéfiniment.
    await env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").bind(row.user_id).run();
    await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(row.user_id).run();

    return json({ ok: true });
  }

  if (action === "admin-generate-code" && request.method === "POST") {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const adminAccessCode = String(body?.adminAccessCode ?? "");
    const email = String(body?.email ?? "").trim().toLowerCase();

    if (!env.ADMIN_ACCESS_CODE) {
      return json({ error: "ADMIN_ACCESS_CODE non configuré sur ce déploiement." }, 503);
    }
    // Comparaison en temps constant pour éviter une attaque par timing sur
    // le mot de passe admin.
    if (!(await timingSafeEqual(adminAccessCode, env.ADMIN_ACCESS_CODE))) {
      return json({ error: "Mot de passe admin incorrect." }, 401);
    }
    if (!email || !email.includes("@")) {
      return json({ error: "Email invalide." }, 400);
    }

    const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first<{ id: string }>();
    if (!user) {
      return json({ error: "Aucun compte trouvé avec cet email." }, 404);
    }

    const rawCode = randomManualCode(8);
    const tokenHash = await sha256Hex(rawCode);
    const now = Date.now();
    const expiresAt = now + MANUAL_CODE_MINUTES * 60 * 1000;

    // Un seul code valide à la fois par compte : en générer un nouveau
    // invalide automatiquement le précédent.
    await env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").bind(user.id).run();
    await env.DB.prepare(
      "INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
    )
      .bind(tokenHash, user.id, expiresAt, now)
      .run();

    return json({ code: rawCode, expiresInMinutes: MANUAL_CODE_MINUTES });
  }

  if (action === "admin-stats" && request.method === "POST") {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const adminAccessCode = String(body?.adminAccessCode ?? "");

    if (!env.ADMIN_ACCESS_CODE) {
      return json({ error: "ADMIN_ACCESS_CODE non configuré sur ce déploiement." }, 503);
    }
    if (!(await timingSafeEqual(adminAccessCode, env.ADMIN_ACCESS_CODE))) {
      return json({ error: "Mot de passe admin incorrect." }, 401);
    }

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const totals = await env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM users) AS total_users,
         (SELECT COUNT(*) FROM users WHERE created_at >= ?) AS new_7d,
         (SELECT COUNT(*) FROM users WHERE created_at >= ?) AS new_30d,
         (SELECT COUNT(*) FROM sessions WHERE expires_at > ?) AS active_sessions,
         (SELECT COALESCE(SUM(minutes), 0) FROM study_sessions) AS total_study_minutes_all,
         (SELECT COUNT(*) FROM homework) AS total_homework_all,
         (SELECT COUNT(*) FROM notions) AS total_notions_all,
         (SELECT COUNT(*) FROM goals) AS total_goals_all,
         (SELECT COUNT(*) FROM events) AS total_events_all,
         (SELECT COUNT(*) FROM subjects) AS total_subjects_all`
    )
      .bind(sevenDaysAgo, thirtyDaysAgo, now)
      .first<{
        total_users: number;
        new_7d: number;
        new_30d: number;
        active_sessions: number;
        total_study_minutes_all: number;
        total_homework_all: number;
        total_notions_all: number;
        total_goals_all: number;
        total_events_all: number;
        total_subjects_all: number;
      }>();

    const signupsResult = await env.DB.prepare(
      `SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS count
       FROM users
       WHERE created_at >= ?
       GROUP BY day
       ORDER BY day ASC`
    )
      .bind(thirtyDaysAgo)
      .all<{ day: string; count: number }>();

    const usersResult = await env.DB.prepare(
      `SELECT
         u.id, u.email, u.name, u.created_at,
         (SELECT COUNT(*) FROM subjects WHERE user_id = u.id) AS subjects_count,
         (SELECT COUNT(*) FROM homework WHERE user_id = u.id) AS homework_count,
         (SELECT COUNT(*) FROM homework WHERE user_id = u.id AND status = 'done') AS homework_done_count,
         (SELECT COUNT(*) FROM goals WHERE user_id = u.id) AS goals_count,
         (SELECT COUNT(*) FROM notions WHERE user_id = u.id) AS notions_count,
         (SELECT COUNT(*) FROM notions WHERE user_id = u.id AND status = 'maitrisee') AS notions_mastered_count,
         (SELECT COUNT(*) FROM study_sessions WHERE user_id = u.id) AS study_sessions_count,
         (SELECT COALESCE(SUM(minutes), 0) FROM study_sessions WHERE user_id = u.id) AS total_study_minutes,
         (SELECT COUNT(*) FROM events WHERE user_id = u.id) AS events_count,
         (SELECT MAX(created_at) FROM sessions WHERE user_id = u.id) AS last_login_at,
         MAX(
           COALESCE((SELECT MAX(created_at) FROM subjects WHERE user_id = u.id), 0),
           COALESCE((SELECT MAX(created_at) FROM homework WHERE user_id = u.id), 0),
           COALESCE((SELECT MAX(created_at) FROM goals WHERE user_id = u.id), 0),
           COALESCE((SELECT MAX(created_at) FROM notions WHERE user_id = u.id), 0),
           COALESCE((SELECT MAX(created_at) FROM study_sessions WHERE user_id = u.id), 0),
           COALESCE((SELECT MAX(created_at) FROM events WHERE user_id = u.id), 0)
         ) AS last_activity_at
       FROM users u
       ORDER BY u.created_at DESC`
    ).all<{
      id: string;
      email: string;
      name: string;
      created_at: number;
      subjects_count: number;
      homework_count: number;
      homework_done_count: number;
      goals_count: number;
      notions_count: number;
      notions_mastered_count: number;
      study_sessions_count: number;
      total_study_minutes: number;
      events_count: number;
      last_login_at: number | null;
      last_activity_at: number;
    }>();

    const users = (usersResult.results ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.created_at,
      subjectsCount: u.subjects_count,
      homeworkCount: u.homework_count,
      homeworkDoneCount: u.homework_done_count,
      goalsCount: u.goals_count,
      notionsCount: u.notions_count,
      notionsMasteredCount: u.notions_mastered_count,
      studySessionsCount: u.study_sessions_count,
      totalStudyMinutes: u.total_study_minutes,
      eventsCount: u.events_count,
      lastLoginAt: u.last_login_at,
      lastActivityAt: u.last_activity_at > 0 ? u.last_activity_at : null,
    }));

    // Comptés depuis les résultats déjà en main plutôt que par une requête
    // SQL séparée : D1 limite le nombre de UNION enchaînables dans une même
    // requête (SQLITE_ERROR: too many terms in compound SELECT), ce qui
    // interdit l'approche "distinct user_id sur une union des 6 tables".
    const activeUsersLast7Days = users.filter((u) => u.lastActivityAt !== null && u.lastActivityAt >= sevenDaysAgo).length;
    const activeUsersLast30Days = users.filter((u) => u.lastActivityAt !== null && u.lastActivityAt >= thirtyDaysAgo).length;

    // Comble les jours sans inscription (0) pour un graphique continu sur
    // 30 jours, plutôt qu'une liste creuse.
    const signupsByDay = new Map((signupsResult.results ?? []).map((r) => [r.day, r.count]));
    const signupsLast30Days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now - (29 - i) * 24 * 60 * 60 * 1000);
      const day = d.toISOString().slice(0, 10);
      return { day, count: signupsByDay.get(day) ?? 0 };
    });

    return json({
      totalUsers: totals?.total_users ?? 0,
      newUsersLast7Days: totals?.new_7d ?? 0,
      newUsersLast30Days: totals?.new_30d ?? 0,
      activeSessionsNow: totals?.active_sessions ?? 0,
      activeUsersLast7Days,
      activeUsersLast30Days,
      totalStudyMinutesAll: totals?.total_study_minutes_all ?? 0,
      totalHomeworkAll: totals?.total_homework_all ?? 0,
      totalNotionsAll: totals?.total_notions_all ?? 0,
      totalGoalsAll: totals?.total_goals_all ?? 0,
      totalEventsAll: totals?.total_events_all ?? 0,
      totalSubjectsAll: totals?.total_subjects_all ?? 0,
      signupsLast30Days,
      users,
    });
  }

  return json({ error: "Route inconnue." }, 404);
}

// --- Routes de données (/api/subjects, /api/homework, /api/goals) ----------
//
// Une seule fonction générique gère les 5 ressources synchronisées avec le
// compte (subjects, homework, goals, notions, study-sessions) — voir la
// table `tables` juste en dessous pour la correspondance ressource → table
// D1. Toutes nécessitent une session valide (401 sinon) et un binding D1
// configuré (503 sinon). Le user_id de la session est systématiquement
// injecté côté serveur, jamais lu depuis le corps de la requête, pour
// qu'un compte ne puisse jamais lire/modifier les données d'un autre.
//
//   GET    /api/<ressource>          → liste complète de la ressource
//     Pour le compte connecté uniquement. 200 { results: [...] }.
//
//   POST|PUT /api/<ressource>        → création OU mise à jour (upsert)
//     Corps JSON : l'objet complet, avec au minimum { id }. Upsert par id
//     (INSERT ... ON CONFLICT DO UPDATE) : POST et PUT sont interchangeables
//     ici, l'id fait foi pour décider s'il s'agit d'une création ou d'une
//     mise à jour. 200 { ok: true } · 400 si `id` absent/invalide.
//     Champs attendus par ressource (voir schema.sql pour le détail des
//     colonnes) : subjects{name,color,icon}, homework{subjectId,title,
//     dueDate,status,notes}, goals{subjectId,title,progress,done,
//     targetDate}, notions{subjectId,chapter,name,status,lastReviewedAt,
//     nextReviewAt,note,source}, study-sessions{subjectId,minutes,date}.
//
//   DELETE /api/<ressource>?id=<id>  → suppression
//     Paramètre de requête `id` obligatoire. Portée à user_id = compte
//     connecté (impossible de supprimer l'élément d'un autre compte même en
//     devinant son id). 200 { ok: true } (même si l'id n'existait pas/plus
//     — suppression idempotente) · 400 si `id` manquant.
//
// Ressource inconnue → 404. Méthode non gérée (autre que GET/POST/PUT/
// DELETE) → 405.

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.DB) {
    return json({ error: "D1 non configuré sur ce déploiement." }, 503);
  }

  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return json({ error: "Non authentifié." }, 401);
  }

  const parts = url.pathname.split("/").filter(Boolean); // ["api", "subjects", ...]
  const resource = parts[1]; // subjects | homework | goals | notions | study-sessions

  const tables: Record<string, string> = {
    subjects: "subjects",
    homework: "homework",
    goals: "goals",
    notions: "notions",
    "study-sessions": "study_sessions",
    events: "events",
  };

  const table = tables[resource];
  if (!table) {
    return json({ error: "Ressource inconnue." }, 404);
  }

  if (request.method === "GET") {
    const { results } = await env.DB.prepare(`SELECT * FROM ${table} WHERE user_id = ?`)
      .bind(userId)
      .all();
    return json({ results });
  }

  if (request.method === "POST" || request.method === "PUT") {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.id !== "string") {
      return json({ error: "Corps de requête invalide." }, 400);
    }

    if (table === "subjects") {
      await env.DB.prepare(
        `INSERT INTO subjects (id, user_id, name, color, icon, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color, icon=excluded.icon`
      )
        .bind(
          body.id,
          userId,
          String(body.name ?? ""),
          String(body.color ?? "teal"),
          String(body.icon ?? "book-open"),
          Number(body.createdAt ?? Date.now())
        )
        .run();
    } else if (table === "homework") {
      const subtasks = Array.isArray(body.subtasks)
        ? body.subtasks
            .filter((s): s is Record<string, unknown> => !!s && typeof s === "object" && typeof (s as Record<string, unknown>).id === "string")
            .slice(0, 50)
            .map((s) => ({
              id: String((s as Record<string, unknown>).id),
              title: String((s as Record<string, unknown>).title ?? "").slice(0, 200),
              done: !!(s as Record<string, unknown>).done,
            }))
        : [];
      const recurrenceInput = body.recurrence as Record<string, unknown> | null | undefined;
      const validFrequencies = ["daily", "weekly", "monthly"];
      const recurrence =
        recurrenceInput &&
        typeof recurrenceInput === "object" &&
        validFrequencies.includes(recurrenceInput.frequency as string) &&
        typeof recurrenceInput.interval === "number" &&
        recurrenceInput.interval > 0
          ? { frequency: recurrenceInput.frequency, interval: Math.min(365, Math.floor(recurrenceInput.interval as number)) }
          : null;
      await env.DB.prepare(
        `INSERT INTO homework (id, user_id, subject_id, title, due_date, status, notes, subtasks, recurrence, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET subject_id=excluded.subject_id, title=excluded.title,
           due_date=excluded.due_date, status=excluded.status, notes=excluded.notes, subtasks=excluded.subtasks,
           recurrence=excluded.recurrence`
      )
        .bind(
          body.id,
          userId,
          (body.subjectId as string) ?? null,
          String(body.title ?? ""),
          (body.dueDate as string) ?? null,
          String(body.status ?? "todo"),
          String(body.notes ?? ""),
          JSON.stringify(subtasks),
          recurrence ? JSON.stringify(recurrence) : null,
          Number(body.createdAt ?? Date.now())
        )
        .run();
    } else if (table === "goals") {
      await env.DB.prepare(
        `INSERT INTO goals (id, user_id, subject_id, title, progress, done, target_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET subject_id=excluded.subject_id, title=excluded.title,
           progress=excluded.progress, done=excluded.done, target_date=excluded.target_date`
      )
        .bind(
          body.id,
          userId,
          (body.subjectId as string) ?? null,
          String(body.title ?? ""),
          Number(body.progress ?? 0),
          body.done ? 1 : 0,
          (body.targetDate as string) ?? null,
          Number(body.createdAt ?? Date.now())
        )
        .run();
    } else if (table === "notions") {
      await env.DB.prepare(
        `INSERT INTO notions (id, user_id, subject_id, chapter, name, status, last_reviewed_at, next_review_at, note, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET subject_id=excluded.subject_id, chapter=excluded.chapter,
           name=excluded.name, status=excluded.status, last_reviewed_at=excluded.last_reviewed_at,
           next_review_at=excluded.next_review_at, note=excluded.note, source=excluded.source`
      )
        .bind(
          body.id,
          userId,
          (body.subjectId as string) ?? null,
          String(body.chapter ?? ""),
          String(body.name ?? ""),
          String(body.status ?? "non_etudiee"),
          body.lastReviewedAt != null ? Number(body.lastReviewedAt) : null,
          (body.nextReviewAt as string) ?? null,
          String(body.note ?? ""),
          String(body.source ?? ""),
          Number(body.createdAt ?? Date.now())
        )
        .run();
    } else if (table === "study_sessions") {
      await env.DB.prepare(
        `INSERT INTO study_sessions (id, user_id, subject_id, minutes, session_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET subject_id=excluded.subject_id, minutes=excluded.minutes,
           session_date=excluded.session_date`
      )
        .bind(
          body.id,
          userId,
          (body.subjectId as string) ?? null,
          Number(body.minutes ?? 0),
          String(body.date ?? ""),
          Number(body.createdAt ?? Date.now())
        )
        .run();
    } else if (table === "events") {
      const eventType = body.type === "exam" ? "exam" : "other";
      await env.DB.prepare(
        `INSERT INTO events (id, user_id, subject_id, title, event_date, type, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET subject_id=excluded.subject_id, title=excluded.title,
           event_date=excluded.event_date, type=excluded.type, notes=excluded.notes`
      )
        .bind(
          body.id,
          userId,
          (body.subjectId as string) ?? null,
          String(body.title ?? ""),
          String(body.date ?? ""),
          eventType,
          String(body.notes ?? ""),
          Number(body.createdAt ?? Date.now())
        )
        .run();
    }

    return json({ ok: true });
  }

  if (request.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "Paramètre id manquant." }, 400);
    await env.DB.prepare(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`).bind(id, userId).run();
    return json({ ok: true });
  }

  return json({ error: "Méthode non supportée." }, 405);
}

// --- Assistant IA (/api/ai/chat) --------------------------------------------
// Ouvert sans compte (le chat doit fonctionner aussi en mode local), avec des
// garde-fous simples pour limiter le coût : historique tronqué, messages
// limités en longueur. Le "contexte" est un résumé compact préparé côté
// client (jamais un export complet de la base) — voir buildAiContext() dans
// App.tsx. Il est plafonné ici aussi, par sécurité, côté serveur.

const AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Prompt pour la conversation normale (aucun outil disponible ici) : c'est
// ce qui garantit que l'IA continue toujours à raisonner et répondre en
// texte, exactement comme avant l'ajout des actions.
const AI_CHAT_SYSTEM_PROMPT =
  "Tu es Benkyō IA, l'assistant intégré à Benkyō Flow, une application d'organisation scolaire pour " +
  "lycéens et étudiants francophones. Si on te demande ton nom, réponds « Benkyō IA ». Réponds toujours " +
  "en français, de façon claire, concise et bienveillante. Aide à organiser le travail, comprendre des " +
  "notions scolaires, réviser efficacement et rester motivé. Si la question sort du cadre scolaire, " +
  "réponds quand même utilement mais reste bref.";

// Prompt pour la décision d'action, dans un appel séparé : volontairement
// strict, pour éviter que l'IA propose des actions non demandées.
const AI_ACTION_SYSTEM_PROMPT =
  "Tu analyses UNIQUEMENT le dernier message de l'utilisateur d'une conversation avec un assistant " +
  "scolaire. Tu dois décider s'il contient une INSTRUCTION EXPLICITE ET SANS AMBIGUÏTÉ de créer, " +
  "modifier ou supprimer un élément (devoir, objectif, matière, notion, session d'étude). " +
  "N'appelle un outil QUE si l'utilisateur emploie clairement un verbe d'action dirigé vers " +
  "l'application (« crée », « ajoute », « supprime », « enregistre », « marque comme », « change le " +
  "statut », « mets à jour »...) à propos de ses propres données. " +
  "N'appelle JAMAIS un outil pour : une simple question, une demande d'explication ou de conseil, une " +
  "discussion générale, une hypothèse (« et si je... »), ou une intention vague sans ordre clair. " +
  "N'appelle JAMAIS un outil de création pour un élément qui figure déjà dans le contexte fourni " +
  "ci-dessous (même nom ou nom très proche) — dans ce cas, n'appelle rien du tout. " +
  "En cas du moindre doute, n'appelle rien. Tu peux appeler plusieurs outils si plusieurs actions " +
  "distinctes sont demandées dans le même message.";

const AI_CONTEXT_MAX_LENGTH = 1500;

// Filtre déterministe (pas d'IA impliquée ici) : on ne sollicite même pas le
// modèle pour une décision d'action si le dernier message de l'utilisateur
// ne contient aucun indice textuel d'une demande d'action. Ça élimine
// complètement les fausses propositions sur les messages neutres, plutôt
// que de compter uniquement sur le bon respect du prompt par le modèle.
const ACTION_INTENT_REGEX =
  /\b(crée|cree|créer|creer|créé|créée|ajoute|ajouter|ajout|supprime|supprimer|efface|effacer|enlève|enleve|retire|retirer|marque|marquer|termine|terminer|complète|complete|modifie|modifier|change|changer|mets? à jour|mets a jour|met à jour|programme|programmer|planifie|planifier|enregistre|enregistrer|note que j'ai|j'ai étudié|j'ai etudie|j'ai révisé|j'ai revise)\b/i;

function lastUserMessage(history: ChatInputMessage[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user") return history[i].content;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Outils que l'IA peut "appeler" pour proposer une action. Elle ne connaît
// jamais d'identifiants internes : elle raisonne sur des noms/titres lisibles
// (ex. "Devoir de maths"), et c'est le frontend qui retrouve l'élément
// correspondant dans les données de l'utilisateur au moment de la
// confirmation — jamais avant. Le Worker ne fait qu'transmettre la
// proposition telle quelle ; il n'exécute jamais rien lui-même.
// ---------------------------------------------------------------------------

const AI_TOOLS = [
  {
    name: "create_subject",
    description: "Proposer la création d'une nouvelle matière.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom de la matière, ex. Physique-Chimie" },
        icon: { type: "string", description: "Non utilisé pour l'instant (icône choisie manuellement par l'utilisateur)." },
      },
      required: ["name"],
    },
  },
  {
    name: "delete_subject",
    description: "Proposer la suppression d'une matière existante, désignée par son nom.",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "Nom de la matière à supprimer" } },
      required: ["name"],
    },
  },
  {
    name: "create_homework",
    description: "Proposer la création d'un nouveau devoir.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre du devoir" },
        subject: { type: "string", description: "Nom de la matière liée, optionnel" },
        dueDate: { type: "string", description: "Échéance au format YYYY-MM-DD, optionnel" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_homework_status",
    description: "Proposer de changer le statut d'un devoir existant (à faire / en cours / terminé).",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre du devoir à modifier" },
        status: { type: "string", enum: ["todo", "in_progress", "done"] },
      },
      required: ["title", "status"],
    },
  },
  {
    name: "delete_homework",
    description: "Proposer la suppression d'un devoir existant, désigné par son titre.",
    parameters: {
      type: "object",
      properties: { title: { type: "string", description: "Titre du devoir à supprimer" } },
      required: ["title"],
    },
  },
  {
    name: "create_goal",
    description: "Proposer la création d'un nouvel objectif.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre de l'objectif" },
        subject: { type: "string", description: "Nom de la matière liée, optionnel" },
        targetDate: { type: "string", description: "Échéance visée au format YYYY-MM-DD, optionnel" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_goal_progress",
    description: "Proposer de mettre à jour la progression d'un objectif existant, ou de le marquer comme terminé.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre de l'objectif à modifier" },
        progress: { type: "number", description: "Nouvelle progression de 0 à 100, optionnel" },
        done: { type: "boolean", description: "Marquer comme terminé, optionnel" },
      },
      required: ["title"],
    },
  },
  {
    name: "delete_goal",
    description: "Proposer la suppression d'un objectif existant, désigné par son titre.",
    parameters: {
      type: "object",
      properties: { title: { type: "string", description: "Titre de l'objectif à supprimer" } },
      required: ["title"],
    },
  },
  {
    name: "create_notion",
    description: "Proposer la création d'une nouvelle notion à suivre.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom de la notion, ex. Théorème de Pythagore" },
        subject: { type: "string", description: "Nom de la matière liée, optionnel" },
        chapter: { type: "string", description: "Chapitre, optionnel" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_notion_status",
    description:
      "Proposer de changer le statut d'une notion existante (non_etudiee, a_apprendre, en_cours, a_revoir, maitrisee).",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom de la notion à modifier" },
        status: { type: "string", enum: ["non_etudiee", "a_apprendre", "en_cours", "a_revoir", "maitrisee"] },
      },
      required: ["name", "status"],
    },
  },
  {
    name: "delete_notion",
    description: "Proposer la suppression d'une notion existante, désignée par son nom.",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "Nom de la notion à supprimer" } },
      required: ["name"],
    },
  },
  {
    name: "create_study_session",
    description: "Proposer d'enregistrer une session d'étude déjà réalisée (temps passé à réviser).",
    parameters: {
      type: "object",
      properties: {
        minutes: { type: "number", description: "Durée en minutes" },
        subject: { type: "string", description: "Nom de la matière concernée, optionnel" },
        date: { type: "string", description: "Date au format YYYY-MM-DD, optionnel (aujourd'hui par défaut)" },
      },
      required: ["minutes"],
    },
  },
];

// Déduit (entité, opération) à partir du nom d'outil, ex. "delete_homework" -> homework/delete.
function parseToolName(name: string): { entity: string; operation: string } | null {
  const m = name.match(/^(create|update|delete)_(.+)$/);
  if (!m) return null;
  const operation = m[1];
  const rest = m[2].replace(/_status$/, "").replace(/_progress$/, "");
  const entityMap: Record<string, string> = {
    subject: "subject",
    homework: "homework",
    goal: "goal",
    notion: "notion",
    study_session: "study_session",
  };
  const entity = entityMap[rest];
  if (!entity) return null;
  return { entity, operation };
}

interface ChatInputMessage {
  role: "user" | "assistant";
  content: string;
}

// POST /api/ai/chat → message de l'assistant IA (Benkyō IA)
//
//   Accessible sans compte (mode local/invité inclus) — nécessite seulement
//   le binding AI (Workers AI). 503 si absent · 405 si autre méthode que
//   POST.
//
//   Corps JSON : { messages: {role: "user"|"assistant", content: string}[],
//   context?: string }. `context` est un résumé compact des données de
//   l'utilisateur préparé côté client (jamais un export complet de la
//   base — voir buildAiContext() dans App.tsx), plafonné ici aussi à
//   AI_CONTEXT_MAX_LENGTH caractères par sécurité côté serveur.
//
//   Fait deux choses en un seul appel HTTP :
//     1. Génère une réponse texte normale (modèle AI_MODEL, prompt
//        AI_CHAT_SYSTEM_PROMPT).
//     2. Si le dernier message utilisateur contient un indice textuel
//        d'action (ACTION_INTENT_REGEX, filtre déterministe local — le
//        modèle n'est même pas sollicité sinon), tente en plus un appel
//        outil (AI_TOOLS, prompt AI_ACTION_SYSTEM_PROMPT) pour détecter une
//        instruction explicite de créer/modifier/supprimer un élément.
//
//   Réponse : 200 { reply: string, action?: { entity, operation, args } }.
//   `action`, si présent, n'est qu'une PROPOSITION : le Worker ne modifie
//   jamais les données lui-même, il ne fait que la transmettre. C'est le
//   frontend qui affiche une confirmation à l'utilisateur puis résout le
//   nom/titre fourni vers un id réel juste avant d'appeler /api/<ressource>
//   (voir confirmAiAction dans App.tsx) — jamais avant, et jamais côté
//   Worker.
async function handleAiChat(request: Request, env: Env): Promise<Response> {
  if (!env.AI) {
    return json(
      { error: "L'assistant IA n'est pas configuré sur ce déploiement (binding AI manquant)." },
      503
    );
  }
  if (request.method !== "POST") {
    return json({ error: "Méthode non supportée." }, 405);
  }

  const body = await request.json().catch(() => null) as { messages?: unknown; context?: unknown } | null;
  const rawMessages = Array.isArray(body?.messages) ? (body!.messages as unknown[]) : [];

  const history: ChatInputMessage[] = rawMessages
    .filter(
      (m): m is ChatInputMessage =>
        !!m &&
        typeof m === "object" &&
        ((m as any).role === "user" || (m as any).role === "assistant") &&
        typeof (m as any).content === "string"
    )
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  if (history.length === 0) {
    return json({ error: "Aucun message fourni." }, 400);
  }

  // Résumé compact de l'état de l'app (matières, échéances proches, objectifs
  // actifs...), préparé côté client par buildAiContext(). Jamais un export
  // complet de la base — juste de quoi personnaliser la réponse. Plafonné
  // ici par sécurité même si le client tronque déjà de son côté.
  const rawContext = typeof body?.context === "string" ? body.context : "";
  const context = rawContext.slice(0, AI_CONTEXT_MAX_LENGTH);
  const contextSuffix = context
    ? `\n\nContexte actuel de l'utilisateur (à utiliser pour personnaliser ta réponse si pertinent, ne pas le réciter tel quel) :\n${context}`
    : "";

  try {
    // --- Appel 1 : conversation normale, AUCUN outil disponible -------------
    // C'est cet appel qui garantit que l'IA continue toujours de raisonner
    // et de répondre en texte, exactement comme avant l'ajout des actions —
    // il ne sait même pas que des outils existent.
    const chatResult = (await env.AI.run(AI_MODEL, {
      messages: [{ role: "system", content: AI_CHAT_SYSTEM_PROMPT + contextSuffix }, ...history],
      max_tokens: 700,
    })) as { response?: string };

    const reply = chatResult?.response?.trim();
    if (!reply) {
      return json({ error: "Réponse vide de l'assistant IA." }, 502);
    }

    // --- Appel 2 : décision d'action, séparé et volontairement strict -------
    // Un appel dédié, avec un prompt exclusivement focalisé sur cette
    // décision (rien à voir avec la conversation), pour éviter que l'IA
    // propose des actions non demandées. Le texte de cet appel est ignoré :
    // seuls les appels d'outils éventuels nous intéressent ici.
    // On ne le déclenche même pas si le dernier message ne contient aucun
    // indice textuel d'une demande d'action (filtre déterministe) — ça
    // élimine les fausses propositions sur les messages neutres, sans
    // dépendre uniquement du bon respect du prompt par le modèle.
    let actions: { entity: string; operation: string; args: Record<string, unknown> }[] = [];
    if (ACTION_INTENT_REGEX.test(lastUserMessage(history))) {
      try {
        const actionResult = (await env.AI.run(AI_MODEL, {
          messages: [{ role: "system", content: AI_ACTION_SYSTEM_PROMPT + contextSuffix }, ...history],
          tools: AI_TOOLS,
          max_tokens: 300,
          temperature: 0.2,
        })) as { tool_calls?: { name: string; arguments: unknown }[] };

        const rawToolCalls = Array.isArray(actionResult?.tool_calls) ? actionResult.tool_calls : [];
        actions = rawToolCalls
          .map((call) => {
            if (!call || typeof call.name !== "string") return null;
            const parsed = parseToolName(call.name);
            if (!parsed) return null;
            let args: Record<string, unknown> = {};
            if (call.arguments && typeof call.arguments === "object") {
              args = call.arguments as Record<string, unknown>;
            } else if (typeof call.arguments === "string") {
              try {
                args = JSON.parse(call.arguments);
              } catch {
                args = {};
              }
            }
            return { entity: parsed.entity, operation: parsed.operation, args };
          })
          .filter((a): a is { entity: string; operation: string; args: Record<string, unknown> } => a !== null)
          .slice(0, 5);
      } catch {
        // Si l'appel de décision d'action échoue pour une raison quelconque,
        // on n'en fait pas une erreur bloquante : la conversation continue
        // normalement, simplement sans proposition d'action cette fois-ci.
        actions = [];
      }
    }

    return json({ reply, actions });
  } catch (err) {
    return json({ error: "Erreur de l'assistant IA.", detail: String(err) }, 500);
  }
}

// --- Point d'entrée : routage par préfixe de chemin -------------------------
//
//   /api/auth/*  → handleAuth   (authentification, aucune session requise)
//   /api/ai/*    → handleAiChat (assistant IA, aucune session requise)
//   /api/*       → handleApi    (données du compte, session requise)
//   tout le reste → fichiers statiques buildés par Vite (dist/), servis via
//                    le binding ASSETS
//
// Chaque branche capture ses propres erreurs non prévues (500 générique)
// pour qu'un bug dans un handler ne fasse jamais tomber tout le Worker.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/auth/")) {
      try {
        return await handleAuth(request, env, url);
      } catch (err) {
        return json({ error: "Erreur serveur.", detail: String(err) }, 500);
      }
    }

    if (url.pathname.startsWith("/api/ai/")) {
      try {
        return await handleAiChat(request, env);
      } catch (err) {
        return json({ error: "Erreur serveur.", detail: String(err) }, 500);
      }
    }

    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        return json({ error: "Erreur serveur.", detail: String(err) }, 500);
      }
    }

    // Tout le reste : fichiers statiques buildés par Vite (dist/).
    return env.ASSETS.fetch(request);
  },
};
