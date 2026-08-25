import { describe, expect, it } from "vitest";
import {
  buildOverview,
  toOverviewParts,
  type OverviewParts,
  type RawOverviewParts,
} from "./overview";

const ORIGINS = {
  link: "https://link.kleavox.xyz",
  pulse: "https://pulse.kleavox.xyz",
};

const full: OverviewParts = {
  pass: { devices: 1 },
  link: {
    active: 12,
    files: 3,
    reported: 0,
    expiring: [
      {
        slug: "f_wJLNl74BLx088xgk",
        filename: "limit-814361.txt",
        downloads: 1,
        expiresAt: "2026-08-26T00:00:00Z",
      },
    ],
  },
  pulse: {
    nodes: 2,
    checksFailing: 0,
    down: [{ name: "probe-node-814361", lastSignal: "2026-08-25T16:22:00Z" }],
    openIncidents: 0,
    openReports: [
      {
        slug: "probereport814361",
        reason: "malware",
        since: "2026-08-25T09:40:33Z",
      },
    ],
  },
};

describe("buildOverview", () => {
  it("carries each tool's counts through", () => {
    const overview = buildOverview(full, "ADMIN", ORIGINS);
    expect(overview.pass.devices).toBe(1);
    expect(overview.link.active).toBe(12);
    expect(overview.pulse.nodes).toBe(2);
    expect(overview.pulse.down).toBe(1);
  });

  it("puts danger before warn", () => {
    const overview = buildOverview(full, "ADMIN", ORIGINS);
    const severities = overview.attention.map((item) => item.severity);
    expect(severities.indexOf("danger")).toBeLessThan(
      severities.indexOf("warn"),
    );
  });

  it("orders equal severities oldest first", () => {
    const overview = buildOverview(
      {
        pass: null,
        link: null,
        pulse: {
          nodes: 2,
          checksFailing: 0,
          openIncidents: 0,
          openReports: [],
          down: [
            { name: "newer", lastSignal: "2026-08-25T17:00:00Z" },
            { name: "older", lastSignal: "2026-08-25T09:00:00Z" },
          ],
        },
      },
      "ADMIN",
      ORIGINS,
    );
    expect(overview.attention.map((item) => item.title)).toEqual([
      "older",
      "newer",
    ]);
  });

  it("emits an ISO timestamp, never a rendered age", () => {
    const overview = buildOverview(full, "ADMIN", ORIGINS);
    for (const item of overview.attention) {
      expect(item.since).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    }
  });

  it("degrades to zeroes when an upstream failed, rather than rejecting", () => {
    const overview = buildOverview(
      { pass: null, link: null, pulse: null },
      "ADMIN",
      ORIGINS,
    );
    expect(overview.pass.devices).toBe(0);
    expect(overview.link.active).toBe(0);
    expect(overview.pulse.nodes).toBe(0);
    expect(overview.attention).toEqual([]);
  });

  it("still reports the tools that answered when one upstream failed", () => {
    const overview = buildOverview({ ...full, pulse: null }, "ADMIN", ORIGINS);
    expect(overview.link.active).toBe(12);
    expect(
      overview.attention.every((item) => item.kind === "link-expiring"),
    ).toBe(true);
  });

  it("builds hrefs from the origins it was given, never from upstream strings", () => {
    const overview = buildOverview(full, "ADMIN", {
      link: "http://127.0.0.1:8788",
      pulse: "http://127.0.0.1:8790",
    });
    for (const item of overview.attention) {
      expect(item.href.startsWith("http://127.0.0.1:87")).toBe(true);
    }
  });

  it("carries the viewer's role through unchanged", () => {
    expect(buildOverview(full, "ADMIN", ORIGINS).role).toBe("ADMIN");
    expect(buildOverview(full, "USER", ORIGINS).role).toBe("USER");
  });
});

