import { LINK_ORIGIN, PASS_ORIGIN, PULSE_ORIGIN } from "./origins";
import type { NavCounts, Severity } from "./nav-counts";

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

export function renderAppHeader(
  target: HTMLElement,
  options: { product?: string; rootOrigin?: string; counts?: NavCounts | null },
): void {
  const { product, rootOrigin = "/", counts } = options;
  const current = product?.toLowerCase();

  target.className = "kvx-header";
  target.replaceChildren();

  const brand = document.createElement("a");
  brand.className = "kvx-brand";
  brand.href = rootOrigin;
  brand.append("kleavox");
  if (current) {
    const b = document.createElement("b");
    b.textContent = `/${current}`;
    brand.append(b);
  }
  target.append(brand);

  const nav = document.createElement("nav");
  nav.className = "kvx-nav";
  nav.setAttribute("aria-label", "Kleavox tools");

  for (const tool of TOOLS) {
    if (
      ADMIN_ONLY.has(tool.key) &&
      counts !== null &&
      counts !== undefined &&
      counts.role !== "ADMIN"
    ) {
      continue;
    }

    const active = current === tool.key;
    const raw = counts ? counts[tool.key] : undefined;
    const display =
      raw === undefined ? null : raw === null ? "--" : String(raw);
    const severity = counts ? counts.attention[tool.key] : null;
    const name =
      active || raw === undefined
        ? tool.label
        : raw === null
          ? `${tool.label}, unknown`
          : `${tool.label}, ${raw} ${tool.noun}`;

    const link = document.createElement("a");
    link.href = tool.origin;
    link.className = active ? "kvx-nav-tool is-active" : "kvx-nav-tool";
    if (active) link.setAttribute("aria-current", "page");
    link.setAttribute("aria-label", name);

    const labelSpan = document.createElement("span");
    labelSpan.setAttribute("aria-hidden", "true");
    labelSpan.textContent = tool.label;
    link.append(labelSpan);

    if (!active && display !== null) {
      const countSpan = document.createElement("span");
      countSpan.className = "kvx-nav-count";
      countSpan.setAttribute("aria-hidden", "true");
      countSpan.textContent = display;
      link.append(countSpan);
    }

    if (!active && severity !== null) {
      const pad = document.createElement("span");
      const className = padClass(severity);
      if (className) pad.className = className;
      pad.setAttribute("aria-hidden", "true");
      link.append(pad);
    }

    nav.append(link);
  }

  target.append(nav);
}
