export type Severity = "warn" | "danger";

export type AttentionKind =
  "node-down" | "check-failing" | "abuse-report" | "link-expiring";

export interface AttentionItem {
  kind: AttentionKind;
  severity: Severity;
  title: string;
  detail: string;
  since: string;
  href: string;
}

export interface Overview {
  role: "ADMIN" | "USER";
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

export interface NavCounts {
  role: "ADMIN" | "USER";
  pass: number;
  link: number;
  pulse: number;
  attention: {
    pass: Severity | null;
    link: Severity | null;
    pulse: Severity | null;
  };
}

const CACHE_KEY = "kvx:overview";
const CACHE_MS = 60_000;

export function navCountsFrom(overview: Overview): NavCounts {
  const pulseDanger =
    overview.pulse.down > 0 || overview.pulse.checksFailing > 0;
  const pulseWarn =
    overview.pulse.openIncidents > 0 || overview.pulse.openReports > 0;
  return {
    role: overview.role,
    pass: overview.pass.devices,
    link: overview.link.active,
    pulse: overview.pulse.nodes,
    attention: {
      pass: null,
      link: overview.link.expiringSoon > 0 ? "warn" : null,
      pulse: pulseDanger ? "danger" : pulseWarn ? "warn" : null,
    },
  };
}

export function writeCache(overview: Overview, now: number = Date.now()): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: now, overview }));
  } catch {
    return;
  }
}

export function readCache(now: number = Date.now()): Overview | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as { at: number; overview: Overview };
    if (now - parsed.at > CACHE_MS) return null;
    return parsed.overview;
  } catch {
    return null;
  }
}

export async function loadNavCounts(
  rootOrigin: string,
): Promise<NavCounts | null> {
  const cached = readCache();
  if (cached !== null) return navCountsFrom(cached);
  try {
    const response = await fetch(`${rootOrigin}/api/estate`, {
      credentials: "include",
    });
    if (!response.ok) return null;
    const overview = (await response.json()) as Overview;
    writeCache(overview);
    return navCountsFrom(overview);
  } catch {
    return null;
  }
}
