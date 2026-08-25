import type { ReactNode } from "react";
import { LINK_ORIGIN, PASS_ORIGIN, PULSE_ORIGIN } from "./origins";
import type { NavCounts, Severity } from "./nav-counts";

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

const ADMIN_ONLY = new Set<string>(["pulse"]);

function padClass(severity: Severity | null): string {
  if (severity === "danger") return "kvx-pad kvx-pad-danger";
  if (severity === "warn") return "kvx-pad kvx-pad-warn";
  return "";
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
        {TOOLS.filter(
          (tool) =>
            !ADMIN_ONLY.has(tool.key) ||
            counts === null ||
            counts === undefined ||
            counts.role === "ADMIN",
        ).map((tool) => {
          const active = current === tool.key;
          const count = counts ? counts[tool.key] : null;
          const severity = counts ? counts.attention[tool.key] : null;
          const name =
            count === null
              ? tool.label
              : `${tool.label}, ${count} ${tool.noun}`;
          return (
            <a
              key={tool.key}
              href={tool.origin}
              className={active ? "kvx-nav-tool is-active" : "kvx-nav-tool"}
              aria-current={active ? "page" : undefined}
              aria-label={name}
            >
              <span aria-hidden="true">{tool.label}</span>
              {!active && count !== null ? (
                <span className="kvx-nav-count" aria-hidden="true">
                  {count}
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
