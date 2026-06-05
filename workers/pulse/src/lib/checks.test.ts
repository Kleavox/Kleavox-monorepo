import { describe, expect, it } from "vitest";

import {
  nextFailureCount,
  shouldOpenIncident,
  shouldResolveIncident,
  validateCheckTarget,
} from "./checks";

describe("Pulse check validation", () => {
  it("accepts bounded HTTP, TCP, and service targets", () => {
    expect(validateCheckTarget("HTTP", "https://example.com/health")).toBe(
      "https://example.com/health",
    );
    expect(validateCheckTarget("TCP", "127.0.0.1:5432")).toBe("127.0.0.1:5432");
    expect(validateCheckTarget("SERVICE", "nginx.service")).toBe(
      "nginx.service",
    );
    expect(validateCheckTarget("TCP", "localhost:99999")).toBeNull();
    expect(validateCheckTarget("SERVICE", "nginx; reboot")).toBeNull();
  });
});

describe("Pulse incident transitions", () => {
  it("opens after the second consecutive failure", () => {
    expect(nextFailureCount(0, "DOWN")).toBe(1);
    expect(shouldOpenIncident("DOWN", 1)).toBe(false);
    expect(shouldOpenIncident("DOWN", 2)).toBe(true);
    expect(shouldOpenIncident("DOWN", 3)).toBe(false);
  });

  it("resolves when a down check recovers", () => {
    expect(nextFailureCount(4, "UP")).toBe(0);
    expect(shouldResolveIncident("DOWN", "UP")).toBe(true);
  });
});
