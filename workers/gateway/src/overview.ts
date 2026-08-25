type Severity = "warn" | "danger";

type AttentionKind =
  "node-down" | "check-failing" | "abuse-report" | "link-expiring";

interface AttentionItem {
  kind: AttentionKind;
  severity: Severity;
  title: string;
  detail: string;
  since: string;
  href: string;
}

interface PassSummary {
  devices: number;
}

interface LinkSummary {
  active: number;
  files: number;
  reported: number;
  expiring: Array<{
    slug: string;
    filename: string;
    downloads: number;
    expiresAt: string;
  }>;
}

interface PulseSummary {
  nodes: number;
  checksFailing: number;
  openIncidents: number;
  down: Array<{ name: string; lastSignal: string }>;
  openReports: Array<{ slug: string; reason: string; since: string }>;
}

export interface OverviewParts {
  pass: PassSummary | null;
  link: LinkSummary | null;
  pulse: PulseSummary | null;
}

type ViewerRole = "ADMIN" | "USER";

export interface Overview {
  role: ViewerRole;
  pass: { devices: number };
  link: {
    active: number;
    files: number;
    reported: number;
    expiringSoon: number;
  };
  pulse: {
    nodes: number;
    down: number;
    checksFailing: number;
    openIncidents: number;
    openReports: number;
  };
  attention: AttentionItem[];
}

export interface OverviewOrigins {
  link: string;
  pulse: string;
}

const SEVERITY_ORDER: Record<Severity, number> = { danger: 0, warn: 1 };

export function buildOverview(
  parts: OverviewParts,
  role: ViewerRole,
  origins: OverviewOrigins,
): Overview {
  const { link: linkOrigin, pulse: pulseOrigin } = origins;
  const attention: AttentionItem[] = [];

  for (const node of parts.pulse?.down ?? []) {
    attention.push({
      kind: "node-down",
      severity: "danger",
      title: node.name,
      detail: "no signal",
      since: node.lastSignal,
      href: `${pulseOrigin}/#fleet`,
    });
  }

  for (const report of parts.pulse?.openReports ?? []) {
    attention.push({
      kind: "abuse-report",
      severity: "warn",
      title: `abuse report /${report.slug}`,
      detail: `${report.reason.toLowerCase()}, not yet reviewed`,
      since: report.since,
      href: `${pulseOrigin}/#reports`,
    });
  }

  for (const item of parts.link?.expiring ?? []) {
    attention.push({
      kind: "link-expiring",
      severity: "warn",
      title: `/${item.slug}`,
      detail: `${item.filename}, ${item.downloads} downloads`,
      since: item.expiresAt,
      href: `${linkOrigin}/`,
    });
  }

  attention.sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return Date.parse(a.since) - Date.parse(b.since);
  });

  return {
    role,
    pass: { devices: parts.pass?.devices ?? 0 },
    link: {
      active: parts.link?.active ?? 0,
      files: parts.link?.files ?? 0,
      reported: parts.link?.reported ?? 0,
      expiringSoon: parts.link?.expiring.length ?? 0,
    },
    pulse: {
      nodes: parts.pulse?.nodes ?? 0,
      down: parts.pulse?.down.length ?? 0,
      checksFailing: parts.pulse?.checksFailing ?? 0,
      openIncidents: parts.pulse?.openIncidents ?? 0,
      openReports: parts.pulse?.openReports.length ?? 0,
    },
    attention,
  };
}

export interface PassSessions {
  sessions: unknown[];
}

