import { describe, expect, it } from "vitest";
import { firstName, isFileSlug, isReservedSlug } from "./index";

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

describe("firstName", () => {
  it("returns the first word of a full name", () => {
    expect(firstName("Hafidh Musyafa")).toBe("Hafidh");
    expect(firstName("  Norm   Test ")).toBe("Norm");
  });

  it("falls back to the email local part", () => {
    expect(firstName(null, "norm@example.com")).toBe("norm");
    expect(firstName("", "norm@example.com")).toBe("norm");
  });

  it("falls back to a generic label", () => {
    expect(firstName(null, null)).toBe("Account");
    expect(firstName(undefined, undefined)).toBe("Account");
  });
});
