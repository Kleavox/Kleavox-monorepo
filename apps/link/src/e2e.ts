import { randomToken } from "@kleavox/crypto";

export const dropKeyStorageKey = (token: string) => `kleavox_drop_key:${token}`;

export function generateDropKey(): string {
  return randomToken(32);
}

export function encryptedShareUrl(shareUrl: string, key: string): string {
  return `${shareUrl}#${key}`;
}

export function dropKeyFromHash(hash: string): string {
  return hash.startsWith("#") ? hash.slice(1) : hash;
}
