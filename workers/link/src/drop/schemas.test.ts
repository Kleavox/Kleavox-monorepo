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

  it("accepts aes-256-gcm when stored bytes grow past the original", () => {
    expect(
      createUploadSchema.safeParse({
        ...base,
        storedSizeBytes: 10_044,
        storageEncoding: "aes-256-gcm",
      }).success,
    ).toBe(true);
  });

  it("rejects aes-256-gcm when stored bytes are not larger", () => {
    expect(
      createUploadSchema.safeParse({
        ...base,
        storedSizeBytes: 10_000,
        storageEncoding: "aes-256-gcm",
      }).success,
    ).toBe(false);
    expect(
      createUploadSchema.safeParse({
        ...base,
        storedSizeBytes: 2_000,
        storageEncoding: "aes-256-gcm",
      }).success,
    ).toBe(false);
  });
});
