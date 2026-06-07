import { INTERNAL_HOSTS } from "@kleavox/config";
import { isFileSlug, isReservedSlug } from "@kleavox/core";
import { Hono } from "hono";

import { hostRedirect } from "./hosts";

export interface Env {
  ASSETS: Fetcher;
  LINK: Fetcher;
  DROP: Fetcher;
  PUBLIC_ORIGIN: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (context) =>
  context.json({ service: "gateway", status: "ok" }),
);

app.all("/api/public/*", (context) => {
  const url = new URL(context.req.url);
  url.hostname = INTERNAL_HOSTS.DROP;
  return context.env.DROP.fetch(new Request(url, context.req.raw));
});

app.all("/link-assets/*", (context) => {
  const url = new URL(context.req.url);
  url.hostname = INTERNAL_HOSTS.LINK;
  return context.env.LINK.fetch(new Request(url, context.req.raw));
});

app.all("*", async (context) => {
  const url = new URL(context.req.url);
  const redirect = hostRedirect(url, context.env.PUBLIC_ORIGIN);
  if (redirect) return context.redirect(redirect.toString(), 308);

  const slug = getPublicSlug(url.pathname);

  if (
    ["GET", "HEAD", "POST"].includes(context.req.method) &&
    slug &&
    !isReservedSlug(slug)
  ) {
    const headers = new Headers(context.req.raw.headers);
    headers.set("x-kleavox-public-host", url.hostname);
    const response = await context.env.LINK.fetch(
      `http://${INTERNAL_HOSTS.LINK}/internal/resolve/${encodeURIComponent(slug)}`,
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

    if (isFileSlug(slug) && ["GET", "HEAD"].includes(context.req.method)) {
      const appUrl = new URL(context.req.url);
      appUrl.hostname = INTERNAL_HOSTS.LINK;
      return context.env.LINK.fetch(new Request(appUrl, context.req.raw));
    }
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

export { app };
export default app;
