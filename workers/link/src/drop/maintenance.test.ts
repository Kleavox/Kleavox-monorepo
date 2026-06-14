import { describe, expect, it, vi } from "vitest";

import { runDropMaintenance } from "./maintenance";
import type { Env } from "../env";

describe("Drop scheduled maintenance", () => {
  it("runs cleanup queries without error on an empty database", async () => {
    const all = vi.fn(async () => ({ results: [] }));
    const run = vi.fn(async () => ({ success: true }));
    const env = {
      DB: {
        prepare() {
          return { all, run, bind: () => ({ all, run }) };
        },
      },
    } as unknown as Env;

    await expect(runDropMaintenance(env)).resolves.toBeUndefined();
    expect(all).toHaveBeenCalled();
    expect(run).toHaveBeenCalled();
  });
});
