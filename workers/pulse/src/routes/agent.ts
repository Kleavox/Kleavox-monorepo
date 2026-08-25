import { agentConfigResponseSchema } from "@kleavox/pulse-protocol";

import { createIncidentLifecycle } from "../incident/lifecycle";
import { randomToken, readBearerToken, sha256 } from "../lib/crypto";
import { heartbeatSchema, hostSchema, resultSchema } from "../schemas";
import { readJson, type PulseApp, type PulseContext } from "./shared";

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
      .all<{
        id: string;
        name: string;
        kind: "HTTP" | "TCP" | "SERVICE";
        target: string;
        timeout_seconds: number;
      }>();
    return context.json(
      agentConfigResponseSchema.parse({
        nodeId: node.id,
        intervalSeconds: node.interval_seconds,
        checks: checks.results.map((check) => ({
          id: check.id,
          name: check.name,
          kind: check.kind,
          target: check.target,
          timeoutSeconds: check.timeout_seconds,
        })),
      }),
    );
  });

  app.post("/api/agent/results", async (context) => {
    const node = await authenticateAgent(context);
    if (!node) return context.json({ code: "UNAUTHORIZED" }, 401);
    const payload = resultSchema.safeParse(await readJson(context));
    if (!payload.success || payload.data.nodeId !== node.id) {
      return context.json({ code: "INVALID_RESULTS" }, 400);
    }

    const incidents = createIncidentLifecycle(context.env);
    for (const result of payload.data.results) {
      await incidents.recordCheckResult(node.id, result);
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
