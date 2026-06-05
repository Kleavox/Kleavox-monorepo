import { createHash } from "node:crypto";

export type Row = Record<string, unknown>;

export function stableId(scope: string, value: unknown): string {
  const bytes = createHash("sha256")
    .update(`zarkiv:${scope}:${String(value)}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

export function sqlValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot encode non-finite SQL number.");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result ? result : null;
}

export function integer(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isSafeInteger(result) ? result : null;
}

export function rowsFromD1Json(value: unknown): Row[] {
  if (!Array.isArray(value)) throw new Error("D1 export must be a JSON array.");
  const hasWranglerEnvelope = value.some(
    (item) => isRow(item) && Array.isArray(item.results),
  );
  if (!hasWranglerEnvelope && value.every(isRow)) return value;

  const rows: Row[] = [];
  for (const result of value) {
    if (!isRow(result) || !Array.isArray(result.results)) continue;
    for (const row of result.results) {
      if (isRow(row)) rows.push(row);
    }
  }
  return rows;
}

export function referrerHost(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return raw.slice(0, 255);
  }
}

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
