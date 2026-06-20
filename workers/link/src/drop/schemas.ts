import { z } from "zod";

export const createUploadSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    contentType: z.string().max(120).optional(),
    sizeBytes: z.number().int().positive(),
    storedSizeBytes: z.number().int().positive().optional(),
    storageEncoding: z.enum(["gzip", "aes-256-gcm"]).optional(),
    retentionSeconds: z.number().int().positive().optional(),
    maxDownloads: z.number().int().positive().optional(),
    password: z.string().min(8).max(128).optional(),
    recipients: z
      .array(
        z.object({
          userId: z.string().min(1).max(64),
          sealedKey: z.string().min(40).max(512),
        }),
      )
      .max(10)
      .optional(),
  })
  .superRefine((value, context) => {
    const storedSize = value.storedSizeBytes ?? value.sizeBytes;
    const sizeMatchesEncoding =
      value.storageEncoding === "gzip"
        ? storedSize < value.sizeBytes
        : value.storageEncoding === "aes-256-gcm"
          ? storedSize > value.sizeBytes
          : storedSize === value.sizeBytes;
    if (!sizeMatchesEncoding) {
      context.addIssue({
        code: "custom",
        message: "Stored size does not match the declared storage encoding.",
        path: ["storedSizeBytes"],
      });
    }
    if (value.recipients?.length && value.storageEncoding !== "aes-256-gcm") {
      context.addIssue({
        code: "custom",
        message: "Recipient sharing requires end-to-end encryption.",
        path: ["recipients"],
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
