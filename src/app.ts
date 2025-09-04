import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import rateLimit from "@fastify/rate-limit";
import uptimeRoutes from "./routes/uptimeChecks.js";
import shortlinkRoutes from "./routes/shortlinks.js";
import { prisma } from "./lib/prisma.js";

const API_KEY = process.env.API_KEY;

export function buildApp() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
    trustProxy: true,
  });

  app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
    hook: "onRequest", 
    keyGenerator: (req) =>
      (typeof req.headers["x-api-key"] === "string" && req.headers["x-api-key"]) ?
        `key:${req.headers["x-api-key"]}` :
        `ip:${req.ip}`,
    skipOnError: true,
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
      "retry-after": true,
    },
  });

  app.get("/health", {
    config: { rateLimit: false }
  }, async () => ({
    ok: true, service: "deauport-services", time: new Date().toISOString()
  }));

  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.url.startsWith("/api")) return;
    const m = req.method.toUpperCase();
    const isWrite = m === "POST" || m === "PATCH" || m === "DELETE" || m === "PUT";
    if (!isWrite) return;

    if (!API_KEY) return;
    if (req.headers["x-api-key"] !== API_KEY) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });

  app.register(uptimeRoutes, { prefix: "/api/uptime" });
  app.register(shortlinkRoutes, { prefix: "/api/shortlinks" });

  app.get("/:slug", {
    config: { rateLimit: false }
  }, async (req, reply) => {
    const { slug } = req.params as { slug: string };
    if (slug === "api") return reply.callNotFound();

    const link = await prisma.shortLink.findUnique({ where: { slug } });
    if (!link || !link.enabled) return reply.code(404).send({ error: "Not found" });

    prisma.shortLink.update({ where: { id: link.id }, data: { hits: { increment: 1 } } }).catch(() => {});
    return reply.redirect(link.targetUrl, 302);
  });

  return app;
}