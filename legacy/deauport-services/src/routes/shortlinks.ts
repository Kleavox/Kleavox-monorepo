import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { createShortlinkSchema } from "../schemas/shortlink.js";
import { z } from "zod";

export default async function shortlinkRoutes(app: FastifyInstance) {
  app.post("/", async (req, reply) => {
    try {
      const data = createShortlinkSchema.parse(req.body);
      const created = await prisma.shortLink.create({ data });
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

  app.get("/", async () => {
    return prisma.shortLink.findMany({ orderBy: { createdAt: "desc" } });
  });

  app.get("/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const link = await prisma.shortLink.findUnique({ where: { slug } });
    if (!link) return reply.code(404).send({ error: "Not found" });
    return link;
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Partial<{ targetUrl: string; enabled: boolean }>;
    try {
      const updated = await prisma.shortLink.update({ where: { id }, data: body });
      return updated;
    } catch (e: any) {
      if (e?.code === "P2025") return reply.code(404).send({ error: "Not found" });
      if (e?.code === "P2002") return reply.code(409).send({ error: "Duplicate value", fields: e.meta?.target });
      throw e;
    }
  });

  app.get("/stats/top", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req) => {
    const limit = Number((req.query as any).limit ?? 10);
    return prisma.shortLink.findMany({
      orderBy: { hits: "desc" },
      take: limit,
    });
  });
  
  app.delete("/:id", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await prisma.shortLink.delete({ where: { id } });
      return reply.code(204).send();
    } catch (e: any) {
      if (e?.code === "P2025") {
        return reply.code(404).send({ error: "Not found" });
      }
      throw e;
    }
  });
}