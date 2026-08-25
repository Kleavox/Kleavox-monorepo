import { describe, expect, it, vi } from "vitest";

import { app } from "./index";
import type { Env } from "./index";

describe("Gateway public namespace", () => {
  it("resolves normal slugs through Link", async () => {
    const linkFetch = vi.fn(async () =>
      Response.redirect("https://example.com", 302),
    );
    const response = await app.request("https://product.test/launch", {}, {
      LINK: { fetch: linkFetch },
      ASSETS: { fetch: vi.fn() },
      PUBLIC_ORIGIN: "https://product.test",
    } as unknown as Env);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://example.com/");
    expect(linkFetch).toHaveBeenCalledTimes(1);
  });

  it("serves the Link receiver when a file slug has no Link collision", async () => {
    const linkFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(
        new Response("<main>receiver</main>", {
          headers: { "content-type": "text/html" },
        }),
      );
    const response = await app.request(
      "https://product.test/f_JG2nV6-pQ9",
      {},
      {
        LINK: { fetch: linkFetch },
        ASSETS: { fetch: vi.fn() },
        PUBLIC_ORIGIN: "https://product.test",
      } as unknown as Env,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("receiver");
    expect(linkFetch).toHaveBeenCalledTimes(2);
  });

  it("proxies public file APIs to Link", async () => {
    const linkFetch = vi.fn(async (request: Request) =>
      Response.json({ host: new URL(request.url).hostname }),
    );
    const response = await app.request(
      "https://product.test/api/public/f_JG2nV6-pQ9",
      {},
      {
        LINK: { fetch: linkFetch },
        ASSETS: { fetch: vi.fn() },
        PUBLIC_ORIGIN: "https://product.test",
      } as unknown as Env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ host: "link.internal" });
  });

  it("proxies the receiver bundle to Link", async () => {
    const linkFetch = vi.fn(async (request: Request) =>
      Response.json({ path: new URL(request.url).pathname }),
    );
    const response = await app.request(
      "https://product.test/link-assets/index.js",
      {},
      {
        LINK: { fetch: linkFetch },
        ASSETS: { fetch: vi.fn() },
        PUBLIC_ORIGIN: "https://product.test",
      } as unknown as Env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      path: "/link-assets/index.js",
    });
  });

  it("renders the unified error page for an unknown HTML route", async () => {
    const response = await app.request(
      "https://product.test/no/such/path",
      { headers: { accept: "text/html" } },
      {
        LINK: { fetch: vi.fn() },
        ASSETS: {
          fetch: vi.fn(async () => new Response("nope", { status: 404 })),
        },
        PUBLIC_ORIGIN: "https://product.test",
      } as unknown as Env,
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toContain("Page not found");
  });
});

