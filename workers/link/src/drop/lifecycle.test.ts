import { describe, expect, it, vi } from "vitest";

import type { Env } from "../env";
import { sha256 } from "./lib/crypto";
import { createDropLifecycle } from "./lifecycle";

describe("Drop lifecycle", () => {
  it("rejects an upload part before touching R2 when the manage token is wrong", async () => {
    const uploadPart = vi.fn();
    const env = lifecycleEnv({
      first(sql) {
        if (sql.includes("FROM upload_sessions")) {
          return uploadRecord({ manage_token_hash: "different" });
        }
        return null;
      },
      files: { uploadPart },
    });

    const result = await createDropLifecycle(env).storeUploadPart({
      uploadId: "upload-1",
      manageToken: "wrong",
      partNumber: 1,
      contentLength: 20,
      body: new ReadableStream(),
    });

    expect(result).toEqual({ status: "not_found" });
    expect(uploadPart).not.toHaveBeenCalled();
  });

  it("completes multipart storage and finalizes D1 through one interface", async () => {
    const manageToken = "manage-token";
    const complete = vi.fn(async () => undefined);
    const batch = vi.fn(async () => []);
    const env = lifecycleEnv({
      first(sql) {
        if (sql.includes("FROM upload_sessions")) {
          return uploadRecord({
            manage_token_hash: manageTokenHash,
            status: "OPEN",
          });
        }
        return null;
      },
      all(sql) {
        if (sql.includes("FROM upload_parts")) {
          return [{ part_number: 1, etag: "etag-1", size_bytes: 20 }];
        }
        return [];
      },
      batch,
      files: { complete },
    });
    const manageTokenHash = await sha256(manageToken);

    const result = await createDropLifecycle(env).completeUpload(
      "upload-1",
      manageToken,
    );

    expect(result).toEqual({
      status: "completed",
      dropId: "upload-1",
      publicToken: "f_public",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    expect(complete).toHaveBeenCalledWith([{ partNumber: 1, etag: "etag-1" }]);
    expect(batch).toHaveBeenCalledOnce();
  });

  it("lets an owner delete a public Drop and cleans recipient keys", async () => {
    const removeObject = vi.fn(async () => undefined);
    const runs: string[] = [];
    const env = lifecycleEnv({
      first(sql) {
        if (sql.includes("FROM drops")) {
          return {
            id: "drop-1",
            owner_user_id: "owner-1",
            manage_token_hash: null,
            object_key: "objects/drop-1",
            status: "ACTIVE",
          };
        }
        return null;
      },
      run(sql) {
        runs.push(sql);
        return { meta: { changes: 1 } };
      },
      files: { delete: removeObject },
    });

    const deleted = await createDropLifecycle(env).deletePublicDrop(
      "f_public",
      { userId: "owner-1", isAdmin: false, manageToken: null },
    );

    expect(deleted).toBe(true);
    expect(removeObject).toHaveBeenCalledWith("objects/drop-1");
    expect(runs.some((sql) => sql.includes("status = 'DELETED'"))).toBe(true);
    expect(
      runs.some((sql) => sql.includes("DELETE FROM drop_recipients")),
    ).toBe(true);
  });
});

type LifecycleOptions = {
  first?: (sql: string, bindings: unknown[]) => unknown;
  all?: (sql: string, bindings: unknown[]) => unknown[];
  run?: (sql: string, bindings: unknown[]) => unknown;
  batch?: ReturnType<typeof vi.fn>;
  files?: {
    uploadPart?: ReturnType<typeof vi.fn>;
    complete?: ReturnType<typeof vi.fn>;
    abort?: ReturnType<typeof vi.fn>;
    delete?: ReturnType<typeof vi.fn>;
    head?: ReturnType<typeof vi.fn>;
  };
};

function lifecycleEnv(options: LifecycleOptions): Env {
  const prepare = (sql: string) => {
    const bindings: unknown[] = [];
    const statement = {
      bind(...values: unknown[]) {
        bindings.push(...values);
        return statement;
      },
      async first() {
        return options.first?.(sql, bindings) ?? null;
      },
      async all() {
        return { results: options.all?.(sql, bindings) ?? [] };
      },
      async run() {
        return options.run?.(sql, bindings) ?? { meta: { changes: 1 } };
      },
    };
    return statement;
  };
  const multipart = {
    uploadPart: options.files?.uploadPart ?? vi.fn(),
    complete: options.files?.complete ?? vi.fn(),
    abort: options.files?.abort ?? vi.fn(),
  };
  return {
    DB: {
      prepare,
      batch: options.batch ?? vi.fn(async () => []),
    },
    FILES: {
      resumeMultipartUpload: vi.fn(() => multipart),
      delete: options.files?.delete ?? vi.fn(),
      head: options.files?.head ?? vi.fn(async () => null),
    },
  } as unknown as Env;
}

function uploadRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "upload-1",
    owner_user_id: "owner-1",
    manage_token_hash: "hash",
    public_token: "f_public",
    object_key: "objects/upload-1",
    r2_upload_id: "r2-upload-1",
    size_bytes: 20,
    part_count: 1,
    expires_at: "2099-01-01T00:00:00.000Z",
    upload_expires_at: "2099-01-01T00:00:00.000Z",
    status: "OPEN",
    ...overrides,
  };
}
