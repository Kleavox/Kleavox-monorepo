import { describe, expect, it } from "vitest";

import { generateSlug, isValidSlug, normalizeSlug } from "./slug";

describe("Link slugs", () => {
  it("normalizes and validates public slugs", () => {
    expect(normalizeSlug("  Launch-2026 ")).toBe("launch-2026");
    expect(isValidSlug("launch-2026")).toBe(true);
    expect(isValidSlug("api")).toBe(false);
    expect(isValidSlug("f-JG2nV6pQ9")).toBe(true);
    expect(isValidSlug("f_JG2nV6-pQ9")).toBe(false);
    expect(isValidSlug("-invalid")).toBe(false);
  });

  it("generates URL-safe slugs", () => {
    expect(generateSlug()).toMatch(/^[a-z0-9]{7}$/);
  });
});
