import { INTERNAL_HOSTS, INTERNAL_URLS } from "@kleavox/config";
import { verifySession } from "@kleavox/auth";
import type { SessionIdentity } from "@kleavox/core";
import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";
import { z } from "zod";

import type { Env } from "./env";
import {
  nextFailureCount,
  shouldOpenIncident,
  shouldResolveIncident,
  validateCheckTarget,
  type CheckKind,
  type CheckStatus,
} from "./lib/checks";
import { randomToken, readBearerToken, sha256 } from "./lib/crypto";
import { sendIncidentEmail, sendReportEmail } from "./lib/mail";
import { heartbeatSchema, hostSchema, resultSchema } from "./schemas";

interface Variables {
  session: SessionIdentity;
}

type PulseContext = Context<{ Bindings: Env; Variables: Variables }>;

interface AgentNode {
  id: string;
  interval_seconds: number;
}

interface CheckRow {
  id: string;
  node_id: string | null;
  name: string;
  kind: CheckKind;
  target: string;
  enabled: number;
  status: string;
  timeout_seconds: number;
  latency_ms: number | null;
  last_checked_at: string | null;
  consecutive_failures: number;
  last_message: string | null;
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.onError((error, context) => {
  console.error("[pulse]", error);
  return context.json(
    {
      code: "INTERNAL_ERROR",
      message: "Pulse could not complete the request.",
    },
    500,
  );
});

app.use("*", async (context, next) => {
  await next();
  context.header("Referrer-Policy", "same-origin");
  context.header("X-Content-Type-Options", "nosniff");
  context.header("X-Frame-Options", "DENY");
  context.header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
});

app.get("/health", (context) =>
  context.json({ service: "pulse", status: "ok" }),
);

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
    return context.json(
      { code: "FORBIDDEN", message: "Pulse is restricted to the operator." },
      403,
    );
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

app.post("/internal/report-notify", async (context) => {
  if (new URL(context.req.url).hostname !== INTERNAL_HOSTS.PULSE) {
    return context.body(null, 404);
  }

  const body = z
    .object({
      kind: z.enum(["link", "file"]),
      reason: z.string().max(100),
      target: z.string().max(2048),
    })
    .safeParse(await readJson(context));
  if (!body.success) return invalidRequest(context);

  try {
    const response = await context.env.PASS.fetch(INTERNAL_URLS.ADMINS_LOOKUP);
    if (response.ok) {
      const { emails } = await response.json<{ emails: string[] }>();
      await sendReportEmail(context.env, {
        to: emails,
        kind: body.data.kind,
        reason: body.data.reason,
        target: body.data.target,
      });
    }
  } catch (error) {
    console.error("[pulse report-notify]", error);
  }
  return context.json({ ok: true });
});

app.all("/api/admin/link/*", requireAdmin, (context) =>
  proxyAdmin(
    context,
    context.env.LINK,
    INTERNAL_HOSTS.LINK,
    context.req.path.replace(/^\/api\/admin\/link/u, "/api"),
  ),
);

app.all("/api/admin/drop/*", requireAdmin, (context) =>
  proxyAdmin(
    context,
    context.env.DROP,
    INTERNAL_HOSTS.DROP,
    context.req.path.replace(/^\/api\/admin\/drop/u, "/api"),
  ),
);

function proxyAdmin(
  context: PulseContext,
  binding: Fetcher,
  hostname: string,
  pathname: string,
) {
  const destination = new URL(context.req.url);
  destination.hostname = hostname;
  destination.pathname = pathname;
  return binding.fetch(new Request(destination, context.req.raw));
}

app.get("/api/overview", requireAdmin, async (context) => {
  const ownerId = context.get("session").identity.id;
  const [nodes, checks, incidents, projects, notes] = await Promise.all([
    context.env.DB.prepare(
      `SELECT id, name, hostname, architecture, operating_system, agent_version,
              last_seen_at, enrolled_at, disabled_at, interval_seconds,
              cpu_percent, memory_used_bytes, memory_total_bytes,
              disk_used_bytes, disk_total_bytes, load_1, uptime_seconds,
              created_at
       FROM nodes WHERE owner_user_id = ? ORDER BY created_at DESC`,
    )
      .bind(ownerId)
      .all(),
    context.env.DB.prepare(
      `SELECT c.id, c.node_id, c.name, c.kind, c.target, c.enabled,
              c.status, c.timeout_seconds, c.latency_ms, c.last_checked_at,
              c.consecutive_failures, c.last_message
       FROM checks c
       JOIN nodes n ON n.id = c.node_id
       WHERE n.owner_user_id = ?
       ORDER BY c.created_at DESC`,
    )
      .bind(ownerId)
      .all(),
    context.env.DB.prepare(
      `SELECT i.id, i.check_id, i.status, i.started_at, i.resolved_at,
              i.summary, c.name AS check_name, n.name AS node_name
       FROM incidents i
       JOIN checks c ON c.id = i.check_id
       JOIN nodes n ON n.id = c.node_id
       WHERE n.owner_user_id = ?
       ORDER BY i.started_at DESC LIMIT 50`,
    )
      .bind(ownerId)
      .all(),
    context.env.DB.prepare(
      `SELECT id, name, description, status, url, created_at, updated_at
       FROM projects WHERE owner_user_id = ?
       ORDER BY updated_at DESC`,
    )
      .bind(ownerId)
      .all(),
    context.env.DB.prepare(
      `SELECT id, project_id, content, pinned, created_at, updated_at
       FROM notes WHERE owner_user_id = ?
       ORDER BY pinned DESC, updated_at DESC LIMIT 100`,
    )
      .bind(ownerId)
      .all(),
  ]);

  return context.json({
    nodes: nodes.results,
    checks: checks.results,
    incidents: incidents.results,
    projects: projects.results,
    notes: notes.results,
  });
});

app.post("/api/nodes", requireAdmin, async (context) => {
  const body = z
    .object({
      name: z.string().trim().min(1).max(100),
      intervalSeconds: z.number().int().min(15).max(3600).default(60),
    })
    .safeParse(await readJson(context));
  if (!body.success) return invalidRequest(context);

  const nodeId = crypto.randomUUID();
  const enrollmentToken = randomToken();
  const enrollmentHash = await sha256(enrollmentToken);
  const enrollmentExpiresAt = new Date(Date.now() + 30 * 60_000).toISOString();

  await context.env.DB.prepare(
    `INSERT INTO nodes (
       id, owner_user_id, name, agent_token_hash, enrollment_token_hash,
       enrollment_expires_at, interval_seconds
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      nodeId,
      context.get("session").identity.id,
      body.data.name,
      `pending:${crypto.randomUUID()}`,
      enrollmentHash,
      enrollmentExpiresAt,
      body.data.intervalSeconds,
    )
    .run();

  return context.json(
    {
      id: nodeId,
      enrollmentToken,
      enrollmentExpiresAt,
      command: `sudo kleavox-agent enroll --endpoint ${context.env.PUBLIC_ORIGIN} --token ${enrollmentToken}`,
    },
    201,
  );
});

app.post("/api/nodes/:id/enrollment", requireAdmin, async (context) => {
  const node = await ownedNode(context);
  if (!node) return context.json({ code: "NOT_FOUND" }, 404);

  const enrollmentToken = randomToken();
  const enrollmentExpiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
  await context.env.DB.prepare(
    `UPDATE nodes
     SET enrollment_token_hash = ?, enrollment_expires_at = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(
      await sha256(enrollmentToken),
      enrollmentExpiresAt,
      context.req.param("id"),
    )
    .run();
  return context.json({
    enrollmentToken,
    enrollmentExpiresAt,
    command: `sudo kleavox-agent enroll --endpoint ${context.env.PUBLIC_ORIGIN} --token ${enrollmentToken}`,
  });
});

app.delete("/api/nodes/:id", requireAdmin, async (context) => {
  const node = await ownedNode(context);
  if (!node) return context.json({ code: "NOT_FOUND" }, 404);
  await context.env.DB.prepare("DELETE FROM nodes WHERE id = ?")
    .bind(context.req.param("id"))
    .run();
  return context.body(null, 204);
});

app.get("/api/nodes/:id/metrics", requireAdmin, async (context) => {
  const node = await ownedNode(context);
  if (!node) return context.json({ code: "NOT_FOUND" }, 404);
  const hours = Math.min(
    168,
    Math.max(1, Number.parseInt(context.req.query("hours") ?? "24")),
  );
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const metrics = await context.env.DB.prepare(
    `SELECT cpu_percent, memory_used_bytes, memory_total_bytes,
            disk_used_bytes, disk_total_bytes, load_1, load_5, load_15,
            uptime_seconds, recorded_at
     FROM node_metrics
     WHERE node_id = ? AND datetime(recorded_at) >= datetime(?)
     ORDER BY recorded_at`,
  )
    .bind(context.req.param("id"), since)
    .all();
  return context.json({ data: metrics.results });
});

app.post("/api/checks", requireAdmin, async (context) => {
  const body = z
    .object({
      nodeId: z.string().uuid(),
      name: z.string().trim().min(1).max(100),
      kind: z.enum(["HTTP", "TCP", "SERVICE"]),
      target: z.string().trim().min(1).max(2048),
      timeoutSeconds: z.number().int().min(1).max(30).default(10),
    })
    .safeParse(await readJson(context));
  if (!body.success) return invalidRequest(context);

  const node = await findOwnedNode(
    context.env.DB,
    body.data.nodeId,
    context.get("session").identity.id,
  );
  if (!node) return context.json({ code: "NOT_FOUND" }, 404);

  const target = validateCheckTarget(body.data.kind, body.data.target);
  if (!target) {
    return context.json(
      { code: "INVALID_TARGET", message: "The check target is invalid." },
      400,
    );
  }

  const id = crypto.randomUUID();
  await context.env.DB.prepare(
    `INSERT INTO checks
     (id, node_id, name, kind, target, timeout_seconds)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      body.data.nodeId,
      body.data.name,
      body.data.kind,
      target,
      body.data.timeoutSeconds,
    )
    .run();
  return context.json({ id }, 201);
});

app.patch("/api/checks/:id", requireAdmin, async (context) => {
  const check = await ownedCheck(context);
  if (!check) return context.json({ code: "NOT_FOUND" }, 404);
  const body = z
    .object({
      enabled: z.boolean().optional(),
      name: z.string().trim().min(1).max(100).optional(),
      timeoutSeconds: z.number().int().min(1).max(30).optional(),
    })
    .safeParse(await readJson(context));
  if (!body.success) return invalidRequest(context);

  const updates: string[] = [];
  const values: unknown[] = [];
  if (body.data.enabled !== undefined) {
    updates.push("enabled = ?");
    values.push(body.data.enabled ? 1 : 0);
  }
  if (body.data.name !== undefined) {
    updates.push("name = ?");
    values.push(body.data.name);
  }
  if (body.data.timeoutSeconds !== undefined) {
    updates.push("timeout_seconds = ?");
    values.push(body.data.timeoutSeconds);
  }
  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    values.push(check.id);
    await context.env.DB.prepare(
      `UPDATE checks SET ${updates.join(", ")} WHERE id = ?`,
    )
      .bind(...values)
      .run();
  }
  return context.json({ ok: true });
});

app.delete("/api/checks/:id", requireAdmin, async (context) => {
  const check = await ownedCheck(context);
  if (!check) return context.json({ code: "NOT_FOUND" }, 404);
  await context.env.DB.prepare("DELETE FROM checks WHERE id = ?")
    .bind(check.id)
    .run();
  return context.body(null, 204);
});

app.post("/api/projects", requireAdmin, async (context) => {
  const body = z
    .object({
      name: z.string().trim().min(1).max(100),
      description: z.string().max(1000).optional(),
      url: z.string().url().optional(),
    })
    .safeParse(await readJson(context));
  if (!body.success) return invalidRequest(context);
  const id = crypto.randomUUID();
  await context.env.DB.prepare(
    `INSERT INTO projects (id, owner_user_id, name, description, url)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      context.get("session").identity.id,
      body.data.name,
      body.data.description ?? null,
      body.data.url ?? null,
    )
    .run();
  return context.json({ id }, 201);
});

app.patch("/api/projects/:id", requireAdmin, async (context) => {
  const project = await ownedProject(context);
  if (!project) return context.json({ code: "NOT_FOUND" }, 404);
  const body = z
    .object({
      name: z.string().trim().min(1).max(100).optional(),
      description: z.string().max(1000).nullable().optional(),
      status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
      url: z.string().url().nullable().optional(),
    })
    .safeParse(await readJson(context));
  if (!body.success) return invalidRequest(context);

  const updates: string[] = [];
  const values: unknown[] = [];
  for (const [field, value] of Object.entries(body.data)) {
    const column =
      field === "description"
        ? "description"
        : field === "status"
          ? "status"
          : field === "url"
            ? "url"
            : "name";
    updates.push(`${column} = ?`);
    values.push(value);
  }
  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    values.push(project.id);
    await context.env.DB.prepare(
      `UPDATE projects SET ${updates.join(", ")} WHERE id = ?`,
    )
      .bind(...values)
      .run();
  }
  return context.json({ ok: true });
});

app.delete("/api/projects/:id", requireAdmin, async (context) => {
  const project = await ownedProject(context);
  if (!project) return context.json({ code: "NOT_FOUND" }, 404);
  await context.env.DB.prepare("DELETE FROM projects WHERE id = ?")
    .bind(project.id)
    .run();
  return context.body(null, 204);
});

app.post("/api/notes", requireAdmin, async (context) => {
  const body = z
    .object({
      projectId: z.string().uuid().nullable().optional(),
      content: z.string().trim().min(1).max(4000),
      pinned: z.boolean().default(false),
    })
    .safeParse(await readJson(context));
  if (!body.success) return invalidRequest(context);

  if (body.data.projectId) {
    const project = await context.env.DB.prepare(
      "SELECT id FROM projects WHERE id = ? AND owner_user_id = ?",
    )
      .bind(body.data.projectId, context.get("session").identity.id)
      .first();
    if (!project) return context.json({ code: "NOT_FOUND" }, 404);
  }

  const id = crypto.randomUUID();
  await context.env.DB.prepare(
    `INSERT INTO notes (id, owner_user_id, project_id, content, pinned)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      context.get("session").identity.id,
      body.data.projectId ?? null,
      body.data.content,
      body.data.pinned ? 1 : 0,
    )
    .run();
  return context.json({ id }, 201);
});

app.patch("/api/notes/:id", requireAdmin, async (context) => {
  const note = await ownedNote(context);
  if (!note) return context.json({ code: "NOT_FOUND" }, 404);
  const body = z
    .object({
      content: z.string().trim().min(1).max(4000).optional(),
      pinned: z.boolean().optional(),
      projectId: z.string().uuid().nullable().optional(),
    })
    .safeParse(await readJson(context));
  if (!body.success) return invalidRequest(context);

  if (body.data.projectId) {
    const project = await context.env.DB.prepare(
      "SELECT id FROM projects WHERE id = ? AND owner_user_id = ?",
    )
      .bind(body.data.projectId, context.get("session").identity.id)
      .first();
    if (!project) return context.json({ code: "NOT_FOUND" }, 404);
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  if (body.data.content !== undefined) {
    updates.push("content = ?");
    values.push(body.data.content);
  }
  if (body.data.pinned !== undefined) {
    updates.push("pinned = ?");
    values.push(body.data.pinned ? 1 : 0);
  }
  if (body.data.projectId !== undefined) {
    updates.push("project_id = ?");
    values.push(body.data.projectId);
  }
  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    values.push(note.id);
    await context.env.DB.prepare(
      `UPDATE notes SET ${updates.join(", ")} WHERE id = ?`,
    )
      .bind(...values)
      .run();
  }
  return context.json({ ok: true });
});

app.delete("/api/notes/:id", requireAdmin, async (context) => {
  const note = await ownedNote(context);
  if (!note) return context.json({ code: "NOT_FOUND" }, 404);
  await context.env.DB.prepare("DELETE FROM notes WHERE id = ?")
    .bind(note.id)
    .run();
  return context.body(null, 204);
});

app.post("/api/agent/enroll", async (context) => {
  const token = readBearerToken(context.req.header("authorization"));
  const host = hostSchema.safeParse(await readJson(context));
  if (!token || !host.success) {
    return context.json({ code: "INVALID_ENROLLMENT" }, 400);
  }

  const node = await context.env.DB.prepare(
    `SELECT id, interval_seconds FROM nodes
     WHERE enrollment_token_hash = ?
       AND datetime(enrollment_expires_at) > datetime('now')
       AND disabled_at IS NULL
     LIMIT 1`,
  )
    .bind(await sha256(token))
    .first<AgentNode>();
  if (!node) return context.json({ code: "INVALID_ENROLLMENT" }, 401);

  const agentToken = randomToken();
  await context.env.DB.prepare(
    `UPDATE nodes
     SET agent_token_hash = ?, enrollment_token_hash = NULL,
         enrollment_expires_at = NULL, enrolled_at = datetime('now'),
         hostname = ?, operating_system = ?, architecture = ?,
         agent_version = ?, last_seen_at = datetime('now'),
         updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(
      await sha256(agentToken),
      host.data.hostname,
      host.data.operatingSystem,
      host.data.architecture,
      host.data.agentVersion,
      node.id,
    )
    .run();

  return context.json({
    nodeId: node.id,
    token: agentToken,
    intervalSeconds: node.interval_seconds,
  });
});

app.post("/api/agent/heartbeat", async (context) => {
  const authorization = await authenticateAgent(context);
  if (!authorization) return context.json({ code: "UNAUTHORIZED" }, 401);
  const heartbeat = heartbeatSchema.safeParse(await readJson(context));
  if (!heartbeat.success || heartbeat.data.nodeId !== authorization.id) {
    return context.json({ code: "INVALID_HEARTBEAT" }, 400);
  }

  const metrics = heartbeat.data.metrics;
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE nodes
       SET hostname = ?, architecture = ?, operating_system = ?,
           agent_version = ?, last_seen_at = datetime('now'),
           cpu_percent = ?, memory_used_bytes = ?, memory_total_bytes = ?,
           disk_used_bytes = ?, disk_total_bytes = ?, load_1 = ?,
           uptime_seconds = ?, updated_at = datetime('now')
       WHERE id = ?`,
    ).bind(
      heartbeat.data.hostname,
      heartbeat.data.architecture,
      heartbeat.data.operatingSystem,
      heartbeat.data.agentVersion,
      metrics.cpuPercent,
      metrics.memoryUsedBytes,
      metrics.memoryTotalBytes,
      metrics.diskUsedBytes,
      metrics.diskTotalBytes,
      metrics.load1,
      metrics.uptimeSeconds,
      authorization.id,
    ),
    context.env.DB.prepare(
      `INSERT INTO node_metrics (
         node_id, cpu_percent, memory_used_bytes, memory_total_bytes,
         disk_used_bytes, disk_total_bytes, load_1, load_5, load_15,
         uptime_seconds
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      authorization.id,
      metrics.cpuPercent,
      metrics.memoryUsedBytes,
      metrics.memoryTotalBytes,
      metrics.diskUsedBytes,
      metrics.diskTotalBytes,
      metrics.load1,
      metrics.load5,
      metrics.load15,
      metrics.uptimeSeconds,
    ),
  ]);

  return context.json({
    ok: true,
    intervalSeconds: authorization.interval_seconds,
  });
});

