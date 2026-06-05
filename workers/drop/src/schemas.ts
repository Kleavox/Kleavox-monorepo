import { z } from "zod";

export const createUploadSchema = z.object({
  name: z.string().trim().min(1).max(255),
  contentType: z.string().max(120).optional(),
  sizeBytes: z.number().int().positive(),
  retentionSeconds: z.number().int().positive().optional(),
  maxDownloads: z.number().int().positive().optional(),
  password: z.string().min(8).max(128).optional(),
  turnstileToken: z.string().max(4096).optional(),
});

export const unlockSchema = z.object({
  password: z.string().min(1).max(128),
});

export const reportSchema = z.object({
  reason: z.enum(["MALWARE", "COPYRIGHT", "HARASSMENT", "OTHER"]),
  details: z.string().trim().max(500).optional(),
});

export const reportUpdateSchema = z.object({
  status: z.enum(["OPEN", "RESOLVED", "REJECTED"]),
});
