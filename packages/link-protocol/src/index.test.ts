import { describe, expect, it } from "vitest";

import {
  accountDropSchema,
  createUploadRequestSchema,
  dropSessionResponseSchema,
} from "./index";

describe("Link protocol v1", () => {
  it("rejects recipient sharing without encrypted storage", () => {
    const result = createUploadRequestSchema.safeParse({
      name: "private.txt",
      sizeBytes: 10,
      recipients: [{ userId: "user-1", sealedKey: "x".repeat(40) }],
    });

    expect(result.success).toBe(false);
  });

  it("keeps account Drop payloads camelCase and boolean", () => {
    const result = accountDropSchema.safeParse({
      id: "drop-1",
      publicToken: "f_token",
      name: "file.txt",
      contentType: "text/plain",
      sizeBytes: 5,
      storedSizeBytes: 5,
      storageEncoding: null,
      encryption: null,
      maxDownloads: null,
      downloadCount: 0,
      expiresAt: "2026-07-18T00:00:00.000Z",
      status: "ACTIVE",
      createdAt: "2026-07-18T00:00:00.000Z",
      completedAt: null,
      protected: false,
      shared: false,
    });

    expect(result.success).toBe(true);
    expect(
      accountDropSchema.safeParse({ public_token: "f_token" }).success,
    ).toBe(false);
  });

  it("makes authenticated session identity explicit", () => {
    expect(
      dropSessionResponseSchema.safeParse({
        authenticated: true,
        user: {
          id: "user-1",
          email: "user@example.com",
          username: "user",
          role: "USER",
        },
        policy: {
          kind: "user",
          maxFileBytes: 1,
          maxActiveBytes: 1,
          retentionOptions: [3600],
          maxDownloads: 1,
          defaultDownloads: 1,
          partSizeBytes: 1,
        },
      }).success,
    ).toBe(true);
  });
});
