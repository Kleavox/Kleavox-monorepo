import { INTERNAL_HOSTS, INTERNAL_URLS, SESSION_COOKIE } from "@kleavox/config";
import {
  notifyReport,
  readCookie,
  verifyChallenge,
  verifySession,
} from "@kleavox/auth";
import type { SessionIdentity } from "@kleavox/core";
import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";
import { z } from "zod";

import type { Env } from "./env";
import { linkUnavailablePage, protectedLinkPage } from "./lib/page";
import { hashLinkPassword, verifyLinkPassword } from "./lib/password";
import { clientContext, parseExpiration, parseTargetUrl } from "./lib/request";
import { generateSlug, isValidSlug, normalizeSlug } from "./lib/slug";
import { app as dropApp, purgeDropUser } from "./drop/app";

interface Variables {
  session: SessionIdentity;
}

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

interface LinkRow {
  id: string;
  user_id: string | null;
  slug: string;
  target_url: string;
  password_hash: string | null;
  expires_at: string | null;
  disabled_at: string | null;
  click_count: number;
  last_clicked_at: string | null;
  created_at: string;
  updated_at: string;
}

const createSchema = z.object({
  targetUrl: z.string().min(1).max(2048),
  slug: z.string().max(50).optional(),
  password: z.string().min(8).max(128).optional(),
  expiresAt: z.string().optional(),
});

const reportUpdateSchema = z.object({
  status: z.enum(["OPEN", "RESOLVED", "REJECTED"]),
});

const updateSchema = z.object({
  targetUrl: z.string().min(1).max(2048).optional(),
  password: z.string().min(8).max(128).nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  disabled: z.boolean().optional(),
});

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", async (context, next) => {
  await next();
  context.header("Referrer-Policy", "strict-origin-when-cross-origin");
  context.header("X-Content-Type-Options", "nosniff");
  context.header("X-Frame-Options", "DENY");
  context.header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  const contentType = context.res.headers.get("content-type") ?? "";
  if (
    contentType.includes("text/html") &&
    !context.res.headers.has("content-security-policy")
  ) {
    context.header(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    );
  }
});

app.onError((error, context) => {
  console.error("[link]", error);
  if (context.req.path.startsWith("/api")) {
    return context.json(
      {
        code: "INTERNAL_ERROR",
        message: "Link could not complete the request.",
      },
      500,
    );
  }
  return context.html(
    linkUnavailablePage(
      "500",
      "Something broke",
      "Something went wrong on our side. Give it a moment and try again.",
    ),
    500,
  );
});

app.get("/health", (context) =>
  context.json({ service: "link", status: "ok" }),
);

app.get("/files", (context) => context.redirect("/", 308));

app.route("/", dropApp);

