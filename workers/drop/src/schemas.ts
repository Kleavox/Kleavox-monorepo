import { z } from "zod";

export const createUploadSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    contentType: z.string().max(120).optional(),
    sizeBytes: z.number().int().positive(),
    storedSizeBytes: z.number().int().positive().optional(),
    storageEncoding: z.enum(["gzip"]).optional(),
    retentionSeconds: z.number().int().positive().optional(),
    maxDownloads: z.number().int().positive().optional(),
    password: z.string().min(8).max(128).optional(),
    turnstileToken: z.string().max(4096).optional(),
  })
  .superRefine((value, context) => {
    const storedSize = value.storedSizeBytes ?? value.sizeBytes;
    if (storedSize > value.sizeBytes) {
      context.addIssue({
        code: "custom",
        message: "Stored size cannot exceed original size.",
        path: ["storedSizeBytes"],
      });
    }
    if (Boolean(value.storageEncoding) !== storedSize < value.sizeBytes) {
      context.addIssue({
        code: "custom",
        message: "Compression metadata does not match stored size.",
        path: ["storageEncoding"],
      });
    }
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
