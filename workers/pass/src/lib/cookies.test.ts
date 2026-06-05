import { describe, expect, it } from "vitest";
import type { Env } from "../env";
import { clearSessionCookie, makeSessionCookie } from "./cookies";

const env = {
  ROOT_DOMAIN: "zarkiv.com",
} as Env;

describe("session cookies", () => {
  it("scopes production sessions to all Zarkiv subdomains", () => {
    const cookie = makeSessionCookie(
      new Request("https://pass.zarkiv.com/api/login"),
      env,
      "secret",
    );

    expect(cookie).toContain("__Secure-zarkiv_session=secret");
    expect(cookie).toContain("Domain=.zarkiv.com");
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
        new Request("https://pass.zarkiv.com/api/logout"),
        env,
      ),
    ).toContain("Max-Age=0");
  });
});