describe("Gateway estate endpoint", () => {
  it("rejects a request with no session cookie", async () => {
    const response = await app.request("https://product.test/api/estate", {}, {
      PASS: { fetch: vi.fn() },
      LINK: { fetch: vi.fn() },
      PULSE: { fetch: vi.fn() },
      ASSETS: { fetch: vi.fn() },
      PUBLIC_ORIGIN: "https://product.test",
    } as unknown as Env);

    expect(response.status).toBe(401);
  });

  it("aggregates the three tools and echoes an allowed origin", async () => {
    const passFetch = vi.fn(async (url: string) => {
      if (url.includes("/internal/session")) {
        return Response.json({ identity: { id: "u1", role: "ADMIN" } });
      }
      if (url.includes("/api/sessions")) {
        return Response.json({ sessions: [{ id: "s1" }] });
      }
      return new Response(null, { status: 404 });
    });
    const linkFetch = vi.fn(async (url: string) => {
      if (url.includes("/api/links")) {
        return Response.json({
          data: [],
          meta: { page: 1, limit: 1, total: 5, totalPages: 5 },
        });
      }
      if (url.includes("/api/drops")) {
        return Response.json({ drops: [] });
      }
      if (url.includes("/api/admin/reports")) {
        return Response.json({ reports: [] });
      }
      return new Response(null, { status: 404 });
    });
    const pulseFetch = vi.fn(async (url: string) => {
      if (url.includes("/api/overview")) {
        return Response.json({ nodes: [], checks: [], incidents: [] });
      }
      return new Response(null, { status: 404 });
    });

    const response = await app.request(
      "https://product.test/api/estate",
      {
        headers: {
          cookie: "__Secure-kleavox_session=tok",
          Origin: "https://link.product.test",
        },
      },
      {
        PASS: { fetch: passFetch },
        LINK: { fetch: linkFetch },
        PULSE: { fetch: pulseFetch },
        ASSETS: { fetch: vi.fn() },
        PUBLIC_ORIGIN: "https://product.test",
      } as unknown as Env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      role: "ADMIN",
      pass: { devices: 1 },
      link: { active: 5 },
    });
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://link.product.test",
    );
    expect(response.headers.get("vary")).toBe("Origin");
  });

  it("never reflects an origin outside the topology allowlist", async () => {
    const passFetch = vi.fn(async (url: string) => {
      if (url.includes("/internal/session")) {
        return Response.json({ identity: { id: "u1", role: "ADMIN" } });
      }
      return Response.json({ sessions: [] });
    });

    const response = await app.request(
      "https://product.test/api/estate",
      {
        headers: {
          cookie: "__Secure-kleavox_session=tok",
          Origin: "https://evil.example",
        },
      },
      {
        PASS: { fetch: passFetch },
        LINK: { fetch: vi.fn(async () => new Response(null, { status: 404 })) },
        PULSE: {
          fetch: vi.fn(async () => new Response(null, { status: 404 })),
        },
        ASSETS: { fetch: vi.fn() },
        PUBLIC_ORIGIN: "https://product.test",
      } as unknown as Env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("vary")).toBe("Origin");
  });

  it("degrades only the malformed part when an upstream answers 200 with a wrong-shaped body", async () => {
    const passFetch = vi.fn(async (url: string) => {
      if (url.includes("/internal/session")) {
        return Response.json({ identity: { id: "u1", role: "ADMIN" } });
      }
      if (url.includes("/api/sessions")) {
        return Response.json({ sessions: [{ id: "s1" }] });
      }
      return new Response(null, { status: 404 });
    });
    const linkFetch = vi.fn(async (url: string) => {
      if (url.includes("/api/links")) {
        return Response.json({ error: "unexpected envelope" });
      }
      if (url.includes("/api/drops")) {
        return Response.json({
          drops: [
            {
              publicToken: "f_ok",
              name: "fine.txt",
              downloadCount: 0,
              expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              status: "ACTIVE",
            },
          ],
        });
      }
      if (url.includes("/api/admin/reports")) {
        return Response.json({
          reports: [
            {
              id: "r1",
              reason: "SPAM",
              status: "OPEN",
              created_at: new Date().toISOString(),
              slug: "still-open",
            },
          ],
        });
      }
      return new Response(null, { status: 404 });
    });
    const pulseFetch = vi.fn(async (url: string) => {
      if (url.includes("/api/overview")) {
        return Response.json({ nodes: [], checks: [], incidents: [] });
      }
      return new Response(null, { status: 404 });
    });

    const response = await app.request(
      "https://product.test/api/estate",
      { headers: { cookie: "__Secure-kleavox_session=tok" } },
      {
        PASS: { fetch: passFetch },
        LINK: { fetch: linkFetch },
        PULSE: { fetch: pulseFetch },
        ASSETS: { fetch: vi.fn() },
        PUBLIC_ORIGIN: "https://product.test",
      } as unknown as Env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      pass: { devices: 1 },
      link: { active: 0, files: 1, reported: 1 },
    });
  });

  it("204s the OPTIONS preflight", async () => {
    const response = await app.request(
      "https://product.test/api/estate",
      { method: "OPTIONS" },
      {
        PASS: { fetch: vi.fn() },
        LINK: { fetch: vi.fn() },
        PULSE: { fetch: vi.fn() },
        ASSETS: { fetch: vi.fn() },
        PUBLIC_ORIGIN: "https://product.test",
      } as unknown as Env,
    );

    expect(response.status).toBe(204);
  });

  it("derives the allowlist from PUBLIC_ORIGIN, not a spoofable Host header", async () => {
    const passFetch = vi.fn(async (url: string) => {
      if (url.includes("/internal/session")) {
        return Response.json({ identity: { id: "u1", role: "ADMIN" } });
      }
      return Response.json({ sessions: [] });
    });

    const response = await app.request(
      "https://attacker.example/api/estate",
      {
        headers: {
          cookie: "__Secure-kleavox_session=tok",
          Origin: "https://link.product.test",
        },
      },
      {
        PASS: { fetch: passFetch },
        LINK: { fetch: vi.fn(async () => new Response(null, { status: 404 })) },
        PULSE: {
          fetch: vi.fn(async () => new Response(null, { status: 404 })),
        },
        ASSETS: { fetch: vi.fn() },
        PUBLIC_ORIGIN: "https://product.test",
      } as unknown as Env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://link.product.test",
    );
  });
});