const rawFull: RawOverviewParts = {
  sessions: { sessions: [{ id: "s1" }, { id: "s2" }] },
  links: {
    data: [{ slug: "a" }],
    meta: { page: 1, limit: 1, total: 47, totalPages: 47 },
  },
  drops: {
    drops: [
      {
        publicToken: "f_soonExpiring",
        name: "report.pdf",
        downloadCount: 4,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        status: "ACTIVE",
      },
      {
        publicToken: "f_farOut",
        name: "later.pdf",
        downloadCount: 0,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        status: "ACTIVE",
      },
      {
        publicToken: "f_alreadyExpired",
        name: "gone.pdf",
        downloadCount: 9,
        expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        status: "EXHAUSTED",
      },
    ],
  },
  reports: {
    reports: [
      {
        id: "r1",
        reason: "MALWARE",
        status: "OPEN",
        created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        slug: "bad-link",
      },
      {
        id: "r2",
        reason: "SPAM",
        status: "RESOLVED",
        created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        slug: "old-link",
      },
    ],
  },
  pulseRows: {
    nodes: [
      {
        name: "node-a",
        enrolled_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        disabled_at: null,
        last_seen_at: new Date().toISOString(),
        interval_seconds: 60,
      },
      {
        name: "node-b",
        enrolled_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        disabled_at: null,
        last_seen_at: null,
        interval_seconds: 60,
      },
    ],
    checks: [
      { enabled: 1, status: "DOWN" },
      { enabled: 0, status: "DOWN" },
      { enabled: 1, status: "UP" },
    ],
    incidents: [{ status: "OPEN" }, { status: "RESOLVED" }],
  },
};

