import { isReservedSlug } from "@zarkiv/core";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,49}$/;
const RANDOM_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidSlug(value: string): boolean {
  const slug = normalizeSlug(value);
  return SLUG_PATTERN.test(slug) && !isReservedSlug(slug);
}

export function generateSlug(length = 7): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(
    bytes,
    (byte) => RANDOM_ALPHABET[byte % RANDOM_ALPHABET.length],
  ).join("");
}
