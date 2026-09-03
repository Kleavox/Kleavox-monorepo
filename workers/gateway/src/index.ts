import { readCookie, verifySession } from "@kleavox/auth";
import { INTERNAL_URLS, SESSION_COOKIE } from "@kleavox/config";
import { isFileSlug, isReservedSlug, renderErrorPage } from "@kleavox/core";
import {
  INTERNAL_HOSTS,
  localWorkerOrigin,
  publicHost,
  publicOrigin,
} from "@kleavox/topology";
import { Hono } from "hono";

import { hostRedirect } from "./hosts";
import {
  buildOverview,
  toOverviewParts,
  type DropList,
  type FileReportList,
  type LinkPage,
  type OverviewOrigins,
  type PassSessions,
  type PulseRows,
  type ReportList,
} from "./overview";

export interface Env {
  ASSETS: Fetcher;
  LINK: Fetcher;
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
      service: "Kleavox",
      code: "500",
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

async function part<T>(
  fetcher: Fetcher,
  url: string,
  original: Request,
  isValid?: (value: unknown) => value is T,
): Promise<T | null> {
  try {
    const response = await fetcher.fetch(url, {
      headers: { cookie: original.headers.get("cookie") ?? "" },
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (isValid && !isValid(body)) return null;
    return body as T;
  } catch {
    return null;
  }
}

function isPassSessions(value: unknown): value is PassSessions {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { sessions?: unknown }).sessions)
  );
}

function isLinkPage(value: unknown): value is LinkPage {
  if (typeof value !== "object" || value === null) return false;
  const meta = (value as { meta?: unknown }).meta;
  return (
    typeof meta === "object" &&
    meta !== null &&
    typeof (meta as { total?: unknown }).total === "number"
  );
}

function isDropList(value: unknown): value is DropList {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { drops?: unknown }).drops)
  );
}

function isReportList(value: unknown): value is ReportList {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { reports?: unknown }).reports)
  );
}

function isFileReportList(value: unknown): value is FileReportList {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { reports?: unknown }).reports)
  );
}

function isPulseRows(value: unknown): value is PulseRows {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as {
    nodes?: unknown;
    checks?: unknown;
    incidents?: unknown;
  };
  return (
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.checks) &&
    Array.isArray(candidate.incidents)
  );
}

function originsForHost(hostname: string): OverviewOrigins {
  if (hostname === "127.0.0.1" || hostname === "localhost") {
    return {
      link: localWorkerOrigin("link", hostname),
      pulse: localWorkerOrigin("pulse", hostname),
    };
  }
  return {
    link: publicOrigin(hostname, "link"),
    pulse: publicOrigin(hostname, "pulse"),
  };
}

function originsFor(
  request: Request,
  publicOriginUrl: string,
): {
  allowed: Set<string>;
  targets: OverviewOrigins;
} {
  const publicHostname = new URL(publicOriginUrl).hostname;
  const { link, pulse } = originsForHost(publicHostname);
  const allowed =
    publicHostname === "127.0.0.1" || publicHostname === "localhost"
      ? new Set([
          link,
          pulse,
          localWorkerOrigin("pass", publicHostname),
          localWorkerOrigin("gateway", publicHostname),
        ])
      : new Set([
          link,
          pulse,
          publicOrigin(publicHostname, "pass"),
          publicOrigin(publicHostname, "gateway"),
        ]);

  const requestHostname = new URL(request.url).hostname;
  const targets = originsForHost(requestHostname);

  return { allowed, targets };
}

