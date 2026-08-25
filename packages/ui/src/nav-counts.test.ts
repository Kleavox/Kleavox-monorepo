import { beforeEach, describe, expect, it, vi } from "vitest";
import { navCountsFrom, readCache, writeCache } from "./nav-counts";
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
  it("reduces the overview to one number per tool", () => {
    const counts = navCountsFrom(overview);
    expect(counts.pass).toBe(1);
    expect(counts.link).toBe(12);
    expect(counts.pulse).toBe(2);
  });

  it("marks a tool danger when something is down", () => {
    expect(navCountsFrom(overview).attention.pulse).toBe("danger");
  });

  it("marks a tool warn when something merely expires soon", () => {
    expect(navCountsFrom(overview).attention.link).toBe("warn");
  });

  it("leaves a quiet tool unmarked", () => {
    expect(navCountsFrom(overview).attention.pass).toBeNull();
  });

  it("carries the viewer's role through, so the header can gate Pulse", () => {
    expect(navCountsFrom(overview).role).toBe("ADMIN");
    expect(navCountsFrom({ ...overview, role: "USER" }).role).toBe("USER");
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
});
