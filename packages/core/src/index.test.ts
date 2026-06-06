import { describe, expect, it } from "vitest";
import { isFileSlug, isReservedSlug } from "./index";

describe("isReservedSlug", () => {
  it("normalizes case and whitespace", () => {
    expect(isReservedSlug("  API ")).toBe(true);
  });

  it("allows normal short-link slugs", () => {
    expect(isReservedSlug("launch-notes")).toBe(false);
  });

  it("identifies the isolated file namespace", () => {
    expect(isFileSlug("f_JG2nV6-pQ9")).toBe(true);
    expect(isFileSlug("launch-notes")).toBe(false);
    expect(isFileSlug("f_short")).toBe(false);
  });
});