export interface LinkPage {
  data: unknown[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface DropRow {
  publicToken: string;
  name: string;
  downloadCount: number;
  expiresAt: string;
  status: string;
}

export interface DropList {
  drops: DropRow[];
}

type ReportStatus = "OPEN" | "RESOLVED" | "REJECTED";

interface ReportRow {
  id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
  slug: string | null;
}

export interface ReportList {
  reports: ReportRow[];
}

interface PulseNodeRow {
  name: string;
  enrolled_at: string | null;
  last_seen_at: string | null;
  disabled_at: string | null;
  interval_seconds: number;
}

interface PulseCheckRow {
  enabled: number;
  status: "UNKNOWN" | "UP" | "DOWN";
}

interface PulseIncidentRow {
  status: "OPEN" | "RESOLVED";
}

export interface PulseRows {
  nodes: PulseNodeRow[];
  checks: PulseCheckRow[];
  incidents: PulseIncidentRow[];
}

export interface RawOverviewParts {
  sessions: PassSessions | null;
  links: LinkPage | null;
  drops: DropList | null;
  reports: ReportList | null;
  pulseRows: PulseRows | null;
}

const EXPIRING_WINDOW_MS = 6 * 60 * 60 * 1000;
const MIN_NODE_GRACE_SECONDS = 90;
const NODE_GRACE_INTERVAL_MULTIPLIER = 3;
const SQLITE_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u;

function parseUpstreamTimestamp(value: string): number {
  const normalized = SQLITE_TIMESTAMP.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  return Date.parse(normalized);
}

function toIso(value: string | null): string {
  if (!value) return new Date(0).toISOString();
  return new Date(parseUpstreamTimestamp(value)).toISOString();
}

type NodeState = "disabled" | "pending" | "online" | "offline";

function nodeState(node: PulseNodeRow): NodeState {
  if (node.disabled_at) return "disabled";
  if (!node.enrolled_at) return "pending";
  if (!node.last_seen_at) return "offline";
  const graceMs =
    Math.max(
      MIN_NODE_GRACE_SECONDS,
      node.interval_seconds * NODE_GRACE_INTERVAL_MULTIPLIER,
    ) * 1000;
  return Date.now() - parseUpstreamTimestamp(node.last_seen_at) <= graceMs
    ? "online"
    : "offline";
}

function isExpiringSoon(expiresAt: string): boolean {
  const remaining = parseUpstreamTimestamp(expiresAt) - Date.now();
  return remaining > 0 && remaining <= EXPIRING_WINDOW_MS;
}

export function toOverviewParts(raw: RawOverviewParts): OverviewParts {
  const openReports = (raw.reports?.reports ?? []).filter(
    (report) => report.status === "OPEN",
  );

  const link: LinkSummary | null =
    raw.links || raw.drops || raw.reports
      ? {
          active: raw.links?.meta.total ?? 0,
          files: raw.drops?.drops.length ?? 0,
          reported: raw.reports ? openReports.length : 0,
          expiring: raw.drops
            ? raw.drops.drops
                .filter(
                  (drop) =>
                    drop.status === "ACTIVE" && isExpiringSoon(drop.expiresAt),
                )
                .map((drop) => ({
                  slug: drop.publicToken,
                  filename: drop.name,
                  downloads: drop.downloadCount,
                  expiresAt: drop.expiresAt,
                }))
            : [],
        }
      : null;

  const pulse: PulseSummary | null =
    raw.pulseRows || raw.reports
      ? {
          nodes: raw.pulseRows?.nodes.length ?? 0,
          checksFailing: raw.pulseRows
            ? raw.pulseRows.checks.filter(
                (check) => Boolean(check.enabled) && check.status === "DOWN",
              ).length
            : 0,
          openIncidents: raw.pulseRows
            ? raw.pulseRows.incidents.filter(
                (incident) => incident.status === "OPEN",
              ).length
            : 0,
          down: raw.pulseRows
            ? raw.pulseRows.nodes
                .filter((node) => nodeState(node) === "offline")
                .map((node) => ({
                  name: node.name,
                  lastSignal: toIso(node.last_seen_at ?? node.enrolled_at),
                }))
            : [],
          openReports: raw.reports
            ? openReports.map((report) => ({
                slug: report.slug ?? report.id,
                reason: report.reason,
                since: toIso(report.created_at),
              }))
            : [],
        }
      : null;

  return {
    pass: raw.sessions ? { devices: raw.sessions.sessions.length } : null,
    link,
    pulse,
  };
}
