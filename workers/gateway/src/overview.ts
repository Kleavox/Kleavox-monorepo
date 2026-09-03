type Severity = "warn" | "danger";

type AttentionKind =
  "node-down" | "check-failing" | "abuse-report" | "link-expiring";

type AttentionAge = "elapsed" | "remaining";

interface AttentionItem {
  kind: AttentionKind;
  severity: Severity;
  title: string;
  detail: string;
  since: string;
  age: AttentionAge;
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
}

interface OpenReport {
  slug: string;
  reason: string;
  since: string;
}

export interface OverviewParts {
  pass: PassSummary | null;
  link: LinkSummary | null;
  pulse: PulseSummary | null;
  reports: OpenReport[];
  reportsRead: boolean;
}

type ViewerRole = "ADMIN" | "USER";

export interface Overview {
  role: ViewerRole;
  pass: { devices: number } | null;
  link: {
    active: number;
    files: number;
    reported: number;
    expiringSoon: number;
  } | null;
  pulse: {
    nodes: number;
    down: number;
    checksFailing: number;
    openIncidents: number;
    openReports: number;
  } | null;
  attention: AttentionItem[];
}

export interface OverviewOrigins {
  link: string;
  pulse: string;
}

const SEVERITY_ORDER: Record<Severity, number> = { danger: 0, warn: 1 };
const EXPIRING_WINDOW_MS = 6 * 60 * 60 * 1000;

function urgencyMs(item: AttentionItem, now: number): number {
  const at = Date.parse(item.since);
  if (item.age === "remaining") {
    return EXPIRING_WINDOW_MS - Math.max(0, at - now);
  }
  return Math.max(0, now - at);
}

export function buildOverview(
  parts: OverviewParts,
  role: ViewerRole,
  origins: OverviewOrigins,
): Overview {
  const { link: linkOrigin, pulse: pulseOrigin } = origins;
  const reportsMissing = role === "ADMIN" && !parts.reportsRead;
  const attention: AttentionItem[] = [];

  for (const node of parts.pulse?.down ?? []) {
    attention.push({
      kind: "node-down",
      severity: "danger",
      title: node.name,
      detail: "no signal",
      since: node.lastSignal,
      age: "elapsed",
      href: `${pulseOrigin}/#fleet`,
    });
  }

  for (const report of parts.reports) {
    attention.push({
      kind: "abuse-report",
      severity: "warn",
      title: `abuse report /${report.slug}`,
      detail: `${report.reason.toLowerCase()}, not yet reviewed`,
      since: report.since,
      age: "elapsed",
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
      age: "remaining",
      href: `${linkOrigin}/`,
    });
  }

  const now = Date.now();
  attention.sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return urgencyMs(b, now) - urgencyMs(a, now);
  });

  return {
    role,
    pass: parts.pass ? { devices: parts.pass.devices } : null,
    link:
      parts.link && !reportsMissing
        ? {
            active: parts.link.active,
            files: parts.link.files,
            reported: parts.link.reported,
            expiringSoon: parts.link.expiring.length,
          }
        : null,
    pulse:
      parts.pulse && !reportsMissing
        ? {
            nodes: parts.pulse.nodes,
            down: parts.pulse.down.length,
            checksFailing: parts.pulse.checksFailing,
            openIncidents: parts.pulse.openIncidents,
            openReports: parts.reports.length,
          }
        : null,
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

interface FileReportRow {
  id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
  public_token: string | null;
}

export interface FileReportList {
  reports: FileReportRow[];
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
  fileReports: FileReportList | null;
  pulseRows: PulseRows | null;
}

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
  const openLinkReports = (raw.reports?.reports ?? []).filter(
    (report) => report.status === "OPEN",
  );
  const openFileReports = (raw.fileReports?.reports ?? []).filter(
    (report) => report.status === "OPEN",
  );
  const reports: OpenReport[] = [
    ...openLinkReports.map((report) => ({
      slug: report.slug ?? report.id,
      reason: report.reason,
      since: toIso(report.created_at),
    })),
    ...openFileReports.map((report) => ({
      slug: report.public_token ?? report.id,
      reason: report.reason,
      since: toIso(report.created_at),
    })),
  ];

  const link: LinkSummary | null =
    raw.links && raw.drops
      ? {
          active: raw.links.meta.total,
          files: raw.drops.drops.length,
          reported: reports.length,
          expiring: raw.drops.drops
            .filter(
              (drop) =>
                drop.status === "ACTIVE" && isExpiringSoon(drop.expiresAt),
            )
            .map((drop) => ({
              slug: drop.publicToken,
              filename: drop.name,
              downloads: drop.downloadCount,
              expiresAt: drop.expiresAt,
            })),
        }
      : null;

  const pulse: PulseSummary | null = raw.pulseRows
    ? {
        nodes: raw.pulseRows.nodes.length,
        checksFailing: raw.pulseRows.checks.filter(
          (check) => Boolean(check.enabled) && check.status === "DOWN",
        ).length,
        openIncidents: raw.pulseRows.incidents.filter(
          (incident) => incident.status === "OPEN",
        ).length,
        down: raw.pulseRows.nodes
          .filter((node) => nodeState(node) === "offline")
          .map((node) => ({
            name: node.name,
            lastSignal: toIso(node.last_seen_at ?? node.enrolled_at),
          })),
      }
    : null;

  return {
    pass: raw.sessions ? { devices: raw.sessions.sessions.length } : null,
    link,
    pulse,
    reports,
    reportsRead: raw.reports !== null && raw.fileReports !== null,
  };
}
