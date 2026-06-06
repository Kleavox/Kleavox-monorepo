import { describe, expect, it } from "vitest";
import type { Env } from "../env";
import { clearSessionCookie, makeSessionCookie } from "./cookies";

const env = {
  ROOT_DOMAIN: "product.test",
} as Env;

describe("session cookies", () => {
  it("scopes production sessions to all Kleavox subdomains", () => {
    const cookie = makeSessionCookie(
      new Request("https://pass.product.test/api/login"),
      env,
      "secret",
    );

    expect(cookie).toContain("__Secure-kleavox_session=secret");
    expect(cookie).toContain("Domain=.product.test");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("does not attach the production domain during local development", () => {
    const cookie = makeSessionCookie(
      new Request("http://localhost:8787/api/login"),
      env,
      "secret",
    );

    expect(cookie).not.toContain("Domain=");
  });

  it("clears the same cookie", () => {
    expect(
      clearSessionCookie(
        new Request("https://pass.product.test/api/logout"),
        env,
      ),
    ).toContain("Max-Age=0");
  });
});
