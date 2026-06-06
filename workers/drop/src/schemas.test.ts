import { describe, expect, it } from "vitest";

import { createUploadSchema } from "./schemas";

describe("createUploadSchema compression metadata", () => {
  const base = {
    name: "report.txt",
    contentType: "text/plain",
    sizeBytes: 10_000,
  };

  it("accepts an uncompressed upload", () => {
    expect(createUploadSchema.safeParse(base).success).toBe(true);
  });

  it("accepts gzip only when stored bytes are smaller", () => {
    expect(
      createUploadSchema.safeParse({
        ...base,
        storedSizeBytes: 2_000,
        storageEncoding: "gzip",
      }).success,
    ).toBe(true);
  });

  it("rejects inconsistent compression metadata", () => {
    expect(
      createUploadSchema.safeParse({
        ...base,
        storedSizeBytes: 2_000,
      }).success,
    ).toBe(false);
    expect(
      createUploadSchema.safeParse({
        ...base,
        storedSizeBytes: 10_000,
        storageEncoding: "gzip",
      }).success,
    ).toBe(false);
    expect(
      createUploadSchema.safeParse({
        ...base,
        storedSizeBytes: 12_000,
      }).success,
    ).toBe(false);
  });
});
