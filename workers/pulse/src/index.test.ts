import { describe, expect, it, vi } from "vitest";

import worker, { runRetention } from "./index";
import type { Env } from "./env";

function retentionEnv() {
  const statements: string[] = [];
  const run = vi.fn(async () => ({ success: true }));
  const env = {
    DB: {
      prepare(sql: string) {
        statements.push(sql);
        return { run };
      },
    },
  } as unknown as Env;
  return { env, statements, run };
}

describe("Pulse retention", () => {
  it("deletes expired metric, check, and incident records", async () => {
    const { env, statements, run } = retentionEnv();
    await runRetention(env);

    expect(run).toHaveBeenCalledTimes(3);
    expect(statements.join("\n")).toContain("node_metrics");
    expect(statements.join("\n")).toContain("check_results");
    expect(statements.join("\n")).toContain("incidents");
  });

  it("wires scheduled work through waitUntil", () => {
    const { env } = retentionEnv();
    const waitUntil = vi.fn();
    worker.scheduled({} as ScheduledController, env, {
      waitUntil,
    } as unknown as ExecutionContext);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(waitUntil.mock.calls[0]?.[0]).toBeInstanceOf(Promise);
  });
});
