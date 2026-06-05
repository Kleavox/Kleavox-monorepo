import { integer, sqlValue, stableId, text, type Row } from "./sql.js";
import type { MigrationFile } from "./deaubit.js";

export interface DeauBoardInput {
  ownerUserId: string;
  projects: Row[];
  checks: Row[];
  notes: Row[];
}

export interface DeauBoardResult {
  files: MigrationFile[];
  manifest: {
    ownerUserId: string;
    projects: number;
    nodes: number;
    checks: number;
    notes: number;
    nodesRequireReenrollment: boolean;
  };
}

export function migrateDeauBoard(input: DeauBoardInput): DeauBoardResult {
  if (!input.ownerUserId.trim()) throw new Error("Pulse owner user id is required.");

  const nodeNames = [
    ...new Set(
      input.checks.map((row) => text(row.node_name) ?? "legacy").sort(),
    ),
  ];
  const nodeIds = new Map(
    nodeNames.map((name) => [name, stableId("deauboard-node", name)]),
  );

  const nodes = nodeNames.map((name) => {
    const nodeId = nodeIds.get(name)!;
    return `INSERT OR IGNORE INTO nodes
  (id, owner_user_id, name, hostname, agent_token_hash, interval_seconds, disabled_at, created_at, updated_at)
VALUES
  (${sqlValue(nodeId)}, ${sqlValue(input.ownerUserId)}, ${sqlValue(name)}, ${sqlValue(name)}, ${sqlValue(`legacy-disabled:${stableId("deauboard-agent", name)}`)}, 60, datetime('now'), datetime('now'), datetime('now'));`;
  });

  const projects = input.projects.map((row) => {
    const createdAt = text(row.created_at) ?? new Date(0).toISOString();
    return `INSERT OR IGNORE INTO projects
  (id, owner_user_id, name, description, status, url, created_at, updated_at)
VALUES
  (${sqlValue(stableId("deauboard-project", requiredText(row.id, "DeauBoard project id")))}, ${sqlValue(input.ownerUserId)}, ${sqlValue(requiredText(row.name, "DeauBoard project name"))}, ${sqlValue(text(row.description))}, ${sqlValue(projectStatus(text(row.status)))}, ${sqlValue(text(row.url))}, ${sqlValue(createdAt)}, ${sqlValue(createdAt)});`;
  });

  const checks = input.checks.map((row) => {
    const nodeName = text(row.node_name) ?? "legacy";
    const createdAt = text(row.created_at) ?? new Date(0).toISOString();
    const status = checkStatus(text(row.status));
    return `INSERT OR IGNORE INTO checks
  (id, node_id, name, kind, target, enabled, status, timeout_seconds, latency_ms, last_checked_at, consecutive_failures, last_message, created_at, updated_at)
VALUES
  (${sqlValue(stableId("deauboard-check", requiredText(row.id, "DeauBoard check id")))}, ${sqlValue(nodeIds.get(nodeName))}, ${sqlValue(requiredText(row.name, "DeauBoard check name"))}, 'HTTP', ${sqlValue(requiredText(row.url, "DeauBoard check URL"))}, 1, ${sqlValue(status)}, 10, ${sqlValue(integer(row.response_ms))}, ${sqlValue(text(row.last_checked))}, ${status === "DOWN" ? 1 : 0}, 'Imported from DeauBoard; re-enroll the node before enabling reports.', ${sqlValue(createdAt)}, ${sqlValue(createdAt)});`;
  });

  const notes = input.notes.map((row) => {
    const createdAt = text(row.created_at) ?? new Date(0).toISOString();
    return `INSERT OR IGNORE INTO notes
  (id, owner_user_id, project_id, content, pinned, created_at, updated_at)
VALUES
  (${sqlValue(stableId("deauboard-note", requiredText(row.id, "DeauBoard note id")))}, ${sqlValue(input.ownerUserId)}, NULL, ${sqlValue(requiredText(row.content, "DeauBoard note content"))}, ${integer(row.pinned) === 1 ? 1 : 0}, ${sqlValue(createdAt)}, ${sqlValue(text(row.updated_at) ?? createdAt)});`;
  });

  return {
    files: [
      file("100-pulse-nodes.sql", nodes),
      file("110-pulse-projects.sql", projects),
      file("120-pulse-checks.sql", checks),
      file("130-pulse-notes.sql", notes),
    ],
    manifest: {
      ownerUserId: input.ownerUserId,
      projects: input.projects.length,
      nodes: nodeNames.length,
      checks: input.checks.length,
      notes: input.notes.length,
      nodesRequireReenrollment: true,
    },
  };
}

function projectStatus(value: string | null): "ACTIVE" | "PAUSED" | "ARCHIVED" {
  if (value === "done" || value === "archived") return "ARCHIVED";
  if (value === "paused") return "PAUSED";
  return "ACTIVE";
}

function checkStatus(value: string | null): "UNKNOWN" | "UP" | "DOWN" {
  if (value === "up" || value === "online") return "UP";
  if (value === "down" || value === "offline") return "DOWN";
  return "UNKNOWN";
}

function requiredText(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`${label} is missing.`);
  return result;
}

function file(name: string, statements: string[]): MigrationFile {
  return {
    name,
    sql: ["PRAGMA foreign_keys = ON;", ...statements, ""].join("\n\n"),
  };
}
