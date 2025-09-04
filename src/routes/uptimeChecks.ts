import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import { createCheckSchema, updateCheckSchema } from "../schemas/uptime.js";

export default async function uptimeRoutes(app: FastifyInstance) {
  app.post("/checks", async (req, reply) => {
    try {
      const parsed = createCheckSchema.parse(req.body);
      const created = await prisma.uptimeCheck.create({ data: parsed });
      return reply.code(201).send(created);
    } catch (e: any) {
      if (e?.code === "P2002") {
        return reply.code(409).send({ error: "Duplicate value", fields: e.meta?.target });
      }
      if (e instanceof z.ZodError) {
        return reply.code(400).send({ error: "Invalid input", issues: e.issues });
      }
      throw e;
    }
  });

  app.get("/checks", async () => {
    return prisma.uptimeCheck.findMany({ orderBy: { createdAt: "desc" } });
  });

  app.get("/checks/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const check = await prisma.uptimeCheck.findUnique({ where: { id } });
    if (!check) return reply.code(404).send({ error: "Not found" });
    return check;
  });

  app.patch("/checks/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const data = updateCheckSchema.parse(req.body ?? {});
      const updated = await prisma.uptimeCheck.update({ where: { id }, data });
      return reply.send(updated);
    } catch (e: any) {
      if (e?.code === "P2025") return reply.code(404).send({ error: "Not found" });
      if (e?.code === "P2002") return reply.code(409).send({ error: "Duplicate value", fields: e.meta?.target });
      if (e instanceof z.ZodError) return reply.code(400).send({ error: "Invalid input", issues: e.issues });
      throw e;
    }
  });

  app.post("/checks/:id/logs", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      status: z.number().int().nullable().optional(),
      latencyMs: z.number().int().nullable().optional(),
      error: z.string().nullable().optional(),
    }).parse(req.body);

    const created = await prisma.uptimeLog.create({
      data: { checkId: id, status: body.status ?? undefined, latencyMs: body.latencyMs ?? undefined, error: body.error ?? undefined },
    });
    return reply.code(201).send(created);
  });

  app.get("/checks/:id/logs", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req) => {
    const { id } = req.params as { id: string };
    return prisma.uptimeLog.findMany({
      where: { checkId: id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  });

  app.get("/summary", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const checks = await prisma.uptimeCheck.findMany({
      orderBy: { createdAt: "desc" },
    });
    if (checks.length === 0) return [];

    const logs24h = await prisma.uptimeLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 20_000,
    });

    const byCheck = new Map<string, { last?: any; total: number; ok: number; sumLatency: number; latCount: number }>();
    for (const c of checks) {
      byCheck.set(c.id, { total: 0, ok: 0, sumLatency: 0, latCount: 0 });
    }

    for (const log of logs24h) {
      const stat = byCheck.get(log.checkId);
      if (!stat) continue;
      if (!stat.last) stat.last = log;

      stat.total += 1;
      if (typeof log.status === "number" && log.status >= 200 && log.status < 400) {
        stat.ok += 1;
      }
      if (typeof log.latencyMs === "number") {
        stat.sumLatency += log.latencyMs;
        stat.latCount += 1;
      }
    }

    const needLast = checks.filter(c => !byCheck.get(c.id)?.last).map(c => c.id);
    if (needLast.length > 0) {
      for (const id of needLast) {
        const latest = await prisma.uptimeLog.findFirst({
          where: { checkId: id },
          orderBy: { createdAt: "desc" },
        });
        const stat = byCheck.get(id);
        if (stat && latest) stat.last = latest;
      }
    }

    return checks.map((c) => {
      const stat = byCheck.get(c.id)!;
      const uptimePct = stat.total > 0 ? Math.round((stat.ok / stat.total) * 1000) / 10 : null;
      const avgLatency = stat.latCount > 0 ? Math.round(stat.sumLatency / stat.latCount) : null;
      const last = stat.last
        ? {
            status: stat.last.status ?? null,
            latencyMs: stat.last.latencyMs ?? null,
            error: stat.last.error ?? null,
            at: stat.last.createdAt,
          }
        : null;

      return {
        id: c.id,
        name: c.name,
        targetUrl: c.targetUrl,
        enabled: c.enabled,
        intervalSec: c.intervalSec,
        last,
        metrics24h: {
          uptimePct,
          avgLatencyMs: avgLatency,
          samples: stat.total 
        }
      };
    });
  });

  app.get("/overview", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req) => {
    const hours = Number((req.query as any).hours ?? 24);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const checks = await prisma.uptimeCheck.findMany();

    const latestLogs = await Promise.all(checks.map(c =>
      prisma.uptimeLog.findFirst({
        where: { checkId: c.id, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
      })
    ));

    let healthy = 0, degraded = 0, down = 0, sumLatency = 0, latencyCount = 0;

    for (const log of latestLogs) {
      if (!log) continue;
      if (log.status && log.status >= 200 && log.status < 400) {
        healthy++;
      } else if (log.status && log.status >= 400 && log.status < 500) {
        degraded++;
      } else {
        down++;
      }
      if (typeof log.latencyMs === "number") {
        sumLatency += log.latencyMs;
        latencyCount++;
      }
    }

    return {
      totalChecks: checks.length,
      healthy,
      degraded,
      down,
      avgLatencyMs: latencyCount > 0 ? Math.round(sumLatency / latencyCount) : null
    };
  });

  app.delete("/checks/:id", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await prisma.uptimeCheck.delete({ where: { id } });
      return reply.code(204).send();
    } catch (e: any) {
      if (e?.code === "P2025") {
        return reply.code(404).send({ error: "Not found" });
      }
      throw e;
    }
  });

  app.delete("/logs/:logId", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { logId } = req.params as { logId: string };
    try {
      await prisma.uptimeLog.delete({ where: { id: logId } });
      return reply.code(204).send();
    } catch (e: any) {
      if (e?.code === "P2025") {
        return reply.code(404).send({ error: "Not found" });
      }
      throw e;
    }
  });
}