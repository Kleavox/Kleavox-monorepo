import { securityHeaders } from "@kleavox/worker";
import { Hono } from "hono";

import { registerAccountRoutes } from "./routes/account";
import { registerAuthRoutes } from "./routes/auth";
import { registerInternalRoutes } from "./routes/internal";
import { registerOAuthRoutes } from "./routes/oauth";
import { apiError, type AppEnv } from "./routes/shared";

const app = new Hono<AppEnv>();

app.onError((cause, context) => {
  console.error("[pass]", cause);
  if (/no such table/i.test(String(cause))) {
    return context.json(
      {
        code: "service_not_ready",
        message: "Pass database migrations have not been applied.",
      },
      503,
    );
  }
  return context.json(
    {
      code: "internal_error",
      message: "Pass could not complete the request.",
    },
    500,
  );
});

app.use("*", securityHeaders({ referrerPolicy: "same-origin" }));

app.use("/api/*", async (context, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(context.req.method)) {
    return next();
  }

  const contentType = context.req.header("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return apiError(
      context,
      415,
      "unsupported_media_type",
      "Use application/json.",
    );
  }

  const origin = context.req.header("origin");
  const requestOrigin = new URL(context.req.url).origin;
  const trustedOrigins = new Set([context.env.PUBLIC_ORIGIN, requestOrigin]);

  if (
    (origin && !trustedOrigins.has(origin)) ||
    (!origin && context.env.ENVIRONMENT === "production")
  ) {
    return apiError(context, 403, "invalid_origin", "Request origin rejected.");
  }

  const referer = context.req.header("referer");
  if (
    context.env.ENVIRONMENT === "production" &&
    referer &&
    !referer.startsWith(context.env.PUBLIC_ORIGIN) &&
    !referer.startsWith(requestOrigin)
  ) {
    return apiError(
      context,
      403,
      "invalid_referer",
      "Cross-site request blocked.",
    );
  }

  return next();
});

app.get("/health", (context) =>
  context.json({ service: "pass", status: "ok" }),
);

app.get("/ready", async (context) => {
  const result = await context.env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM sqlite_master
     WHERE type = 'table'
       AND name IN (
         'users', 'identities', 'verification_tokens', 'auth_events',
         'account_keys'
       )`,
  ).first<{ total: number }>();
  const ready = result?.total === 5;
  return context.json(
    { service: "pass", status: ready ? "ready" : "migration_required" },
    ready ? 200 : 503,
  );
});

registerOAuthRoutes(app);
registerAccountRoutes(app);
registerAuthRoutes(app);
registerInternalRoutes(app);

app.all("*", (context) => context.env.ASSETS.fetch(context.req.raw));

export default app;
