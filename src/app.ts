import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import uptimeRoutes from "./routes/uptimeChecks.js";
import shortlinkRoutes from "./routes/shortlinks.js";
import recapRoutes from "./routes/recap.js";
import importRoutes from "./routes/import.js";
import { prisma } from "./lib/prisma.js";

const API_KEY = (process.env.API_KEY ?? "").trim();
const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "http://localhost:3000";

export function buildApp() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
    trustProxy: true,
  });

  app.register(multipart);

  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allow = [
        /^http:\/\/localhost:3000$/,
        /^https?:\/\/deauport\.id$/,
        /^https?:\/\/apps\.deauport\.id$/,
      ];
      cb(null, allow.some((r) => r.test(origin)));
    },
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "x-api-key"],
    credentials: true,
  });

  app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
    hook: "onRequest",
    keyGenerator: (req) => {
      const k = req.headers["x-api-key"];
      return typeof k === "string" && k.length > 0 ? `key:${k}` : `ip:${req.ip}`;
    },
    skipOnError: true,
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
      "retry-after": true,
    },
  });

  app.addHook("onRequest", async (req, reply) => {
    if (!req.url.startsWith("/api")) return;
    const m = req.method.toUpperCase();
    const isWrite = m === "POST" || m === "PATCH" || m === "DELETE" || m === "PUT";
    if (!isWrite) return;

    if (!API_KEY) return;

    const header = (req.headers["x-api-key"] as string | undefined)?.trim() ?? "";
    if (header !== API_KEY) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });

  app.get(
    "/health",
    { config: { rateLimit: false } },
    async () => ({ ok: true, service: "deauport-services", time: new Date().toISOString() })
  );

  app.register(uptimeRoutes, { prefix: "/api/uptime" });
  app.register(shortlinkRoutes, { prefix: "/api/shortlinks" });
  app.register(recapRoutes, { prefix: "/api/recap" });
  app.register(importRoutes, { prefix: "/api/import" });

  app.get(
    "/:slug",
    { config: { rateLimit: false } },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      if (slug === "api" || !slug) return reply.callNotFound();

      const link = await prisma.shortLink.findUnique({ where: { slug } });
      if (!link || !link.enabled) {
        return reply.code(404).send({ error: "Not found" });
      }

      prisma.shortLink.update({
        where: { id: link.id },
        data: { hits: { increment: 1 } },
      }).catch((e) => app.log.error(e, "Failed to increment shortlink hits"));

      const interstitialUrl = new URL(`/link/${slug}`, DASHBOARD_URL);
      return reply.redirect(interstitialUrl.toString(), 302);
    }
  );

  return app;
}