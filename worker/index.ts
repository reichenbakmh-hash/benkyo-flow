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
  const resource = parts[1]; // subjects | homework | goals | notions | study-sessions

  const tables: Record<string, string> = {
    subjects: "subjects",
    homework: "homework",
    goals: "goals",
    notions: "notions",
    "study-sessions": "study_sessions",
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
const AI_SYSTEM_PROMPT =
  "Tu es l'assistant intégré à Benkyō Flow, une application d'organisation scolaire pour lycéens et " +
  "étudiants francophones. Réponds toujours en français, de façon claire, concise et bienveillante. " +
  "Aide à organiser le travail, comprendre des notions scolaires, réviser efficacement et rester motivé. " +
  "Si la question sort du cadre scolaire, réponds quand même utilement mais reste bref. " +
  "Tu as accès à des outils pour proposer des actions concrètes (créer un devoir, un objectif, une " +
  "matière, une notion, ou enregistrer une session d'étude ; modifier ou supprimer un élément existant). " +
  "N'utilise un outil QUE si l'utilisateur demande explicitement une action concrète (« crée-moi un " +
  "devoir... », « marque cet objectif comme fait », « supprime la matière... »). Pour une simple question " +
  "ou demande de conseil, réponds uniquement en texte, sans appeler d'outil. Ces actions ne sont jamais " +
  "exécutées automatiquement : l'utilisateur doit toujours confirmer avant qu'elles prennent effet, donc " +
  "tu peux proposer une action dès que l'intention est raisonnablement claire.";
const AI_CONTEXT_MAX_LENGTH = 1500;

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
        icon: { type: "string", description: "Un emoji représentatif, optionnel" },
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

  const systemPrompt = context
    ? `${AI_SYSTEM_PROMPT}\n\nContexte actuel de l'utilisateur (à utiliser pour personnaliser ta réponse si pertinent, ne pas le réciter tel quel) :\n${context}`
    : AI_SYSTEM_PROMPT;

  try {
    const result = (await env.AI.run(AI_MODEL, {
      messages: [{ role: "system", content: systemPrompt }, ...history],
      tools: AI_TOOLS,
      max_tokens: 700,
    })) as { response?: string; tool_calls?: { name: string; arguments: unknown }[] };

    // Extraction défensive : si le format exact de la réponse diffère de ce
    // qui est attendu, on dégrade simplement vers un chat sans actions
    // plutôt que de faire planter la requête.
    const rawToolCalls = Array.isArray(result?.tool_calls) ? result.tool_calls : [];
    const actions = rawToolCalls
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

    const reply = result?.response?.trim() || (actions.length > 0 ? "Voici ce que je te propose :" : "");
    if (!reply) {
      return json({ error: "Réponse vide de l'assistant IA." }, 502);
    }
    return json({ reply, actions });
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