app.on(["GET", "HEAD", "POST"], "/internal/resolve/:slug", async (context) => {
  const url = new URL(context.req.url);
  if (url.hostname !== INTERNAL_HOSTS.LINK) {
    return context.body(null, 404);
  }

  const traceId = context.req.header("x-kleavox-trace-id");
  if (!traceId && context.env.ENVIRONMENT === "production") {
    return context.body(null, 404);
  }

  const slug = normalizeSlug(context.req.param("slug"));
  const link = await findLink(context.env.DB, slug);
  if (!link || link.disabled_at) return context.body(null, 404);

  if (link.expires_at && Date.parse(link.expires_at) <= Date.now()) {
    return context.html(
      linkUnavailablePage(
        "410",
        "Link expired",
        "This destination is no longer available.",
      ),
      410,
    );
  }

  if (link.password_hash) {
    if (context.req.method !== "POST") {
      return context.html(protectedLinkPage(slug), 200, {
        "Content-Security-Policy":
          "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      });
    }

    const body: { password?: string } = await context.req
      .json<{ password?: string }>()
      .catch(() => ({}) as { password?: string });
    if (
      !body.password ||
      !(await verifyLinkPassword(body.password, link.password_hash))
    ) {
      return context.json(
        { code: "INVALID_PASSWORD", message: "The password is incorrect." },
        401,
      );
    }
  } else if (context.req.method === "POST") {
    return context.body(null, 405);
  }

  if (context.req.method !== "HEAD") {
    context.executionCtx.waitUntil(recordClick(context, link.id));
  }
  return context.redirect(link.target_url, 302);
});

app.post("/internal/purge-user", async (context) => {
  if (new URL(context.req.url).hostname !== INTERNAL_HOSTS.LINK) {
    return context.body(null, 404);
  }

  const userId = context.req.query("id");
  if (!userId) {
    return context.json({ code: "INVALID_INPUT", message: "Missing id." }, 400);
  }

  await context.env.DB.prepare(`DELETE FROM links WHERE user_id = ?`)
    .bind(userId)
    .run();
  await purgeDropUser(context.env, userId);
  return context.json({ ok: true });
});

const requireSession: MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> = async (context, next) => {
  const session = await verifySession(context.req.raw, context.env.PASS);
  if (!session) {
    return context.json(
      { code: "UNAUTHORIZED", message: "Sign in with Kleavox Pass." },
      401,
    );
  }
  context.set("session", session);
  await next();
};

const requireAdmin: MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> = async (context, next) => {
  const session = await verifySession(context.req.raw, context.env.PASS);
  if (!session) {
    return context.json(
      { code: "UNAUTHORIZED", message: "Sign in with Kleavox Pass." },
      401,
    );
  }
  if (session.identity.role !== "ADMIN") {
    return context.json({ code: "FORBIDDEN", message: "Admin only." }, 403);
  }
  context.set("session", session);
  await next();
};

app.get("/api/session", async (context) => {
  const session = await verifySession(context.req.raw, context.env.PASS);
  return session
    ? context.json({ authenticated: true, identity: session.identity })
    : context.json({ authenticated: false });
});

app.post("/api/logout", async (context) => {
  const token = readCookie(context.req.raw, SESSION_COOKIE);
  if (token) {
    const result = await context.env.PASS.fetch(INTERNAL_URLS.SESSION_LOGOUT, {
      method: "POST",
      headers: { "x-kleavox-session": token },
    });
    if (result.ok) {
      const body = await result.json<{ cookie?: string }>();
      if (body.cookie) context.header("Set-Cookie", body.cookie);
    }
  }
  return context.json({ ok: true });
});

app.post("/api/public-links", async (context) => {
  const rateKey =
    context.req.header("cf-connecting-ip") ??
    context.req.header("user-agent") ??
    "anonymous";
  if (
    !(await context.env.PUBLIC_CREATE_RATE_LIMIT.limit({ key: rateKey }))
      .success
  ) {
    return context.json(
      { code: "RATE_LIMITED", message: "Try again in a minute." },
      429,
    );
  }

  if (
    !(await verifySession(context.req.raw, context.env.PASS)) &&
    !(await verifyChallenge(context.req.raw, context.env.PASS, "basic"))
  ) {
    return context.json(
      { code: "CHALLENGE_FAILED", message: "Security challenge failed." },
      403,
    );
  }

  const parsed = z
    .object({ targetUrl: z.string().min(1).max(2048) })
    .safeParse(await readJson(context));
  if (!parsed.success) return invalidBody(context);
  const targetUrl = parseTargetUrl(parsed.data.targetUrl);
  if (!targetUrl) {
    return context.json(
      { code: "INVALID_URL", message: "Use a valid HTTP or HTTPS URL." },
      400,
    );
  }

  const slug = await uniqueSlug(context.env.DB);
  await context.env.DB.prepare(
    `INSERT INTO links (id, user_id, slug, target_url)
     VALUES (?, NULL, ?, ?)`,
  )
    .bind(crypto.randomUUID(), slug, targetUrl)
    .run();
  return context.json(
    {
      slug,
      shortUrl: `${context.env.PUBLIC_SHORT_ORIGIN}/${slug}`,
      targetUrl,
    },
    201,
  );
});

app.get("/api/links", requireSession, async (context) => {
  const userId = context.get("session").identity.id;
  const page = Math.max(1, Number.parseInt(context.req.query("page") ?? "1"));
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(context.req.query("limit") ?? "20")),
  );
  const offset = (page - 1) * limit;

  const [links, count] = await Promise.all([
    context.env.DB.prepare(
      `SELECT id, user_id, slug, target_url, password_hash, expires_at,
              disabled_at, click_count, last_clicked_at, created_at, updated_at
       FROM links WHERE user_id = ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(userId, limit, offset)
      .all<LinkRow>(),
    context.env.DB.prepare(
      "SELECT COUNT(*) AS total FROM links WHERE user_id = ?",
    )
      .bind(userId)
      .first<{ total: number }>(),
  ]);

  const total = count?.total ?? 0;
  return context.json({
    data: links.results.map((link) =>
      publicLink(link, context.env.PUBLIC_SHORT_ORIGIN),
    ),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

app.post("/api/links", requireSession, async (context) => {
  const parsed = createSchema.safeParse(await readJson(context));
  if (!parsed.success) return invalidBody(context);

  const targetUrl = parseTargetUrl(parsed.data.targetUrl);
  if (!targetUrl) {
    return context.json(
      { code: "INVALID_URL", message: "Use a valid HTTP or HTTPS URL." },
      400,
    );
  }

  const expiresAt = parsed.data.expiresAt
    ? parseExpiration(parsed.data.expiresAt)
    : null;
  if (parsed.data.expiresAt && !expiresAt) {
    return context.json(
      { code: "INVALID_EXPIRY", message: "Expiry must be in the future." },
      400,
    );
  }

  const requestedSlug = parsed.data.slug
    ? normalizeSlug(parsed.data.slug)
    : null;
  if (requestedSlug && !isValidSlug(requestedSlug)) {
    return context.json(
      {
        code: "INVALID_SLUG",
        message: "Use 2-50 lowercase letters, numbers, or hyphens.",
      },
      400,
    );
  }

  const slug = requestedSlug ?? (await uniqueSlug(context.env.DB));
  const passwordHash = parsed.data.password
    ? await hashLinkPassword(parsed.data.password)
    : null;
  const id = crypto.randomUUID();

  try {
    await context.env.DB.prepare(
      `INSERT INTO links
       (id, user_id, slug, target_url, password_hash, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        context.get("session").identity.id,
        slug,
        targetUrl,
        passwordHash,
        expiresAt,
      )
      .run();
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      return context.json(
        { code: "SLUG_TAKEN", message: "That slug is already in use." },
        409,
      );
    }
    throw error;
  }

  return context.json(
    {
      id,
      slug,
      shortUrl: `${context.env.PUBLIC_SHORT_ORIGIN}/${slug}`,
      targetUrl,
      expiresAt,
      protected: Boolean(passwordHash),
    },
    201,
  );
});

app.patch("/api/links/:slug", requireSession, async (context) => {
  const parsed = updateSchema.safeParse(await readJson(context));
  if (!parsed.success) return invalidBody(context);

  const link = await ownedLink(context);
  if (!link) return context.json({ code: "NOT_FOUND" }, 404);

  const updates: string[] = [];
  const values: unknown[] = [];

  if (parsed.data.targetUrl !== undefined) {
    const targetUrl = parseTargetUrl(parsed.data.targetUrl);
    if (!targetUrl) {
      return context.json(
        { code: "INVALID_URL", message: "Use a valid HTTP or HTTPS URL." },
        400,
      );
    }
    updates.push("target_url = ?");
    values.push(targetUrl);
  }

  if (parsed.data.password !== undefined) {
    updates.push("password_hash = ?");
    values.push(
      parsed.data.password
        ? await hashLinkPassword(parsed.data.password)
        : null,
    );
  }

  if (parsed.data.expiresAt !== undefined) {
    const expiresAt = parsed.data.expiresAt
      ? parseExpiration(parsed.data.expiresAt)
      : null;
    if (parsed.data.expiresAt && !expiresAt) {
      return context.json(
        { code: "INVALID_EXPIRY", message: "Expiry must be in the future." },
        400,
      );
    }
    updates.push("expires_at = ?");
    values.push(expiresAt);
  }

  if (parsed.data.disabled !== undefined) {
    updates.push("disabled_at = ?");
    values.push(parsed.data.disabled ? new Date().toISOString() : null);
  }

  if (updates.length === 0) return context.json({ ok: true });
  updates.push("updated_at = datetime('now')");
  values.push(link.id);
  await context.env.DB.prepare(
    `UPDATE links SET ${updates.join(", ")} WHERE id = ?`,
  )
    .bind(...values)
    .run();
  return context.json({ ok: true });
});

app.delete("/api/links/:slug", requireSession, async (context) => {
  const link = await ownedLink(context);
  if (!link) return context.json({ code: "NOT_FOUND" }, 404);
  await context.env.DB.prepare("DELETE FROM links WHERE id = ?")
    .bind(link.id)
    .run();
  return context.body(null, 204);
});

app.get("/api/links/:slug/stats", requireSession, async (context) => {
  const link = await ownedLink(context);
  if (!link) return context.json({ code: "NOT_FOUND" }, 404);

  const since = new Date(Date.now() - 6 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const [daily, browsers, countries, referrers] = await Promise.all([
    context.env.DB.prepare(
      `SELECT substr(clicked_at, 1, 10) AS name, COUNT(*) AS value
       FROM clicks WHERE link_id = ? AND clicked_at >= ?
       GROUP BY name ORDER BY name`,
    )
      .bind(link.id, since)
      .all<{ name: string; value: number }>(),
    topDimension(context.env.DB, link.id, "browser"),
    topDimension(context.env.DB, link.id, "country"),
    topDimension(context.env.DB, link.id, "referrer_host"),
  ]);

  return context.json({
    total: link.click_count,
    lastClickedAt: link.last_clicked_at,
    daily: fillDays(daily.results),
    browsers: browsers.results,
    countries: countries.results,
    referrers: referrers.results,
  });
});

app.post("/api/reports", async (context) => {
  const rateKey =
    context.req.header("cf-connecting-ip") ??
    context.req.header("user-agent") ??
    "anonymous";
  if (
    !(await context.env.REPORT_RATE_LIMIT.limit({ key: `report:${rateKey}` }))
      .success
  ) {
    return context.json(
      { code: "RATE_LIMITED", message: "Try again in a minute." },
      429,
    );
  }

  if (
    !(await verifySession(context.req.raw, context.env.PASS)) &&
    !(await verifyChallenge(context.req.raw, context.env.PASS, "basic"))
  ) {
    return context.json(
      { code: "CHALLENGE_FAILED", message: "Security challenge failed." },
      403,
    );
  }

  const body = z
    .object({
      slug: z.string().min(2).max(50),
      reason: z.enum(["MALWARE", "PHISHING", "SPAM", "ILLEGAL", "OTHER"]),
      details: z.string().max(1000).optional(),
    })
    .safeParse(await readJson(context));
  if (!body.success) return invalidBody(context);

  const link = await findLink(context.env.DB, normalizeSlug(body.data.slug));
  await context.env.DB.prepare(
    `INSERT INTO reports (id, link_id, reason, details)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      link?.id ?? null,
      body.data.reason,
      body.data.details ?? null,
    )
    .run();
  context.executionCtx.waitUntil(
    notifyReport(context.env.PULSE, {
      kind: "link",
      reason: body.data.reason,
      target: link ? `/${link.slug}` : body.data.slug,
    }),
  );
  return context.json({ ok: true }, 202);
});

app.get("/api/admin/reports", requireAdmin, async (context) => {
  const reports = await context.env.DB.prepare(
    `SELECT r.id, r.link_id, r.reason, r.details, r.status, r.created_at,
            r.resolved_at, l.slug, l.target_url, l.disabled_at
     FROM reports r
     LEFT JOIN links l ON l.id = r.link_id
     ORDER BY CASE r.status WHEN 'OPEN' THEN 0 ELSE 1 END, r.created_at DESC
     LIMIT 200`,
  ).all();
  return context.json({ reports: reports.results });
});

app.patch("/api/admin/reports/:id", requireAdmin, async (context) => {
  const body = reportUpdateSchema.safeParse(await readJson(context));
  if (!body.success) return invalidBody(context);
  const updated = await context.env.DB.prepare(
    `UPDATE reports
     SET status = ?,
         resolved_at = CASE WHEN ? = 'OPEN' THEN NULL ELSE datetime('now') END
     WHERE id = ?`,
  )
    .bind(body.data.status, body.data.status, context.req.param("id"))
    .run();
  if ((updated.meta.changes ?? 0) !== 1) {
    return context.json({ code: "NOT_FOUND", message: "Unknown report." }, 404);
  }
  return context.json({ updated: true });
});

app.all("*", (context) => context.env.ASSETS.fetch(context.req.raw));

async function readJson(context: AppContext): Promise<unknown> {
  return context.req.json().catch(() => null);
}

function invalidBody(context: AppContext) {
  return context.json(
    { code: "INVALID_REQUEST", message: "Check the submitted fields." },
    400,
  );
}

async function findLink(db: D1Database, slug: string): Promise<LinkRow | null> {
  return db
    .prepare(
      `SELECT id, user_id, slug, target_url, password_hash, expires_at,
              disabled_at, click_count, last_clicked_at, created_at, updated_at
       FROM links WHERE slug = ? LIMIT 1`,
    )
    .bind(slug)
    .first<LinkRow>();
}

async function ownedLink(context: AppContext): Promise<LinkRow | null> {
  const slug = normalizeSlug(context.req.param("slug") ?? "");
  const identity = context.get("session").identity;
  const link = await findLink(context.env.DB, slug);
  if (!link) return null;
  return identity.role === "ADMIN" || link.user_id === identity.id
    ? link
    : null;
}

async function uniqueSlug(db: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generateSlug();
    if (!(await findLink(db, candidate))) return candidate;
  }
  throw new Error("Unable to allocate a unique slug.");
}

async function recordClick(context: AppContext, linkId: string): Promise<void> {
  const data = clientContext(context.req.raw);
  try {
    await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO clicks
         (id, link_id, country, browser, operating_system, device_type, referrer_host)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        linkId,
        data.country,
        data.browser,
        data.operatingSystem,
        data.deviceType,
        data.referrerHost,
      ),
      context.env.DB.prepare(
        `UPDATE links
         SET click_count = click_count + 1,
             last_clicked_at = datetime('now')
         WHERE id = ?`,
      ).bind(linkId),
    ]);
  } catch (error) {
    console.error("Unable to record Link analytics.", error);
  }
}

function publicLink(link: LinkRow, publicOrigin: string) {
  return {
    id: link.id,
    slug: link.slug,
    targetUrl: link.target_url,
    shortUrl: `${publicOrigin}/${link.slug}`,
    protected: Boolean(link.password_hash),
    expiresAt: link.expires_at,
    disabledAt: link.disabled_at,
    clickCount: link.click_count,
    lastClickedAt: link.last_clicked_at,
    createdAt: link.created_at,
    updatedAt: link.updated_at,
  };
}

function topDimension(
  db: D1Database,
  linkId: string,
  column: "browser" | "country" | "referrer_host",
) {
  return db
    .prepare(
      `SELECT COALESCE(${column}, 'Unknown') AS name, COUNT(*) AS value
       FROM clicks WHERE link_id = ?
       GROUP BY ${column} ORDER BY value DESC LIMIT 5`,
    )
    .bind(linkId)
    .all<{ name: string; value: number }>();
}

function fillDays(rows: Array<{ name: string; value: number }>) {
  const counts = new Map(rows.map((row) => [row.name, row.value]));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return { date, value: counts.get(date) ?? 0 };
  });
}

export { app };
