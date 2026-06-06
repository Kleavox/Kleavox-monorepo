import { describe, expect, it } from "vitest";

import type { Env } from "../env";
import { safeReturnTo } from "./oauth";

const env = {
  PUBLIC_ORIGIN: "https://pass.product.test",
  ROOT_DOMAIN: "product.test",
} as Env;

describe("OAuth return destinations", () => {
  it("accepts canonical Kleavox hosts", () => {
    expect(safeReturnTo("https://link.product.test/files", env)).toBe(
      "https://link.product.test/files",
    );
    expect(safeReturnTo("https://product.test/account", env)).toBe(
      "https://product.test/account",
    );
  });

  it("rejects external and insecure destinations", () => {
    expect(safeReturnTo("https://product.test.attacker.example", env)).toBe(
      env.PUBLIC_ORIGIN,
    );
    expect(safeReturnTo("http://link.product.test", env)).toBe(
      env.PUBLIC_ORIGIN,
    );
  });
});
