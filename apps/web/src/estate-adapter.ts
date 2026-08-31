import { navCountsFrom } from "@kleavox/ui";
import type { NavCounts, Overview } from "@kleavox/ui";
import { permits } from "./machine/state";
import type { AccessRole, BayCode } from "./machine/state";

export type Session = {
  authenticated: boolean;
  identity?: { role?: string };
};

export type MachineModel = {
  access: AccessRole;
  items: { code: BayCode; lit: boolean }[];
  screen: string;
  indicators: NavCounts["indicators"];
};

const CATALOG: BayCode[] = ["1", "2", "3"];
const INDICATOR_KEYS = ["pass", "link", "pulse"] as const;

function accessFor(session: Session): AccessRole {
  if (!session.authenticated || session.identity?.role === undefined) {
    return "guest";
  }
  return session.identity.role === "ADMIN" ? "owner" : "visitor";
}

function itemsFor(access: AccessRole): { code: BayCode; lit: boolean }[] {
  return CATALOG.map((code) => ({ code, lit: permits(access, code) }));
}

function indicatorsFor(
  access: AccessRole,
  overview: Overview | null,
): NavCounts["indicators"] {
  if (overview !== null) return navCountsFrom(overview).indicators;
  if (access === "guest") {
    return { pass: "locked", link: "locked", pulse: "locked" };
  }
  return {
    pass: "unknown",
    link: "unknown",
    pulse: access === "owner" ? "unknown" : "locked",
  };
}

function estateFullyRead(indicators: NavCounts["indicators"]): boolean {
  return INDICATOR_KEYS.every((key) => indicators[key] !== "unknown");
}

function screenFor(access: AccessRole, overview: Overview | null): string {
  if (access === "guest") return "INSERT PASS";
  if (overview === null) return "ESTATE UNREADABLE";
  if (overview.attention.length > 0) {
    return `${overview.attention.length} NEED ATTENTION`;
  }
  return estateFullyRead(navCountsFrom(overview).indicators)
    ? "NOTHING NEEDS YOU"
    : "ESTATE UNREADABLE";
}

export function toMachineModel(
  session: Session,
  overview: Overview | null,
): MachineModel {
  const access = accessFor(session);
  return {
    access,
    items: itemsFor(access),
    screen: screenFor(access, overview),
    indicators: indicatorsFor(access, overview),
  };
}
