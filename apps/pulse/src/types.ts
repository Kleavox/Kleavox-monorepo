import type { Identity } from "@kleavox/core";

export interface SessionResponse {
  authenticated: boolean;
  identity?: Identity;
}

export interface NodeRecord {
  id: string;
  name: string;
  hostname: string | null;
  architecture: string | null;
  operating_system: string | null;
  agent_version: string | null;
  last_seen_at: string | null;
  enrolled_at: string | null;
  interval_seconds: number;
  cpu_percent: number | null;
  memory_used_bytes: number | null;
  memory_total_bytes: number | null;
  disk_used_bytes: number | null;
  disk_total_bytes: number | null;
  load_1: number | null;
  uptime_seconds: number | null;
}

export interface CheckRecord {
  id: string;
  node_id: string;
  name: string;
  kind: "HTTP" | "TCP" | "SERVICE";
  target: string;
  enabled: number;
  status: "UNKNOWN" | "UP" | "DOWN";
  latency_ms: number | null;
  last_checked_at: string | null;
  consecutive_failures: number;
  last_message: string | null;
}

export interface Incident {
  id: string;
  status: "OPEN" | "RESOLVED";
  started_at: string;
  resolved_at: string | null;
  summary: string | null;
  check_name: string;
  node_name: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  url: string | null;
}

export interface Note {
  id: string;
  project_id: string | null;
  content: string;
  pinned: number;
}

export interface Overview {
  nodes: NodeRecord[];
  checks: CheckRecord[];
  incidents: Incident[];
  projects: Project[];
  notes: Note[];
}

export type AppState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "restricted" }
  | { status: "error"; message: string }
  | { status: "ready"; identity: Identity; overview: Overview };

export interface Enrollment {
  id?: string;
  enrollmentToken: string;
  enrollmentExpiresAt: string;
  command: string;
}

export interface LinkReport {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  slug: string | null;
  target_url: string | null;
  disabled_at: string | null;
}

export interface DropReport {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  original_name: string | null;
  public_token: string | null;
  drop_status: string | null;
}