describe("toOverviewParts", () => {
  it("reads meta.total for the link route count, not results.length", () => {
    const parts = toOverviewParts(rawFull);
    expect(parts.link?.active).toBe(47);
  });

  it("keeps only drops that are still active and expiring within the window", () => {
    const parts = toOverviewParts(rawFull);
    const slugs = parts.link?.expiring.map((item) => item.slug);
    expect(slugs).toEqual(["f_soonExpiring"]);
  });

  it("counts only open reports as reported, and surfaces them under pulse", () => {
    const parts = toOverviewParts(rawFull);
    expect(parts.link?.reported).toBe(1);
    expect(parts.pulse?.openReports).toEqual([
      {
        slug: "bad-link",
        reason: "MALWARE",
        since: rawFull.reports?.reports[0]?.created_at,
      },
    ]);
  });

  it("treats an enrolled node with no last signal as down", () => {
    const parts = toOverviewParts(rawFull);
    expect(parts.pulse?.down.map((node) => node.name)).toEqual(["node-b"]);
  });

  it("counts only enabled failing checks", () => {
    const parts = toOverviewParts(rawFull);
    expect(parts.pulse?.checksFailing).toBe(1);
  });

  it("treats a node that has not finished enrollment as pending, not down", () => {
    const parts = toOverviewParts({
      sessions: null,
      links: null,
      drops: null,
      reports: null,
      pulseRows: {
        nodes: [
          {
            name: "dlg-node-814361",
            enrolled_at: null,
            disabled_at: null,
            last_seen_at: null,
            interval_seconds: 60,
          },
        ],
        checks: [],
        incidents: [],
      },
    });
    expect(parts.pulse?.down).toEqual([]);
  });

  it("produces no attention item for a pending node", () => {
    const parts = toOverviewParts({
      sessions: null,
      links: null,
      drops: null,
      reports: null,
      pulseRows: {
        nodes: [
          {
            name: "dlg-node-814361",
            enrolled_at: null,
            disabled_at: null,
            last_seen_at: null,
            interval_seconds: 60,
          },
        ],
        checks: [],
        incidents: [],
      },
    });
    const overview = buildOverview(parts, "ADMIN", ORIGINS);
    expect(overview.attention).toEqual([]);
  });

  it("treats a disabled node as excluded from down, even with a very stale last signal", () => {
    const parts = toOverviewParts({
      sessions: null,
      links: null,
      drops: null,
      reports: null,
      pulseRows: {
        nodes: [
          {
            name: "decommissioned-node",
            enrolled_at: new Date(
              Date.now() - 90 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            disabled_at: new Date(
              Date.now() - 60 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            last_seen_at: new Date(
              Date.now() - 90 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            interval_seconds: 60,
          },
        ],
        checks: [],
        incidents: [],
      },
    });
    expect(parts.pulse?.down).toEqual([]);
  });

  it("produces no attention item for a disabled node", () => {
    const parts = toOverviewParts({
      sessions: null,
      links: null,
      drops: null,
      reports: null,
      pulseRows: {
        nodes: [
          {
            name: "decommissioned-node",
            enrolled_at: new Date(
              Date.now() - 90 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            disabled_at: new Date(
              Date.now() - 60 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            last_seen_at: new Date(
              Date.now() - 90 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            interval_seconds: 60,
          },
        ],
        checks: [],
        incidents: [],
      },
    });
    const overview = buildOverview(parts, "ADMIN", ORIGINS);
    expect(overview.attention).toEqual([]);
  });

  it("a null links response zeroes only the routes count, not files or reports", () => {
    const parts = toOverviewParts({ ...rawFull, links: null });
    expect(parts.link?.active).toBe(0);
    expect(parts.link?.files).toBe(3);
    expect(parts.link?.reported).toBe(1);
  });

  it("a null reports response zeroes only the reports fields, not the pulse node data", () => {
    const parts = toOverviewParts({ ...rawFull, reports: null });
    expect(parts.link?.reported).toBe(0);
    expect(parts.pulse?.openReports).toEqual([]);
    expect(parts.pulse?.nodes).toBe(2);
    expect(parts.pulse?.down.map((node) => node.name)).toEqual(["node-b"]);
  });

  it("a null pulseRows response zeroes only the fleet fields, keeping reports flowing", () => {
    const parts = toOverviewParts({ ...rawFull, pulseRows: null });
    expect(parts.pulse?.nodes).toBe(0);
    expect(parts.pulse?.down).toEqual([]);
    expect(parts.pulse?.checksFailing).toBe(0);
    expect(parts.pulse?.openReports).toEqual([
      {
        slug: "bad-link",
        reason: "MALWARE",
        since: rawFull.reports?.reports[0]?.created_at,
      },
    ]);
  });

  it("degrades every field to null or zero when all five upstreams failed", () => {
    const parts = toOverviewParts({
      sessions: null,
      links: null,
      drops: null,
      reports: null,
      pulseRows: null,
    });
    expect(parts).toEqual({ pass: null, link: null, pulse: null });
  });

  it("normalizes a SQLite-format last_seen_at to ISO-8601 UTC, not local time", () => {
    const parts = toOverviewParts({
      sessions: null,
      links: null,
      drops: null,
      reports: null,
      pulseRows: {
        nodes: [
          {
            name: "sqlite-node",
            enrolled_at: "2019-12-31 00:00:00",
            disabled_at: null,
            last_seen_at: "2020-01-01 00:00:00",
            interval_seconds: 60,
          },
        ],
        checks: [],
        incidents: [],
      },
    });
    expect(parts.pulse?.down).toEqual([
      { name: "sqlite-node", lastSignal: "2020-01-01T00:00:00.000Z" },
    ]);
  });

  it("falls back to enrolled_at, not the epoch, when an offline node has never signalled", () => {
    const parts = toOverviewParts({
      sessions: null,
      links: null,
      drops: null,
      reports: null,
      pulseRows: {
        nodes: [
          {
            name: "never-signalled",
            enrolled_at: "2019-12-31 00:00:00",
            disabled_at: null,
            last_seen_at: null,
            interval_seconds: 60,
          },
        ],
        checks: [],
        incidents: [],
      },
    });
    expect(parts.pulse?.down).toEqual([
      { name: "never-signalled", lastSignal: "2019-12-31T00:00:00.000Z" },
    ]);
  });

  it("normalizes a SQLite-format report created_at to ISO-8601 UTC, not local time", () => {
    const parts = toOverviewParts({
      sessions: null,
      links: null,
      drops: null,
      reports: {
        reports: [
          {
            id: "r9",
            reason: "SPAM",
            status: "OPEN",
            created_at: "2026-08-25 09:40:33",
            slug: "sqlite-report",
          },
        ],
      },
      pulseRows: null,
    });
    expect(parts.pulse?.openReports).toEqual([
      {
        slug: "sqlite-report",
        reason: "SPAM",
        since: "2026-08-25T09:40:33.000Z",
      },
    ]);
  });
});
