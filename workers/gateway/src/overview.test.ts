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
  },
  reports: [
    {
      slug: "probereport814361",
      reason: "malware",
      since: "2026-08-25T09:40:33Z",
    },
  ],
  reportsRead: true,
};

describe("buildOverview", () => {
  it("carries each tool's counts through", () => {
    const overview = buildOverview(full, "ADMIN", ORIGINS);
    expect(overview.pass?.devices).toBe(1);
    expect(overview.link?.active).toBe(12);
    expect(overview.pulse?.nodes).toBe(2);
    expect(overview.pulse?.down).toBe(1);
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
          down: [
            { name: "newer", lastSignal: "2026-08-25T17:00:00Z" },
            { name: "older", lastSignal: "2026-08-25T09:00:00Z" },
          ],
        },
        reports: [],
        reportsRead: true,
      },
      "ADMIN",
      ORIGINS,
    );
    expect(overview.attention.map((item) => item.title)).toEqual([
      "older",
      "newer",
    ]);
  });

  it("ranks a soon-to-expire link above a recently opened report, not by raw timestamp", () => {
    const now = Date.now();
    const overview = buildOverview(
      {
        pass: null,
        link: {
          active: 0,
          files: 0,
          reported: 0,
          expiring: [
            {
              slug: "about-to-go",
              filename: "gone.pdf",
              downloads: 0,
              expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
            },
          ],
        },
        pulse: {
          nodes: 0,
          checksFailing: 0,
          openIncidents: 0,
          down: [],
        },
        reports: [
          {
            slug: "just-opened",
            reason: "SPAM",
            since: new Date(now - 5 * 60 * 1000).toISOString(),
          },
        ],
        reportsRead: true,
      },
      "ADMIN",
      ORIGINS,
    );
    expect(overview.attention.map((item) => item.kind)).toEqual([
      "link-expiring",
      "abuse-report",
    ]);
  });

  it("emits an ISO timestamp, never a rendered age", () => {
    const overview = buildOverview(full, "ADMIN", ORIGINS);
    for (const item of overview.attention) {
      expect(item.since).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    }
  });

  it("marks the expiring-link item as remaining time, not elapsed time", () => {
    const overview = buildOverview(full, "ADMIN", ORIGINS);
    const expiring = overview.attention.find(
      (item) => item.kind === "link-expiring",
    );
    expect(expiring?.age).toBe("remaining");
    const report = overview.attention.find(
      (item) => item.kind === "abuse-report",
    );
    expect(report?.age).toBe("elapsed");
  });

  it("degrades to null when an upstream failed, rather than rejecting or reporting zero", () => {
    const overview = buildOverview(
      { pass: null, link: null, pulse: null, reports: [], reportsRead: true },
      "ADMIN",
      ORIGINS,
    );
    expect(overview.pass).toBeNull();
    expect(overview.link).toBeNull();
    expect(overview.pulse).toBeNull();
    expect(overview.attention).toEqual([]);
  });

  it("still reports the tools that answered when one upstream failed, and keeps the abuse reports Pulse would have shown", () => {
    const overview = buildOverview({ ...full, pulse: null }, "ADMIN", ORIGINS);
    expect(overview.link?.active).toBe(12);
    expect(overview.pulse).toBeNull();
    expect(overview.attention.map((item) => item.kind).sort()).toEqual([
      "abuse-report",
      "link-expiring",
    ]);
    expect(overview.attention.every((item) => item.kind !== "node-down")).toBe(
      true,
    );
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
  fileReports: {
    reports: [
      {
        id: "fr1",
        reason: "MALWARE",
        status: "OPEN",
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        public_token: "f_bad_file",
      },
      {
        id: "fr2",
        reason: "SPAM",
        status: "REJECTED",
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        public_token: "f_old_file",
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

  it("counts only open link reports and open file reports as reported, and lists both", () => {
    const parts = toOverviewParts(rawFull);
    expect(parts.link?.reported).toBe(2);
    expect(parts.reports).toEqual([
      {
        slug: "bad-link",
        reason: "MALWARE",
        since: rawFull.reports?.reports[0]?.created_at,
      },
      {
        slug: "f_bad_file",
        reason: "MALWARE",
        since: rawFull.fileReports?.reports[0]?.created_at,
      },
    ]);
  });

  it("a null file-reports response still surfaces open link reports", () => {
    const parts = toOverviewParts({ ...rawFull, fileReports: null });
    expect(parts.link?.reported).toBe(1);
    expect(parts.reports.map((r) => r.slug)).toEqual(["bad-link"]);
  });

  it("a null link-reports response still surfaces open file reports", () => {
    const parts = toOverviewParts({ ...rawFull, reports: null });
    expect(parts.link?.reported).toBe(1);
    expect(parts.reports.map((r) => r.slug)).toEqual(["f_bad_file"]);
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
      fileReports: null,
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
      fileReports: null,
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
      fileReports: null,
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
      fileReports: null,
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

  it("nulls the whole link block when the routes page failed, rather than reporting zero routes", () => {
    const parts = toOverviewParts({ ...rawFull, links: null });
    expect(parts.link).toBeNull();
    expect(parts.reports.map((r) => r.slug)).toEqual([
      "bad-link",
      "f_bad_file",
    ]);
  });

  it("nulls the whole link block when the drops list failed, rather than reporting zero files", () => {
    const parts = toOverviewParts({ ...rawFull, drops: null });
    expect(parts.link).toBeNull();
  });

  it("marks the reports unread when neither report endpoint answered, rather than reporting none open", () => {
    const parts = toOverviewParts({
      ...rawFull,
      reports: null,
      fileReports: null,
    });
    expect(parts.reportsRead).toBe(false);
    expect(parts.reports).toEqual([]);
    expect(parts.pulse?.nodes).toBe(2);
    expect(parts.pulse?.down.map((node) => node.name)).toEqual(["node-b"]);
  });

  it("marks the reports unread when only one of the two report endpoints answered", () => {
    expect(toOverviewParts({ ...rawFull, fileReports: null }).reportsRead).toBe(
      false,
    );
    expect(toOverviewParts({ ...rawFull, reports: null }).reportsRead).toBe(
      false,
    );
    expect(toOverviewParts(rawFull).reportsRead).toBe(true);
  });

  it("silences both blocks for an admin whose abuse reports could not be read, so the screen cannot call it all clear", () => {
    const parts = toOverviewParts({
      ...rawFull,
      reports: null,
      fileReports: null,
    });
    const overview = buildOverview(parts, "ADMIN", ORIGINS);
    expect(overview.link).toBeNull();
    expect(overview.pulse).toBeNull();
  });

  it("leaves a visitor's blocks alone, because the admin report endpoints were never theirs to read", () => {
    const parts = toOverviewParts({
      ...rawFull,
      reports: null,
      fileReports: null,
    });
    const overview = buildOverview(parts, "USER", ORIGINS);
    expect(overview.link?.active).toBe(47);
    expect(overview.pulse?.nodes).toBe(2);
  });

  it("nulls the pulse block when Pulse itself failed, even though Link's report endpoints answered", () => {
    const parts = toOverviewParts({ ...rawFull, pulseRows: null });
    expect(parts.pulse).toBeNull();
    expect(parts.reports.map((r) => r.slug)).toEqual([
      "bad-link",
      "f_bad_file",
    ]);
  });

  it("keeps the abuse reports in the payload's attention list when the pulse block is null", () => {
    const parts = toOverviewParts({ ...rawFull, pulseRows: null });
    const overview = buildOverview(parts, "ADMIN", ORIGINS);
    expect(overview.pulse).toBeNull();
    expect(
      overview.attention.filter((item) => item.kind === "abuse-report").length,
    ).toBe(2);
  });

  it("degrades every field to null or empty when all six upstreams failed", () => {
    const parts = toOverviewParts({
      sessions: null,
      links: null,
      drops: null,
      reports: null,
      fileReports: null,
      pulseRows: null,
    });
    expect(parts).toEqual({
      pass: null,
      link: null,
      pulse: null,
      reports: [],
      reportsRead: false,
    });
  });

  it("normalizes a SQLite-format last_seen_at to ISO-8601 UTC, not local time", () => {
    const parts = toOverviewParts({
      sessions: null,
      links: null,
      drops: null,
      reports: null,
      fileReports: null,
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
      fileReports: null,
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
      fileReports: null,
      pulseRows: null,
    });
    expect(parts.reports).toEqual([
      {
        slug: "sqlite-report",
        reason: "SPAM",
        since: "2026-08-25T09:40:33.000Z",
      },
    ]);
  });
});
