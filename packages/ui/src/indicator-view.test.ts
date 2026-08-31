import { describe, expect, it } from "vitest";
import type { Indicator } from "./nav-counts";
import { displayFor, nameFor, padClass, severityFor } from "./indicator-view";

const known: Indicator = { count: 3, severity: null };
const dangerKnown: Indicator = { count: 3, severity: "danger" };
const warnKnown: Indicator = { count: 3, severity: "warn" };

describe("nameFor", () => {
  it("names the not-yet-loaded state with just the label", () => {
    expect(nameFor("pulse", "nodes", undefined)).toBe("pulse");
  });

  it("names locked distinctly, not as a bare label", () => {
    expect(nameFor("pulse", "nodes", "locked")).toBe("pulse, locked");
  });

  it("never lets locked collide with the not-yet-loaded state", () => {
    const locked = nameFor("pulse", "nodes", "locked");
    const notYetLoaded = nameFor("pulse", "nodes", undefined);
    expect(locked).not.toBe(notYetLoaded);
  });

  it("names unknown distinctly from locked", () => {
    expect(nameFor("pulse", "nodes", "unknown")).toBe("pulse, unknown");
    expect(nameFor("pulse", "nodes", "unknown")).not.toBe(
      nameFor("pulse", "nodes", "locked"),
    );
  });

  it("names a known count with the tool's noun", () => {
    expect(nameFor("pulse", "nodes", known)).toBe("pulse, 3 nodes");
  });

  it("produces four distinct names, one per state, so swapping any two would fail", () => {
    const names = [
      nameFor("pulse", "nodes", undefined),
      nameFor("pulse", "nodes", "locked"),
      nameFor("pulse", "nodes", "unknown"),
      nameFor("pulse", "nodes", known),
    ];
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("displayFor", () => {
  it("shows nothing for the not-yet-loaded state", () => {
    expect(displayFor(undefined)).toBeNull();
  });

  it("shows nothing, not a dash, for locked", () => {
    expect(displayFor("locked")).toBeNull();
  });

  it("shows a dash for unknown", () => {
    expect(displayFor("unknown")).toBe("--");
  });

  it("shows the number for a known count", () => {
    expect(displayFor(known)).toBe("3");
  });
});

describe("severityFor", () => {
  it("carries no severity for the not-yet-loaded state", () => {
    expect(severityFor(undefined)).toBeNull();
  });

  it("carries no severity for locked, so it draws no pad", () => {
    expect(severityFor("locked")).toBeNull();
  });

  it("carries warn severity for unknown, which is itself an alarm", () => {
    expect(severityFor("unknown")).toBe("warn");
  });

  it("carries the block's own severity for a known count", () => {
    expect(severityFor(known)).toBeNull();
    expect(severityFor(warnKnown)).toBe("warn");
    expect(severityFor(dangerKnown)).toBe("danger");
  });
});

describe("padClass", () => {
  it("draws no pad for a quiet or absent severity", () => {
    expect(padClass(null)).toBe("");
  });

  it("draws the warn pad", () => {
    expect(padClass("warn")).toBe("kvx-pad kvx-pad-warn");
  });

  it("draws the danger pad", () => {
    expect(padClass("danger")).toBe("kvx-pad kvx-pad-danger");
  });
});

describe("locked carries no count and no pad", () => {
  it("has neither a display value nor a severity", () => {
    expect(displayFor("locked")).toBeNull();
    expect(severityFor("locked")).toBeNull();
  });
});
