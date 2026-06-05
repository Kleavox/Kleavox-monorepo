export type CheckKind = "HTTP" | "TCP" | "SERVICE";
export type CheckStatus = "UP" | "DOWN";

export function validateCheckTarget(
  kind: CheckKind,
  target: string,
): string | null {
  const value = target.trim();
  if (kind === "HTTP") {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:"
        ? url.href
        : null;
    } catch {
      return null;
    }
  }

  if (kind === "TCP") {
    const match = /^([a-zA-Z0-9.-]+):([0-9]{1,5})$/u.exec(value);
    if (!match) return null;
    const port = Number(match[2]);
    return port >= 1 && port <= 65_535 ? value.toLowerCase() : null;
  }

  return /^[a-zA-Z0-9@_.:-]{1,128}$/u.test(value) ? value : null;
}

export function nextFailureCount(
  previous: number,
  status: CheckStatus,
): number {
  return status === "UP" ? 0 : previous + 1;
}

export function shouldOpenIncident(
  status: CheckStatus,
  failureCount: number,
): boolean {
  return status === "DOWN" && failureCount === 2;
}

export function shouldResolveIncident(
  previousStatus: string,
  status: CheckStatus,
): boolean {
  return previousStatus === "DOWN" && status === "UP";
}
