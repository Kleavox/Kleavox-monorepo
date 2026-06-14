import { INTERNAL_URLS } from "@kleavox/config";

import type { Env } from "../env";
import {
  nextFailureCount,
  shouldOpenIncident,
  shouldResolveIncident,
  type CheckStatus,
} from "../lib/checks";
import { randomToken, readBearerToken, sha256 } from "../lib/crypto";
import { sendIncidentEmail } from "../lib/mail";
import { heartbeatSchema, hostSchema, resultSchema } from "../schemas";
import {
  readJson,
  type CheckRow,
  type PulseApp,
  type PulseContext,
} from "./shared";

interface AgentNode {
  id: string;
  interval_seconds: number;
}

export function registerAgentRoutes(app: PulseApp): void {
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
}

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
    const owner = await response.json<{
      email: string;
      username: string | null;
    }>();

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
