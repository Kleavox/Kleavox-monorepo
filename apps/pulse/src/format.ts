import type { NodeRecord } from "./types";

export function nodeState(node: NodeRecord): "pending" | "online" | "offline" {
  if (!node.enrolled_at) return "pending";
  if (!node.last_seen_at) return "offline";
  const grace = Math.max(90, node.interval_seconds * 3) * 1000;
  return Date.now() - parseTimestamp(node.last_seen_at) <= grace
    ? "online"
    : "offline";
}

export function percentage(
  used: number | null,
  total: number | null,
): number | null {
  if (used === null || total === null || total <= 0) return null;
  return (used / total) * 100;
}

export function relativeTime(value: string | null): string {
  if (!value) return "Never";
  const seconds = Math.round((parseTimestamp(value) - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  return formatter.format(hours, "hour");
}

function parseTimestamp(value: string): number {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  return Date.parse(normalized);
}
