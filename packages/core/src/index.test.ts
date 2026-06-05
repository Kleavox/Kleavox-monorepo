import { describe, expect, it } from "vitest";
import { isReservedSlug } from "./index";

describe("isReservedSlug", () => {
  it("normalizes case and whitespace", () => {
    expect(isReservedSlug("  API ")).toBe(true);
  });

  it("allows normal short-link slugs", () => {
    expect(isReservedSlug("launch-notes")).toBe(false);
  });
});
