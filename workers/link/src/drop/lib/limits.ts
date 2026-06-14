import type { Identity } from "@kleavox/core";

const MEBIBYTE = 1024 * 1024;
const GIBIBYTE = 1024 * MEBIBYTE;
export const PART_SIZE_BYTES = 10 * MEBIBYTE;
export const UPLOAD_TTL_SECONDS = 30 * 60;
export const GLOBAL_ACTIVE_STORAGE_BYTES = 8 * GIBIBYTE;
const USER_ACTIVE_STORAGE_BYTES = GIBIBYTE;
const GUEST_ACTIVE_STORAGE_BYTES = 100 * MEBIBYTE;

export interface DropPolicy {
  kind: "guest" | "user";
  maxFileBytes: number;
  maxActiveBytes: number;
  retentionOptions: number[];
  maxDownloads: number;
  defaultDownloads: number;
}

export const GUEST_POLICY: DropPolicy = {
  kind: "guest",
  maxFileBytes: 50 * MEBIBYTE,
  maxActiveBytes: GUEST_ACTIVE_STORAGE_BYTES,
  retentionOptions: [60 * 60],
  maxDownloads: 5,
  defaultDownloads: 3,
};

export const USER_POLICY: DropPolicy = {
  kind: "user",
  maxFileBytes: 250 * MEBIBYTE,
  maxActiveBytes: USER_ACTIVE_STORAGE_BYTES,
  retentionOptions: [60 * 60, 6 * 60 * 60, 24 * 60 * 60],
  maxDownloads: 100,
  defaultDownloads: 20,
};

export function policyFor(identity: Identity | null): DropPolicy {
  return identity ? USER_POLICY : GUEST_POLICY;
}

export function normalizeRetention(
  requested: number | undefined,
  policy: DropPolicy,
): number {
  return policy.retentionOptions.includes(requested ?? -1)
    ? requested!
    : policy.retentionOptions.at(-1)!;
}

export function normalizeDownloadLimit(
  requested: number | null | undefined,
  policy: DropPolicy,
): number {
  if (requested === null || requested === undefined) {
    return policy.defaultDownloads;
  }
  return Math.min(Math.max(Math.trunc(requested), 1), policy.maxDownloads);
}

export function expectedPartSize(
  totalBytes: number,
  partNumber: number,
  partCount: number,
): number {
  if (partNumber < 1 || partNumber > partCount) return 0;
  if (partNumber < partCount) return PART_SIZE_BYTES;
  return totalBytes - PART_SIZE_BYTES * (partCount - 1);
}
