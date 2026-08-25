import { describe, expect, it, vi } from "vitest";

import type { Env } from "../env";
import { createIncidentLifecycle } from "./lifecycle";

const result = {
  checkId: "22222222-2222-4222-8222-222222222222",
  status: "DOWN" as const,
  latencyMs: 250,
  message: "timeout",
  checkedAt: "2026-07-18T00:00:00.000Z",
};

describe("Pulse Incident lifecycle", () => {
  it("increments failure state atomically and opens one Incident", async () => {
    const notify = vi.fn(async () => undefined);
    const env = incidentEnv({ failureCount: 2, incidentChanges: 1 });

    await createIncidentLifecycle(env, notify).recordCheckResult(
      "11111111-1111-4111-8111-111111111111",
      result,
    );

    expect(
      env.queries.some((sql) => sql.includes("consecutive_failures + 1")),
    ).toBe(true);
    expect(notify).toHaveBeenCalledWith({
      nodeId: "11111111-1111-4111-8111-111111111111",
      checkName: "Gateway health",
      kind: "opened",
      summary: "Gateway health is down: timeout",
      occurredAt: result.checkedAt,
    });
  });

  it("does not duplicate notification when the unique open Incident wins elsewhere", async () => {
    const notify = vi.fn(async () => undefined);
    const env = incidentEnv({ failureCount: 3, incidentChanges: 0 });

    await createIncidentLifecycle(env, notify).recordCheckResult(
      "11111111-1111-4111-8111-111111111111",
      result,
    );

    expect(notify).not.toHaveBeenCalled();
  });

  it("resolves an open Incident once when a Check recovers", async () => {
    const notify = vi.fn(async () => undefined);
    const env = incidentEnv({ failureCount: 0, incidentChanges: 1 });

    await createIncidentLifecycle(env, notify).recordCheckResult(
      "11111111-1111-4111-8111-111111111111",
      { ...result, status: "UP", latencyMs: 40, message: null },
    );

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "resolved",
        summary: "Gateway health is responding again.",
      }),
    );
  });
});

function incidentEnv(options: {
  failureCount: number;
  incidentChanges: number;
}): Env & { queries: string[] } {
  const queries: string[] = [];
  const prepare = (sql: string) => {
    queries.push(sql);
    const statement = {
      sql,
      bind() {
        return statement;
      },
      async first() {
        if (sql.includes("SELECT id, name")) {
          return {
            id: result.checkId,
            name: "Gateway health",
          };
        }
        if (sql.includes("SELECT consecutive_failures")) {
          return { consecutive_failures: options.failureCount };
        }
        return null;
      },
      async run() {
        if (
          sql.includes("INSERT OR IGNORE INTO incidents") ||
          sql.includes("UPDATE incidents")
        ) {
          return { meta: { changes: options.incidentChanges } };
        }
        return { meta: { changes: 1 } };
      },
    };
    return statement;
  };
  return {
    queries,
    DB: {
      prepare,
      batch: vi.fn(async () => []),
    },
  } as unknown as Env & { queries: string[] };
}
