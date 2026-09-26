import { describe, expect, it } from "vitest";
import {
  readCookie,
  requirePassInProduction,
  verifyChallenge,
  verifySession,
} from "./index";

describe("readCookie", () => {
  it("reads an encoded cookie value", () => {
    const request = new Request("https://link.product.test", {
      headers: { cookie: "theme=dark; session=a%2Fb%3D" },
    });

    expect(readCookie(request, "session")).toBe("a/b=");
  });

  it("does not partially match cookie names", () => {
    const request = new Request("https://link.product.test", {
      headers: { cookie: "other_session=value" },
    });

    expect(readCookie(request, "session")).toBeNull();
  });
});

describe("standalone mode", () => {
  const request = new Request("https://pulse.product.test");

  it("hands out an admin session when there is no Pass to ask", async () => {
    const session = await verifySession(request, undefined);

    expect(session?.identity.role).toBe("ADMIN");
    expect(session?.identity.id).toBe("standalone");
  });

  it("refuses a challenge when there is no Pass to ask", async () => {
    expect(await verifyChallenge(request, undefined, "basic")).toBe(false);
  });

  it("throws in production when the Pass binding is missing", () => {
    expect(() =>
      requirePassInProduction({ ENVIRONMENT: "production" }),
    ).toThrow(/falls? open/u);
  });

  it("stays quiet outside production", () => {
    expect(() =>
      requirePassInProduction({ ENVIRONMENT: "development" }),
    ).not.toThrow();
  });

  it("stays quiet in production when the binding is there", () => {
    expect(() =>
      requirePassInProduction({
        ENVIRONMENT: "production",
        PASS: { fetch: async () => new Response(null) },
      }),
    ).not.toThrow();
  });
});
