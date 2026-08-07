// ---------------------------------------------------------------------------
// Benkyo Flow — Worker Cloudflare
// ---------------------------------------------------------------------------
// Rôle en V1 :
//   1. Servir les fichiers statiques buildés (dist/) via le binding ASSETS.
//   2. Exposer une API REST minimale (/api/*) sauvegardant dans D1, prête
//      à être branchée au frontend pour une V2 avec synchronisation cloud.
//
// Important : si le binding D1 (env.DB) n'est pas configuré, les routes
// /api/* répondent simplement 503 au lieu de planter — l'app statique
// (qui fonctionne avec localStorage) continue de tourner normalement.
// ---------------------------------------------------------------------------

export interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.DB) {
    return json({ error: "D1 non configuré sur ce déploiement." }, 503);
  }

  const userId = url.searchParams.get("userId") || "anonymous";
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
    const body = await request.json<Record<string, unknown>>().catch(() => null);
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

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
