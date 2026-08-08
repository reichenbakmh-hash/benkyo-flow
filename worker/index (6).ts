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
}

const SESSION_COOKIE = "bf_session";
const SESSION_DAYS = 30;

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

  return json({ error: "Route inconnue." }, 404);
}

// --- Routes de données (/api/subjects, /api/homework, /api/goals) ----------

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.DB) {
    return json({ error: "D1 non configuré sur ce déploiement." }, 503);
  }

  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return json({ error: "Non authentifié." }, 401);
  }

  const parts = url.pathname.split("/").filter(Boolean); // ["api", "subjects", ...]
  const resource = parts[1]; // subjects | homework | goals

  const tables: Record<string, string> = {
    subjects: "subjects",
    homework: "homework",
    goals: "goals",
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
          String(body.icon ?? "📘"),
          Number(body.createdAt ?? Date.now())
        )
        .run();
    } else if (table === "homework") {
      await env.DB.prepare(
        `INSERT INTO homework (id, user_id, subject_id, title, due_date, status, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET subject_id=excluded.subject_id, title=excluded.title,
           due_date=excluded.due_date, status=excluded.status, notes=excluded.notes`
      )
        .bind(
          body.id,
          userId,
          (body.subjectId as string) ?? null,
          String(body.title ?? ""),
          (body.dueDate as string) ?? null,
          String(body.status ?? "todo"),
          String(body.notes ?? ""),
          Number(body.createdAt ?? Date.now())
        )
        .run();
    } else if (table === "goals") {
      await env.DB.prepare(
        `INSERT INTO goals (id, user_id, subject_id, title, progress, done, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET subject_id=excluded.subject_id, title=excluded.title,
           progress=excluded.progress, done=excluded.done`
      )
        .bind(
          body.id,
          userId,
          (body.subjectId as string) ?? null,
          String(body.title ?? ""),
          Number(body.progress ?? 0),
          body.done ? 1 : 0,
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
// limités en longueur.

const AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const AI_SYSTEM_PROMPT =
  "Tu es l'assistant intégré à Benkyō Flow, une application d'organisation scolaire pour lycéens et " +
  "étudiants francophones. Réponds toujours en français, de façon claire, concise et bienveillante. " +
  "Aide à organiser le travail, comprendre des notions scolaires, réviser efficacement et rester motivé. " +
  "Si la question sort du cadre scolaire, réponds quand même utilement mais reste bref.";

interface ChatInputMessage {
  role: "user" | "assistant";
  content: string;
}

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

  const body = await request.json().catch(() => null) as { messages?: unknown } | null;
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

  try {
    const result = (await env.AI.run(AI_MODEL, {
      messages: [{ role: "system", content: AI_SYSTEM_PROMPT }, ...history],
      max_tokens: 700,
    })) as { response?: string };

    const reply = result?.response?.trim();
    if (!reply) {
      return json({ error: "Réponse vide de l'assistant IA." }, 502);
    }
    return json({ reply });
  } catch (err) {
    return json({ error: "Erreur de l'assistant IA.", detail: String(err) }, 500);
  }
}

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
