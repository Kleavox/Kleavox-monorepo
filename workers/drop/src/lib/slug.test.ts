import { isFileSlug } from "@kleavox/core";
import { describe, expect, it } from "vitest";

import { createFileSlug } from "./slug";

describe("Drop public slugs", () => {
  it("always allocates from the reserved file namespace", () => {
    const values = Array.from({ length: 20 }, () => createFileSlug());
    expect(values.every(isFileSlug)).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  });
});
