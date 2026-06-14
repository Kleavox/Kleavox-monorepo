import { INTERNAL_HOSTS, SESSION_COOKIE } from "@kleavox/config";

import { getSession, invalidateUserSessions } from "../lib/session";
import { apiError, checkVerification, safeAudit, type PassApp } from "./shared";

export function registerInternalRoutes(app: PassApp): void {
  app.get("/internal/session", async (context) => {
    if (new URL(context.req.url).hostname !== INTERNAL_HOSTS.PASS) {
      return context.body(null, 404);
    }

    const token = context.req.header("x-kleavox-session");
    if (!token)
      return context.json(
        { code: "UNAUTHORIZED", message: "Invalid or missing token." },
        401,
      );

    const session = await getSession(context.env, token);
    if (!session)
      return context.json(
        { code: "UNAUTHORIZED", message: "Invalid or missing token." },
        401,
      );
    return context.json(session);
  });

  app.post("/internal/logout", async (context) => {
    if (new URL(context.req.url).hostname !== INTERNAL_HOSTS.PASS) {
      return context.body(null, 404);
    }

    const token = context.req.header("x-kleavox-session");
    if (!token)
      return context.json(
        { code: "UNAUTHORIZED", message: "Invalid or missing token." },
        401,
      );

    const session = await getSession(context.env, token);
    if (!session)
      return context.json(
        { code: "UNAUTHORIZED", message: "Invalid or missing token." },
        401,
      );

    const row = await context.env.DB.prepare(
      `UPDATE users
     SET auth_version = auth_version + 1, updated_at = datetime('now')
     WHERE id = ?
     RETURNING auth_version`,
    )
      .bind(session.identity.id)
      .first<{ auth_version: number }>();

    if (row) {
      await invalidateUserSessions(
        context.env,
        session.identity.id,
        row.auth_version,
      );
    }

    await safeAudit(context.env, {
      userId: session.identity.id,
      type: "sessions_revoked",
      request: context.req.raw,
    });

    const root = context.env.ROOT_DOMAIN.toLowerCase();
    return context.json({
      ok: true,
      cookie: `${SESSION_COOKIE}=; Path=/; Domain=.${root}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    });
  });

  app.get("/internal/identity", async (context) => {
    if (new URL(context.req.url).hostname !== INTERNAL_HOSTS.PASS) {
      return context.body(null, 404);
    }

    const id = context.req.query("id");
    if (!id) {
      return context.json(
        { code: "INVALID_INPUT", message: "Missing id." },
        400,
      );
    }

    const user = await context.env.DB.prepare(
      `SELECT email, username FROM users WHERE id = ? AND disabled_at IS NULL`,
    )
      .bind(id)
      .first<{ email: string; username: string | null }>();
    if (!user) {
      return context.json({ code: "NOT_FOUND", message: "Unknown user." }, 404);
    }

    return context.json({ email: user.email, username: user.username });
  });

  app.get("/internal/admins", async (context) => {
    if (new URL(context.req.url).hostname !== INTERNAL_HOSTS.PASS) {
      return context.body(null, 404);
    }

    const admins = await context.env.DB.prepare(
      `SELECT email FROM users
     WHERE role = 'ADMIN'
       AND disabled_at IS NULL
       AND email_verified_at IS NOT NULL`,
    ).all<{ email: string }>();

    return context.json({ emails: admins.results.map((row) => row.email) });
  });

  app.get("/internal/challenge", async (context) => {
    if (new URL(context.req.url).hostname !== INTERNAL_HOSTS.PASS) {
      return context.body(null, 404);
    }

    const scope = context.req.query("scope");
    if (scope !== "basic" && scope !== "fresh") {
      return apiError(context, 400, "invalid_input", "Invalid scope.");
    }

    const token = context.req.header("x-kleavox-verification") ?? null;
    const verified = await checkVerification(context.env, token, scope);
    if (!verified)
      return context.json(
        { code: "UNAUTHORIZED", message: "Invalid or missing token." },
        401,
      );

    return context.json({ ok: true });
  });
}
