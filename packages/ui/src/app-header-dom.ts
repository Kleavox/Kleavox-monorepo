import { LINK_ORIGIN, PASS_ORIGIN, PULSE_ORIGIN } from "./origins";
import type { NavCounts } from "./nav-counts";
import { displayFor, nameFor, padClass, severityFor } from "./indicator-view";

const TOOLS = [
  { key: "pass", label: "pass", origin: PASS_ORIGIN, noun: "devices" },
  { key: "link", label: "link", origin: LINK_ORIGIN, noun: "active routes" },
  { key: "pulse", label: "pulse", origin: PULSE_ORIGIN, noun: "nodes" },
] as const;

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
    const active = current === tool.key;
    const indicator = counts ? counts.indicators[tool.key] : undefined;
    const display = displayFor(indicator);
    const severity = severityFor(indicator);
    const name = active
      ? tool.label
      : nameFor(tool.label, tool.noun, indicator);

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
      pad.className = padClass(severity);
      pad.setAttribute("aria-hidden", "true");
      link.append(pad);
    }

    nav.append(link);
  }

  target.append(nav);
}
