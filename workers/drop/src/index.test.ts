import { describe, expect, it, vi } from "vitest";

import worker from "./index";
import type { Env } from "./env";

describe("Drop scheduled maintenance", () => {
  it("wires maintenance through waitUntil", () => {
    const all = vi.fn(async () => ({ results: [] }));
    const run = vi.fn(async () => ({ success: true }));
    const env = {
      DB: {
        prepare() {
          return { all, run };
        },
      },
    } as unknown as Env;
    const waitUntil = vi.fn();

    worker.scheduled({} as ScheduledController, env, {
      waitUntil,
    } as unknown as ExecutionContext);

    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(waitUntil.mock.calls[0]?.[0]).toBeInstanceOf(Promise);
  });
});
