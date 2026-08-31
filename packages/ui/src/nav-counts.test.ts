import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadNavCounts,
  loadOverview,
  navCountsFrom,
  readCache,
  writeCache,
} from "./nav-counts";
import type { Overview } from "./nav-counts";

const overview: Overview = {
  role: "ADMIN",
  pass: { devices: 1 },
  link: { active: 12, files: 3, reported: 0, expiringSoon: 1 },
  pulse: {
    nodes: 2,
    down: 1,
    checksFailing: 0,
    openIncidents: 0,
    openReports: 1,
  },
  attention: [],
};

describe("navCountsFrom", () => {
  it("reduces the overview to one count per tool", () => {
    const counts = navCountsFrom(overview);
    expect(counts.indicators.pass).toEqual({ count: 1, severity: null });
    expect(counts.indicators.link).toEqual({ count: 12, severity: "warn" });
    expect(counts.indicators.pulse).toEqual({ count: 2, severity: "danger" });
  });

  it("marks a tool danger when something is down", () => {
    const indicator = navCountsFrom(overview).indicators.pulse;
    expect(indicator).toEqual({ count: 2, severity: "danger" });
  });

  it("marks a tool warn when something merely expires soon", () => {
    const indicator = navCountsFrom(overview).indicators.link;
    expect(indicator).toEqual({ count: 12, severity: "warn" });
  });

  it("leaves a quiet tool unmarked", () => {
    const indicator = navCountsFrom(overview).indicators.pass;
    expect(indicator).toEqual({ count: 1, severity: null });
  });

  it("carries the viewer's role through, so the header can gate Pulse", () => {
    expect(navCountsFrom(overview).role).toBe("ADMIN");
    expect(navCountsFrom({ ...overview, role: "USER" }).role).toBe("USER");
  });

  it("reports a failed tool's indicator as unknown, never as a zero count", () => {
    const counts = navCountsFrom({ ...overview, pulse: null });
    expect(counts.indicators.pulse).toBe("unknown");
    expect(counts.indicators.pulse).not.toEqual({ count: 0, severity: null });
  });

  it("reports a failed but always-visible tool's indicator as unknown too", () => {
    expect(navCountsFrom({ ...overview, pulse: null }).indicators.pulse).toBe(
      "unknown",
    );
    expect(navCountsFrom({ ...overview, link: null }).indicators.link).toBe(
      "unknown",
    );
  });
});

const base: Overview = {
  role: "USER",
  pass: { devices: 2 },
  link: { active: 5, files: 1, reported: 0, expiringSoon: 0 },
  pulse: null,
  attention: [],
};

describe("indicator states", () => {
  it("calls pulse locked for a user, not unknown", () => {
    expect(navCountsFrom(base).indicators.pulse).toBe("locked");
  });

  it("calls pulse unknown for an admin whose block failed", () => {
    const counts = navCountsFrom({ ...base, role: "ADMIN" });
    expect(counts.indicators.pulse).toBe("unknown");
  });

  it("reports a count when the block is present", () => {
    const counts = navCountsFrom({
      ...base,
      role: "ADMIN",
      pulse: {
        nodes: 3,
        down: 0,
        checksFailing: 0,
        openIncidents: 0,
        openReports: 0,
      },
    });
    expect(counts.indicators.pulse).toEqual({ count: 3, severity: null });
  });

  it("never calls a user's own link block locked", () => {
    expect(navCountsFrom(base).indicators.link).toEqual({
      count: 5,
      severity: null,
    });
  });
});

describe("the cache", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });
  });

  it("returns what was written inside the window", () => {
    const now = 1_000_000;
    writeCache(overview, now);
    expect(readCache(now + 59_000)).toEqual(overview);
  });

  it("returns null once the window has passed", () => {
    const now = 1_000_000;
    writeCache(overview, now);
    expect(readCache(now + 61_000)).toBeNull();
  });

  it("returns null rather than throwing when storage holds junk", () => {
    sessionStorage.setItem("kvx:overview", "{{{");
    expect(readCache(Date.now())).toBeNull();
  });

  it("returns null rather than throwing when storage is unavailable", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {},
    });
    expect(readCache(Date.now())).toBeNull();
  });

  it("treats a cached body missing role or attention as invalid, not as fresh", () => {
    sessionStorage.setItem(
      "kvx:overview",
      JSON.stringify({ at: Date.now(), overview: { pass: { devices: 1 } } }),
    );
    expect(readCache(Date.now())).toBeNull();
  });

  it("treats a missing 'at' as stale rather than fresh", () => {
    sessionStorage.setItem("kvx:overview", JSON.stringify({ overview }));
    expect(readCache(Date.now())).toBeNull();
  });

  it("never throws when the cached overview is missing a tool block entirely", () => {
    sessionStorage.setItem(
      "kvx:overview",
      JSON.stringify({
        at: Date.now(),
        overview: { role: "ADMIN", attention: [] },
      }),
    );
    expect(() => readCache(Date.now())).not.toThrow();
  });

  it("rejects a cached body whose pulse key is entirely absent, not merely null", () => {
    sessionStorage.setItem(
      "kvx:overview",
      JSON.stringify({
        at: Date.now(),
        overview: {
          role: "ADMIN",
          attention: [],
          pass: { devices: 1 },
          link: { active: 1, files: 0, reported: 0, expiringSoon: 0 },
        },
      }),
    );
    expect(readCache(Date.now())).toBeNull();
  });
});

describe("loadNavCounts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves to null rather than throwing when a 200 body is missing pulse", async () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              role: "ADMIN",
              attention: [],
              pass: { devices: 1 },
              link: { active: 1, files: 0, reported: 0, expiringSoon: 0 },
            }),
            { status: 200 },
          ),
      ),
    );
    await expect(loadNavCounts()).resolves.toBeNull();
  });
});

describe("loadOverview", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the full overview so callers can read fields NavCounts drops, like link.reported", async () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify(overview), { status: 200 }),
      ),
    );
    await expect(loadOverview()).resolves.toEqual(overview);
  });
});
