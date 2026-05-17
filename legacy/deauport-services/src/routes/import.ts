import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";

const importUptimeLogSchema = z.object({
  status: z.number().nullable(),
  latencyMs: z.number().nullable(),
  error: z.string().nullable(),
  createdAt: z.string().datetime(),
}).passthrough();

const importUptimeCheckSchema = z.array(z.object({
  name: z.string(),
  targetUrl: z.string().url(),
  intervalSec: z.number().int(),
  enabled: z.boolean(),
  logs: z.array(importUptimeLogSchema),
}).passthrough());

const importShortlinkSchema = z.array(z.object({
  slug: z.string(),
  targetUrl: z.string().url(),
  enabled: z.boolean(),
  hits: z.number().int(),
}).passthrough());


export default async function importRoutes(app: FastifyInstance) {
  app.post("/", async (req, reply) => {
    const data = await req.file();
    if (!data) {
      return reply.code(400).send({ error: "No file uploaded." });
    }

    try {
      const buffer = await data.toBuffer();
      const backup = JSON.parse(buffer.toString());

      if (!backup.data || !backup.data.uptimeChecks || !backup.data.shortlinks) {
        return reply.code(400).send({ error: "Invalid backup file structure." });
      }

      const checksToImport = importUptimeCheckSchema.parse(backup.data.uptimeChecks);
      const linksToImport = importShortlinkSchema.parse(backup.data.shortlinks);

      await prisma.$transaction(async (tx) => {
        app.log.info("Importing data: Clearing existing data...");
        await tx.uptimeLog.deleteMany({});
        await tx.uptimeCheck.deleteMany({});
        await tx.shortLink.deleteMany({});
        app.log.info("Existing data cleared.");

        for (const check of checksToImport) {
          const createdCheck = await tx.uptimeCheck.create({
            data: {
              name: check.name,
              targetUrl: check.targetUrl,
              intervalSec: check.intervalSec,
              enabled: check.enabled,
            }
          });

          if (check.logs && check.logs.length > 0) {
            await tx.uptimeLog.createMany({
              data: check.logs.map(log => ({
                checkId: createdCheck.id,
                status: log.status,
                latencyMs: log.latencyMs,
                error: log.error,
                createdAt: new Date(log.createdAt),
              }))
            });
          }
        }
        app.log.info(`${checksToImport.length} uptime checks and their logs created.`);

        if (linksToImport.length > 0) {
          await tx.shortLink.createMany({
            data: linksToImport.map(link => ({
              slug: link.slug,
              targetUrl: link.targetUrl,
              enabled: link.enabled,
              hits: link.hits,
            }))
          });
          app.log.info(`${linksToImport.length} shortlinks created.`);
        }
      });

      return { message: `Import successful. ${checksToImport.length} uptime checks and ${linksToImport.length} shortlinks have been restored.` };

    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return reply.code(400).send({ error: "Invalid file content.", issues: e.issues });
      }
      app.log.error(e, "Error during import");
      return reply.code(500).send({ error: "Failed to import data." });
    }
  });
}