function corsHeaders(
  request: Request,
  allowed: Set<string>,
): Record<string, string> {
  const origin = request.headers.get("Origin");
  if (origin === null || !allowed.has(origin)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

app.options("/api/estate", (context) => {
  const { allowed } = originsFor(context.req.raw, context.env.PUBLIC_ORIGIN);
  return context.body(null, 204, {
    ...corsHeaders(context.req.raw, allowed),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
});

app.get("/api/estate", async (context) => {
  const { allowed, targets } = originsFor(
    context.req.raw,
    context.env.PUBLIC_ORIGIN,
  );
  const cors = corsHeaders(context.req.raw, allowed);

  const session = await verifySession(context.req.raw, context.env.PASS);
  if (!session) {
    return context.json({ code: "UNAUTHENTICATED" }, 401, cors);
  }

  const raw = context.req.raw;
  const PASS_BASE = `http://${INTERNAL_HOSTS.PASS}`;
  const LINK_BASE = `http://${INTERNAL_HOSTS.LINK}`;
  const PULSE_BASE = `http://${INTERNAL_HOSTS.PULSE}`;

  const [sessions, links, drops, reports, fileReports, pulseRows] =
    await Promise.all([
      part<PassSessions>(
        context.env.PASS,
        `${PASS_BASE}/api/sessions`,
        raw,
        isPassSessions,
      ),
      part<LinkPage>(
        context.env.LINK,
        `${LINK_BASE}/api/links?limit=1`,
        raw,
        isLinkPage,
      ),
      part<DropList>(
        context.env.LINK,
        `${LINK_BASE}/api/drops`,
        raw,
        isDropList,
      ),
      part<ReportList>(
        context.env.LINK,
        `${LINK_BASE}/api/admin/reports`,
        raw,
        isReportList,
      ),
      part<FileReportList>(
        context.env.LINK,
        `${LINK_BASE}/api/admin/file-reports`,
        raw,
        isFileReportList,
      ),
      part<PulseRows>(
        context.env.PULSE,
        `${PULSE_BASE}/api/overview`,
        raw,
        isPulseRows,
      ),
    ]);

  const parts = toOverviewParts({
    sessions,
    links,
    drops,
    reports,
    fileReports,
    pulseRows,
  });

  return context.json(
    buildOverview(parts, session.identity.role, targets),
    200,
    {
      ...cors,
      "Cache-Control": "private, no-store",
    },
  );
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
  url.hostname = INTERNAL_HOSTS.LINK;
  return context.env.LINK.fetch(new Request(url, context.req.raw));
});

app.all("/api/drop/*", (context) => {
  const url = new URL(context.req.url);
  url.hostname = INTERNAL_HOSTS.LINK;
  return context.env.LINK.fetch(new Request(url, context.req.raw));
});

app.all("/link-assets/*", (context) => {
  const url = new URL(context.req.url);
  url.hostname = INTERNAL_HOSTS.LINK;
  return context.env.LINK.fetch(new Request(url, context.req.raw));
});

const PASS_AUTH_ROUTES = ["/api/auth/otp/start", "/api/auth/otp/verify"];

function passCookieUrl(requestUrl: string, publicOriginUrl: string): URL {
  const url = new URL(requestUrl);
  const rootDomain = new URL(publicOriginUrl).hostname.toLowerCase();
  const hostname = url.hostname.toLowerCase();
  if (hostname === rootDomain || hostname.endsWith(`.${rootDomain}`)) {
    url.protocol = "https:";
    url.hostname = publicHost(rootDomain, "pass");
    url.port = "";
  }
  return url;
}

app.on("POST", PASS_AUTH_ROUTES, async (context) => {
  const origin = context.req.header("origin");
  const requestOrigin = new URL(context.req.url).origin;
  const trustedOrigins = new Set([context.env.PUBLIC_ORIGIN, requestOrigin]);
  if (!origin || !trustedOrigins.has(origin)) {
    return context.json({ code: "INVALID_ORIGIN" }, 403);
  }

  const url = passCookieUrl(context.req.url, context.env.PUBLIC_ORIGIN);
  const headers = new Headers(context.req.raw.headers);
  headers.set("origin", url.origin);
  headers.delete("referer");

  return context.env.PASS.fetch(
    new Request(url, {
      method: context.req.method,
      headers,
      body: context.req.raw.body,
      duplex: "half",
    } as RequestInit & { duplex: "half" }),
  );
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

  const assetResponse = await context.env.ASSETS.fetch(context.req.raw);
  if (
    assetResponse.status === 404 &&
    (context.req.header("accept") ?? "").includes("text/html")
  ) {
    return context.html(
      renderErrorPage({
        service: "Kleavox",
        code: "404",
        title: "Page not found",
        message:
          "This page does not exist, or the short link or file has expired.",
      }),
      404,
      {
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      },
    );
  }
  return assetResponse;
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
