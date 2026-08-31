import type { ReactNode } from "react";
import { LINK_ORIGIN, PASS_ORIGIN, PULSE_ORIGIN } from "./origins";
import type { Indicator, NavCounts, Severity } from "./nav-counts";

export interface AppHeaderProps {
  product?: string;
  rootOrigin?: string;
  counts?: NavCounts | null;
  children?: ReactNode;
}

const TOOLS = [
  { key: "pass", label: "pass", origin: PASS_ORIGIN, noun: "devices" },
  { key: "link", label: "link", origin: LINK_ORIGIN, noun: "active routes" },
  { key: "pulse", label: "pulse", origin: PULSE_ORIGIN, noun: "nodes" },
] as const;

function padClass(severity: Severity | null): string {
  if (severity === "danger") return "kvx-pad kvx-pad-danger";
  if (severity === "warn") return "kvx-pad kvx-pad-warn";
  return "";
}

function displayFor(indicator: Indicator | undefined): string | null {
  if (indicator === undefined || indicator === "locked") return null;
  if (indicator === "unknown") return "--";
  return String(indicator.count);
}

function severityFor(indicator: Indicator | undefined): Severity | null {
  if (indicator === undefined || indicator === "locked") return null;
  if (indicator === "unknown") return "warn";
  return indicator.severity;
}

function nameFor(
  label: string,
  noun: string,
  indicator: Indicator | undefined,
): string {
  if (indicator === undefined || indicator === "locked") return label;
  if (indicator === "unknown") return `${label}, unknown`;
  return `${label}, ${indicator.count} ${noun}`;
}

export function AppHeader({
  product,
  rootOrigin = "/",
  counts,
  children,
}: AppHeaderProps) {
  const current = product?.toLowerCase();
  return (
    <header className="kvx-header">
      <a className="kvx-brand" href={rootOrigin}>
        kleavox
        {current ? <b>/{current}</b> : null}
      </a>
      <nav className="kvx-nav" aria-label="Kleavox tools">
        {TOOLS.map((tool) => {
          const active = current === tool.key;
          const indicator = counts ? counts.indicators[tool.key] : undefined;
          const display = displayFor(indicator);
          const severity = severityFor(indicator);
          const name = active
            ? tool.label
            : nameFor(tool.label, tool.noun, indicator);
          return (
            <a
              key={tool.key}
              href={tool.origin}
              className={active ? "kvx-nav-tool is-active" : "kvx-nav-tool"}
              aria-current={active ? "page" : undefined}
              aria-label={name}
            >
              <span aria-hidden="true">{tool.label}</span>
              {!active && display !== null ? (
                <span className="kvx-nav-count" aria-hidden="true">
                  {display}
                </span>
              ) : null}
              {!active && severity !== null ? (
                <span className={padClass(severity)} aria-hidden="true" />
              ) : null}
            </a>
          );
        })}
      </nav>
      {children}
    </header>
  );
}
