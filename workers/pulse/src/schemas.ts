import { z } from "zod";

export const hostSchema = z.object({
  hostname: z.string().min(1).max(255),
  operatingSystem: z.string().min(1).max(64),
  architecture: z.string().min(1).max(64),
  agentVersion: z.string().min(1).max(64),
});

const metricsSchema = z.object({
  cpuPercent: z.number().min(0).max(100).nullable(),
  memoryUsedBytes: z.number().int().nonnegative().nullable(),
  memoryTotalBytes: z.number().int().nonnegative().nullable(),
  diskUsedBytes: z.number().int().nonnegative().nullable(),
  diskTotalBytes: z.number().int().nonnegative().nullable(),
  load1: z.number().nonnegative().nullable(),
  load5: z.number().nonnegative().nullable(),
  load15: z.number().nonnegative().nullable(),
  uptimeSeconds: z.number().int().nonnegative().nullable(),
});

export const heartbeatSchema = hostSchema.extend({
  nodeId: z.string().uuid(),
  metrics: metricsSchema,
});

export const resultSchema = z.object({
  nodeId: z.string().uuid(),
  results: z
    .array(
      z.object({
        checkId: z.string().uuid(),
        status: z.enum(["UP", "DOWN"]),
        latencyMs: z.number().int().nonnegative().nullable(),
        message: z.string().max(500).nullable(),
        checkedAt: z.string().datetime().optional(),
      }),
    )
    .max(100),
});