app.get("/api/agent/config", async (context) => {
  const node = await authenticateAgent(context);
  if (!node) return context.json({ code: "UNAUTHORIZED" }, 401);
  const checks = await context.env.DB.prepare(
    `SELECT id, name, kind, target, timeout_seconds
     FROM checks WHERE node_id = ? AND enabled = 1
     ORDER BY created_at`,
  )
    .bind(node.id)
    .all();
  return context.json({
    nodeId: node.id,
    intervalSeconds: node.interval_seconds,
    checks: checks.results,
  });
});

app.post("/api/agent/results", async (context) => {
  const node = await authenticateAgent(context);
  if (!node) return context.json({ code: "UNAUTHORIZED" }, 401);
  const payload = resultSchema.safeParse(await readJson(context));
  if (!payload.success || payload.data.nodeId !== node.id) {
    return context.json({ code: "INVALID_RESULTS" }, 400);
  }

  for (const result of payload.data.results) {
    await applyCheckResult(context.env, node.id, result);
  }
  return context.json({ ok: true });
});

app.all("*", (context) => context.env.ASSETS.fetch(context.req.raw));

async function authenticateAgent(
  context: PulseContext,
): Promise<AgentNode | null> {
  const token = readBearerToken(context.req.header("authorization"));
  if (!token) return null;
  return context.env.DB.prepare(
    `SELECT id, interval_seconds FROM nodes
     WHERE agent_token_hash = ? AND enrolled_at IS NOT NULL
       AND disabled_at IS NULL LIMIT 1`,
  )
    .bind(await sha256(token))
    .first<AgentNode>();
}

