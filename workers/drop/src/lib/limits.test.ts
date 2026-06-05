import { describe, expect, it } from "vitest";

import {
  expectedPartSize,
  GUEST_POLICY,
  normalizeDownloadLimit,
  normalizeRetention,
  PART_SIZE_BYTES,
  USER_POLICY,
} from "./limits";

describe("Drop limits", () => {
  it("uses only retention options allowed by the active policy", () => {
    expect(normalizeRetention(3600, GUEST_POLICY)).toBe(3600);
    expect(normalizeRetention(86_400, GUEST_POLICY)).toBe(3600);
    expect(normalizeRetention(21_600, USER_POLICY)).toBe(21_600);
  });

  it("clamps download limits", () => {
    expect(normalizeDownloadLimit(999, GUEST_POLICY)).toBe(5);
    expect(normalizeDownloadLimit(0, USER_POLICY)).toBe(1);
    expect(normalizeDownloadLimit(undefined, USER_POLICY)).toBe(20);
  });

  it("calculates the shorter final multipart chunk", () => {
    const total = PART_SIZE_BYTES * 2 + 123;
    expect(expectedPartSize(total, 1, 3)).toBe(PART_SIZE_BYTES);
    expect(expectedPartSize(total, 3, 3)).toBe(123);
    expect(expectedPartSize(total, 4, 3)).toBe(0);
  });
});
