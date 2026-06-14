import type { MiddlewareHandler } from "hono";
import { z } from "zod";

import { validateCheckTarget } from "../lib/checks";
import { randomToken, sha256 } from "../lib/crypto";
import {
  invalidRequest,
  readJson,
  type CheckRow,
  type PulseApp,
  type PulseContext,
  type PulseEnv,
} from "./shared";

export function registerAdminRoutes(
  app: PulseApp,
  requireAdmin: MiddlewareHandler<PulseEnv>,
): void {
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
    const enrollmentExpiresAt = new Date(
      Date.now() + 30 * 60_000,
    ).toISOString();

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
    const enrollmentExpiresAt = new Date(
      Date.now() + 30 * 60_000,
    ).toISOString();
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
