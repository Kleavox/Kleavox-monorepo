export { randomToken, sha256Hex as sha256 } from "@kleavox/crypto";

export function readBearerToken(value: string | undefined): string | null {
  if (!value?.startsWith("Bearer ")) return null;
  return value.slice("Bearer ".length).trim() || null;
}
