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
      DROP: { fetch: vi.fn() },
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
        DROP: { fetch: vi.fn() },
        ASSETS: { fetch: vi.fn() },
        PUBLIC_ORIGIN: "https://product.test",
      } as unknown as Env,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("receiver");
    expect(linkFetch).toHaveBeenCalledTimes(2);
  });

  it("proxies public file APIs to Drop", async () => {
    const dropFetch = vi.fn(async (request: Request) =>
      Response.json({ host: new URL(request.url).hostname }),
    );
    const response = await app.request(
      "https://product.test/api/public/f_JG2nV6-pQ9",
      {},
      {
        LINK: { fetch: vi.fn() },
        DROP: { fetch: dropFetch },
        ASSETS: { fetch: vi.fn() },
        PUBLIC_ORIGIN: "https://product.test",
      } as unknown as Env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ host: "drop.internal" });
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
        DROP: { fetch: vi.fn() },
        ASSETS: { fetch: vi.fn() },
        PUBLIC_ORIGIN: "https://product.test",
      } as unknown as Env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      path: "/link-assets/index.js",
    });
  });
});
