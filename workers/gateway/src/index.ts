import { readCookie, verifySession } from "@kleavox/auth";
import { INTERNAL_HOSTS, INTERNAL_URLS, SESSION_COOKIE } from "@kleavox/config";
import { isFileSlug, isReservedSlug, renderErrorPage } from "@kleavox/core";
import { Hono } from "hono";

import { hostRedirect } from "./hosts";

export interface Env {
  ASSETS: Fetcher;
  LINK: Fetcher;
  DROP: Fetcher;
  PASS: Fetcher;
  PULSE: Fetcher;
  PORTFOLIO: Fetcher;
  PUBLIC_ORIGIN: string;
}

const app = new Hono<{ Bindings: Env }>();

app.onError((error, context) => {
  console.error("[gateway]", error);
  if (context.req.path.startsWith("/api")) {
    return context.json(
      {
        code: "INTERNAL_ERROR",
        message: "Kleavox could not complete the request.",
      },
      500,
    );
  }
  return context.html(
    renderErrorPage({
      service: "KLEAVOX",
      title: "Something broke",
      message:
        "Something went wrong on our side. Give it a moment and try again.",
    }),
    500,
    {
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    },
  );
});

app.get("/health", (context) =>
  context.json({ service: "gateway", status: "ok" }),
);

app.get("/api/session", async (context) => {
  const session = await verifySession(context.req.raw, context.env.PASS);
  return session
    ? context.json({ authenticated: true, identity: session.identity })
    : context.json({ authenticated: false });
});

app.post("/api/logout", async (context) => {
  const token = readCookie(context.req.raw, SESSION_COOKIE);
  if (token) {
    const result = await context.env.PASS.fetch(INTERNAL_URLS.SESSION_LOGOUT, {
      method: "POST",
      headers: { "x-kleavox-session": token },
    });
    if (result.ok) {
      const body = await result.json<{ cookie?: string }>();
      if (body.cookie) context.header("Set-Cookie", body.cookie);
    }
  }
  return context.json({ ok: true });
});

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
  const rootOrigin = new URL(context.env.PUBLIC_ORIGIN);
  const hostname = url.hostname.toLowerCase();

  if (hostname.endsWith(`.${rootOrigin.hostname}`)) {
    const subdomain = hostname.replace(`.${rootOrigin.hostname}`, "");
    
    if (subdomain === "pass") {
      return context.env.PASS.fetch(context.req.raw);
    }
    if (subdomain === "pulse") {
      return context.env.PULSE.fetch(context.req.raw);
    }
    if (subdomain === "port") {
      return context.env.PORTFOLIO.fetch(context.req.raw);
    }
    if (subdomain === "link") {
      return context.env.LINK.fetch(context.req.raw);
    }
  }

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
    headers.set("x-kleavox-trace-id", crypto.randomUUID());

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
