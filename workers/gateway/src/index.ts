import { isReservedSlug } from "@zarkiv/core";
import { Hono } from "hono";

import { hostRedirect } from "./hosts";

interface Env {
  ASSETS: Fetcher;
  LINK: Fetcher;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (context) =>
  context.json({ service: "gateway", status: "ok" }),
);

app.all("*", async (context) => {
  const url = new URL(context.req.url);
  const redirect = hostRedirect(url);
  if (redirect) return context.redirect(redirect.toString(), 308);

  const slug = getPublicSlug(url.pathname);

  if (
    ["GET", "HEAD", "POST"].includes(context.req.method) &&
    slug &&
    !isReservedSlug(slug)
  ) {
    const headers = new Headers(context.req.raw.headers);
    headers.set("x-zarkiv-public-host", url.hostname);
    const response = await context.env.LINK.fetch(
      `http://link.internal/internal/resolve/${encodeURIComponent(slug)}`,
      {
        method: context.req.method,
        headers,
        body:
          context.req.method === "GET" || context.req.method === "HEAD"
            ? undefined
            : context.req.raw.body,
        redirect: "manual",
      },
    );

    if (response.status !== 404) return response;
  }

  return context.env.ASSETS.fetch(context.req.raw);
});

function getPublicSlug(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 1) return null;

  const slug = parts[0];
  if (!slug || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(slug)) return null;
  return slug.toLowerCase();
}

export default app;
