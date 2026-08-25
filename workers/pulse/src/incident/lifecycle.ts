import { INTERNAL_URLS } from "@kleavox/config";
import type { CheckResult } from "@kleavox/pulse-protocol";

import type { Env } from "../env";
import { sendIncidentEmail } from "../lib/mail";

interface CheckRecord {
  id: string;
  name: string;
}

type IncidentNotification = {
  nodeId: string;
  checkName: string;
  kind: "opened" | "resolved";
  summary: string;
  occurredAt: string;
};

export type IncidentNotifier = (
  notification: IncidentNotification,
) => Promise<void>;

export interface IncidentLifecycle {
  recordCheckResult(nodeId: string, result: CheckResult): Promise<void>;
}

export function createIncidentLifecycle(
  env: Env,
  notifier: IncidentNotifier = createIncidentNotifier(env),
): IncidentLifecycle {
  return {
    async recordCheckResult(nodeId, result) {
      const check = await env.DB.prepare(
        `SELECT id, name
         FROM checks
         WHERE id = ? AND node_id = ? AND enabled = 1`,
      )
        .bind(result.checkId, nodeId)
        .first<CheckRecord>();
      if (!check) return;

      const checkedAt = result.checkedAt ?? new Date().toISOString();
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO check_results
           (check_id, status, latency_ms, message, checked_at)
           VALUES (?, ?, ?, ?, ?)`,
        ).bind(
          check.id,
          result.status,
          result.latencyMs,
          result.message,
          checkedAt,
        ),
        env.DB.prepare(
          `UPDATE checks
           SET status = ?, latency_ms = ?, last_checked_at = ?,
               consecutive_failures = CASE
                 WHEN ? = 'DOWN' THEN consecutive_failures + 1
                 ELSE 0
               END,
               last_message = ?, updated_at = datetime('now')
           WHERE id = ?`,
        ).bind(
          result.status,
          result.latencyMs,
          checkedAt,
          result.status,
          result.message,
          check.id,
        ),
      ]);

      if (result.status === "DOWN") {
        const state = await env.DB.prepare(
          `SELECT consecutive_failures FROM checks WHERE id = ?`,
        )
          .bind(check.id)
          .first<{ consecutive_failures: number }>();
        if (!state || state.consecutive_failures < 2) return;

        const summary = `${check.name} is down${result.message ? `: ${result.message}` : ""}`;
        const opened = await env.DB.prepare(
          `INSERT OR IGNORE INTO incidents
           (id, check_id, status, started_at, summary)
           VALUES (?, ?, 'OPEN', ?, ?)`,
        )
          .bind(crypto.randomUUID(), check.id, checkedAt, summary)
          .run();
        if ((opened.meta.changes ?? 0) > 0) {
          await notifier({
            nodeId,
            checkName: check.name,
            kind: "opened",
            summary,
            occurredAt: checkedAt,
          });
        }
        return;
      }

      const resolved = await env.DB.prepare(
        `UPDATE incidents
         SET status = 'RESOLVED', resolved_at = ?
         WHERE check_id = ? AND status = 'OPEN'`,
      )
        .bind(checkedAt, check.id)
        .run();
      if ((resolved.meta.changes ?? 0) > 0) {
        await notifier({
          nodeId,
          checkName: check.name,
          kind: "resolved",
          summary: `${check.name} is responding again.`,
          occurredAt: checkedAt,
        });
      }
    },
  };
}

function createIncidentNotifier(env: Env): IncidentNotifier {
  return async (notification) => {
    try {
      const node = await env.DB.prepare(
        `SELECT name, owner_user_id FROM nodes WHERE id = ?`,
      )
        .bind(notification.nodeId)
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
        kind: notification.kind,
        checkName: notification.checkName,
        nodeName: node.name,
        summary: notification.summary,
        occurredAt: notification.occurredAt,
      });
    } catch (error) {
      console.error("[pulse notify]", error);
    }
  };
}
