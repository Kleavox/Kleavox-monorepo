import { describe, expect, it } from "vitest";

import { isoTimestamp } from "./timestamps";

describe("isoTimestamp", () => {
  it("marks a SQLite datetime as the UTC it already is", () => {
    expect(isoTimestamp("2026-08-25 06:23:50")).toBe("2026-08-25T06:23:50Z");
  });

  it("leaves an ISO timestamp alone", () => {
    expect(isoTimestamp("2026-08-25T06:22:30.896Z")).toBe(
      "2026-08-25T06:22:30.896Z",
    );
  });

  it("leaves an offset timestamp alone", () => {
    expect(isoTimestamp("2026-08-25T13:22:30+07:00")).toBe(
      "2026-08-25T13:22:30+07:00",
    );
  });

  it("passes null through", () => {
    expect(isoTimestamp(null)).toBeNull();
  });

  it("puts a SQLite row and an ISO row on one timeline", () => {
    const sqlite = Date.parse(isoTimestamp("2026-08-25 06:23:50"));
    const iso = Date.parse("2026-08-25T06:22:30.896Z");
    expect(sqlite).toBeGreaterThan(iso);
  });

  it("would have sorted the two apart without normalising", () => {
    const raw = Date.parse("2026-08-25 06:23:50");
    const normalised = Date.parse(isoTimestamp("2026-08-25 06:23:50"));
    const offsetMinutes = new Date().getTimezoneOffset();
    if (offsetMinutes !== 0) expect(raw).not.toBe(normalised);
  });
});
