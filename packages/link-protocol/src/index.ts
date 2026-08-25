import { z } from "zod";

const roleSchema = z.enum(["ADMIN", "USER"]);
const storageEncodingSchema = z.enum(["gzip", "aes-256-gcm"]);

export const dropPolicySchema = z.object({
  kind: z.enum(["guest", "user"]),
  maxFileBytes: z.number().int().positive(),
  maxActiveBytes: z.number().int().positive(),
  retentionOptions: z.array(z.number().int().positive()),
  maxDownloads: z.number().int().positive(),
  defaultDownloads: z.number().int().positive(),
  partSizeBytes: z.number().int().positive(),
});

export const dropSessionResponseSchema = z.discriminatedUnion("authenticated", [
  z.object({
    authenticated: z.literal(false),
    policy: dropPolicySchema,
  }),
  z.object({
    authenticated: z.literal(true),
    user: z.object({
      id: z.string().min(1),
      email: z.string().email(),
      username: z.string().nullable(),
      role: roleSchema,
    }),
    policy: dropPolicySchema,
  }),
]);

export const createUploadRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    contentType: z.string().max(120).optional(),
    sizeBytes: z.number().int().positive(),
    storedSizeBytes: z.number().int().positive().optional(),
    storageEncoding: storageEncodingSchema.optional(),
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

export const uploadStartResponseSchema = z.object({
  uploadId: z.string().min(1),
  manageToken: z.string().min(1),
  publicToken: z.string().min(1),
  shareUrl: z.string().url(),
  partSizeBytes: z.number().int().positive(),
  partCount: z.number().int().positive(),
  expiresAt: z.string().datetime(),
  maxDownloads: z.number().int().positive().nullable(),
});

export const accountDropSchema = z.object({
  id: z.string().min(1),
  publicToken: z.string().min(1),
  name: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  storedSizeBytes: z.number().int().positive(),
  storageEncoding: storageEncodingSchema.nullable(),
  encryption: z.literal("aes-256-gcm").nullable(),
  maxDownloads: z.number().int().positive().nullable(),
  downloadCount: z.number().int().nonnegative(),
  expiresAt: z.string(),
  status: z.enum(["ACTIVE", "EXHAUSTED", "DELETING", "DELETED", "FAILED"]),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  protected: z.boolean(),
  shared: z.boolean(),
});

export const accountDropsResponseSchema = z.object({
  drops: z.array(accountDropSchema),
});

export const publicDropSchema = z.object({
  name: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  storedSizeBytes: z.number().int().positive(),
  storageEncoding: storageEncodingSchema.nullable(),
  compressed: z.boolean(),
  protected: z.boolean(),
  maxDownloads: z.number().int().positive().nullable(),
  downloadCount: z.number().int().nonnegative(),
  remainingDownloads: z.number().int().nonnegative().nullable(),
  expiresAt: z.string(),
  createdAt: z.string(),
  partSizeBytes: z.number().int().positive(),
  shared: z.boolean(),
});

export const recipientKeyResponseSchema = z.object({
  userId: z.string().nullable(),
  publicKey: z.string().nullable(),
});

export const accountKeyResponseSchema = z.object({
  salt: z.string().nullable(),
  wrappedPrivateKey: z.string().nullable(),
});

export const unlockDropRequestSchema = z.object({
  password: z.string().min(1).max(128),
});

export const reportDropRequestSchema = z.object({
  reason: z.enum(["MALWARE", "COPYRIGHT", "HARASSMENT", "OTHER"]),
  details: z.string().trim().max(500).optional(),
});

export const reportDropUpdateRequestSchema = z.object({
  status: z.enum(["OPEN", "RESOLVED", "REJECTED"]),
});

export type DropPolicy = z.infer<typeof dropPolicySchema>;
export type DropSessionResponse = z.infer<typeof dropSessionResponseSchema>;
export type CreateUploadRequest = z.infer<typeof createUploadRequestSchema>;
export type UploadStartResponse = z.infer<typeof uploadStartResponseSchema>;
export type AccountDrop = z.infer<typeof accountDropSchema>;
export type AccountDropsResponse = z.infer<typeof accountDropsResponseSchema>;
export type PublicDrop = z.infer<typeof publicDropSchema>;