async function applyCheckResult(
  env: Env,
  nodeId: string,
  result: {
    checkId: string;
    status: CheckStatus;
    latencyMs: number | null;
    message: string | null;
    checkedAt?: string;
  },
): Promise<void> {
  const db = env.DB;
  const check = await db
    .prepare(
      `SELECT id, node_id, name, kind, target, enabled, status,
              timeout_seconds, latency_ms, last_checked_at,
              consecutive_failures, last_message
       FROM checks WHERE id = ? AND node_id = ? AND enabled = 1`,
    )
    .bind(result.checkId, nodeId)
    .first<CheckRow>();
  if (!check) return;

  const failureCount = nextFailureCount(
    check.consecutive_failures,
    result.status,
  );
  const checkedAt = result.checkedAt ?? new Date().toISOString();
  await db.batch([
    db
      .prepare(
        `INSERT INTO check_results
         (check_id, status, latency_ms, message, checked_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(
        check.id,
        result.status,
        result.latencyMs,
        result.message,
        checkedAt,
      ),
    db
      .prepare(
        `UPDATE checks
         SET status = ?, latency_ms = ?, last_checked_at = ?,
             consecutive_failures = ?, last_message = ?,
             updated_at = datetime('now')
         WHERE id = ?`,
      )
      .bind(
        result.status,
        result.latencyMs,
        checkedAt,
        failureCount,
        result.message,
        check.id,
      ),
  ]);

  if (shouldOpenIncident(result.status, failureCount)) {
    const summary = `${check.name} is down${result.message ? `: ${result.message}` : ""}`;
    await db
      .prepare(
        `INSERT INTO incidents
         (id, check_id, status, started_at, summary)
         VALUES (?, ?, 'OPEN', ?, ?)`,
      )
      .bind(crypto.randomUUID(), check.id, checkedAt, summary)
      .run();
    await notifyIncident(env, nodeId, check.name, "opened", summary, checkedAt);
  } else if (shouldResolveIncident(check.status, result.status)) {
    await db
      .prepare(
        `UPDATE incidents SET status = 'RESOLVED', resolved_at = ?
         WHERE check_id = ? AND status = 'OPEN'`,
      )
      .bind(checkedAt, check.id)
      .run();
    await notifyIncident(
      env,
      nodeId,
      check.name,
      "resolved",
      `${check.name} is responding again.`,
      checkedAt,
    );
  }
}

async function notifyIncident(
  env: Env,
  nodeId: string,
  checkName: string,
  kind: "opened" | "resolved",
  summary: string,
  occurredAt: string,
): Promise<void> {
  try {
    const node = await env.DB.prepare(
      `SELECT name, owner_user_id FROM nodes WHERE id = ?`,
    )
      .bind(nodeId)
      .first<{ name: string; owner_user_id: string }>();
    if (!node) return;

    const lookup = new URL(INTERNAL_URLS.IDENTITY_LOOKUP);
    lookup.searchParams.set("id", node.owner_user_id);
    const response = await env.PASS.fetch(lookup);
    if (!response.ok) return;
    const owner = await response.json<{ email: string; username: string | null }>();

    await sendIncidentEmail(env, {
      to: owner.email,
      recipientName: owner.username,
      kind,
      checkName,
      nodeName: node.name,
      summary,
      occurredAt,
    });
  } catch (error) {
    console.error("[pulse notify]", error);
  }
}

async function readJson(context: PulseContext): Promise<unknown> {
  return context.req.json().catch(() => null);
}

function invalidRequest(context: PulseContext) {
  return context.json(
    { code: "INVALID_REQUEST", message: "Check the submitted fields." },
    400,
  );
}

async function ownedNode(context: PulseContext) {
  return findOwnedNode(
    context.env.DB,
    context.req.param("id") ?? "",
    context.get("session").identity.id,
  );
}

function findOwnedNode(db: D1Database, id: string, ownerId: string) {
  return db
    .prepare("SELECT id FROM nodes WHERE id = ? AND owner_user_id = ? LIMIT 1")
    .bind(id, ownerId)
    .first<{ id: string }>();
}

async function ownedCheck(context: PulseContext): Promise<CheckRow | null> {
  return context.env.DB.prepare(
    `SELECT c.id, c.node_id, c.name, c.kind, c.target, c.enabled,
            c.status, c.timeout_seconds, c.latency_ms, c.last_checked_at,
            c.consecutive_failures, c.last_message
     FROM checks c JOIN nodes n ON n.id = c.node_id
     WHERE c.id = ? AND n.owner_user_id = ? LIMIT 1`,
  )
    .bind(context.req.param("id"), context.get("session").identity.id)
    .first<CheckRow>();
}

function ownedProject(context: PulseContext) {
  return context.env.DB.prepare(
    "SELECT id FROM projects WHERE id = ? AND owner_user_id = ? LIMIT 1",
  )
    .bind(context.req.param("id"), context.get("session").identity.id)
    .first<{ id: string }>();
}

function ownedNote(context: PulseContext) {
  return context.env.DB.prepare(
    "SELECT id FROM notes WHERE id = ? AND owner_user_id = ? LIMIT 1",
  )
    .bind(context.req.param("id"), context.get("session").identity.id)
    .first<{ id: string }>();
}

export { app };
