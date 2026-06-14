import { INTERNAL_HOSTS, INTERNAL_URLS } from "@kleavox/config";
import { verifySession } from "@kleavox/auth";
import { requireRole, securityHeaders } from "@kleavox/worker";
import { Hono } from "hono";
import { z } from "zod";

import { sendReportEmail } from "./lib/mail";
import { registerAdminRoutes } from "./routes/admin";
import { registerAgentRoutes } from "./routes/agent";
import {
  invalidRequest,
  readJson,
  type PulseContext,
  type PulseEnv,
} from "./routes/shared";

const app = new Hono<PulseEnv>();

app.onError((error, context) => {
  console.error("[pulse]", error);
  return context.json(
    {
      code: "INTERNAL_ERROR",
      message: "Pulse could not complete the request.",
    },
    500,
  );
});

app.use("*", securityHeaders({ referrerPolicy: "same-origin" }));

app.get("/health", (context) =>
  context.json({ service: "pulse", status: "ok" }),
);

const requireAdmin = requireRole<PulseEnv>(
  "ADMIN",
  "Pulse is restricted to the operator.",
);

app.get("/api/session", async (context) => {
  const session = await verifySession(context.req.raw, context.env.PASS);
  return session
    ? context.json({ authenticated: true, identity: session.identity })
    : context.json({ authenticated: false });
});

app.post("/internal/report-notify", async (context) => {
  if (new URL(context.req.url).hostname !== INTERNAL_HOSTS.PULSE) {
    return context.body(null, 404);
  }

  const body = z
    .object({
      kind: z.enum(["link", "file"]),
      reason: z.string().max(100),
      target: z.string().max(2048),
    })
    .safeParse(await readJson(context));
  if (!body.success) return invalidRequest(context);

  try {
    const response = await context.env.PASS.fetch(INTERNAL_URLS.ADMINS_LOOKUP);
    if (response.ok) {
      const { emails } = await response.json<{ emails: string[] }>();
      await sendReportEmail(context.env, {
        to: emails,
        kind: body.data.kind,
        reason: body.data.reason,
        target: body.data.target,
      });
    }
  } catch (error) {
    console.error("[pulse report-notify]", error);
  }
  return context.json({ ok: true });
});

app.all("/api/admin/link/*", requireAdmin, (context) =>
  proxyAdmin(
    context,
    context.env.LINK,
    INTERNAL_HOSTS.LINK,
    context.req.path.replace(/^\/api\/admin\/link/u, "/api"),
  ),
);

app.all("/api/admin/drop/*", requireAdmin, (context) =>
  proxyAdmin(
    context,
    context.env.LINK,
    INTERNAL_HOSTS.LINK,
    context.req.path.replace(/^\/api\/admin\/drop/u, "/api"),
  ),
);

registerAdminRoutes(app, requireAdmin);
registerAgentRoutes(app);

app.all("*", (context) => context.env.ASSETS.fetch(context.req.raw));

function proxyAdmin(
  context: PulseContext,
  binding: Fetcher,
  hostname: string,
  pathname: string,
) {
  const destination = new URL(context.req.url);
  destination.hostname = hostname;
  destination.pathname = pathname;
  return binding.fetch(new Request(destination, context.req.raw));
}

export { app };
