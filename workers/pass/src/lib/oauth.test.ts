import { describe, expect, it } from "vitest";

import type { Env } from "../env";
import { safeReturnTo } from "./oauth";

const env = {
  PUBLIC_ORIGIN: "https://pass.zarkiv.com",
  ROOT_DOMAIN: "zarkiv.com",
} as Env;

describe("OAuth return destinations", () => {
  it("accepts canonical Zarkiv hosts", () => {
    expect(safeReturnTo("https://link.zarkiv.com/files", env)).toBe(
      "https://link.zarkiv.com/files",
    );
    expect(safeReturnTo("https://zarkiv.com/account", env)).toBe(
      "https://zarkiv.com/account",
    );
  });

  it("rejects external and insecure destinations", () => {
    expect(safeReturnTo("https://zarkiv.com.attacker.example", env)).toBe(
      env.PUBLIC_ORIGIN,
    );
    expect(safeReturnTo("http://link.zarkiv.com", env)).toBe(env.PUBLIC_ORIGIN);
  });
});
