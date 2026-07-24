import { z } from "zod";

export const agentHostSchema = z.object({
  hostname: z.string().min(1).max(255),
  operatingSystem: z.string().min(1).max(64),
  architecture: z.string().min(1).max(64),
  agentVersion: z.string().min(1).max(64),
});

export const metricSnapshotSchema = z.object({
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

export const agentHeartbeatSchema = agentHostSchema.extend({
  nodeId: z.string().uuid(),
  metrics: metricSnapshotSchema,
});

export const checkResultSchema = z.object({
  checkId: z.string().uuid(),
  status: z.enum(["UP", "DOWN"]),
  latencyMs: z.number().int().nonnegative().nullable(),
  message: z.string().max(500).nullable(),
  checkedAt: z.string().datetime().optional(),
});

export const agentResultsRequestSchema = z.object({
  nodeId: z.string().uuid(),
  results: z.array(checkResultSchema).max(100),
});

export const enrollmentResponseSchema = z.object({
  nodeId: z.string().uuid(),
  token: z.string().min(1),
  intervalSeconds: z.number().int().positive(),
});

export const heartbeatResponseSchema = z.object({
  ok: z.literal(true),
  intervalSeconds: z.number().int().positive(),
});

export const agentCheckSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  kind: z.enum(["HTTP", "TCP", "SERVICE"]),
  target: z.string().min(1),
  timeoutSeconds: z.number().int().positive(),
});

export const agentConfigResponseSchema = z.object({
  nodeId: z.string().uuid(),
  intervalSeconds: z.number().int().positive(),
  checks: z.array(agentCheckSchema),
});

export type AgentHost = z.infer<typeof agentHostSchema>;
export type MetricSnapshot = z.infer<typeof metricSnapshotSchema>;
export type AgentHeartbeat = z.infer<typeof agentHeartbeatSchema>;
export type CheckResult = z.infer<typeof checkResultSchema>;
export type AgentResultsRequest = z.infer<typeof agentResultsRequestSchema>;
export type EnrollmentResponse = z.infer<typeof enrollmentResponseSchema>;
export type HeartbeatResponse = z.infer<typeof heartbeatResponseSchema>;
export type AgentCheck = z.infer<typeof agentCheckSchema>;
export type AgentConfigResponse = z.infer<typeof agentConfigResponseSchema>;
