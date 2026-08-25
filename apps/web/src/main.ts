import { displayHandle } from "@kleavox/core";
import "@kleavox/ui/styles.css";
import "./styles/global.css";
import {
  formatAge,
  navCountsFrom,
  plural,
  renderAppHeader,
  renderStatusLine,
  LINK_ORIGIN,
  PASS_ORIGIN,
  PULSE_ORIGIN,
  type AttentionItem,
  type NavCounts,
  type Overview,
  type StatusLineModel,
} from "@kleavox/ui";

const STATE_WORD: Record<AttentionItem["kind"], string> = {
  "node-down": "down",
  "check-failing": "failing",
  "abuse-report": "open",
  "link-expiring": "expiring",
};

const TOOL_OF: Record<AttentionItem["kind"], string> = {
  "node-down": "pulse",
  "check-failing": "pulse",
  "abuse-report": "pulse",
  "link-expiring": "link",
};

interface ToolDef {
  key: "pass" | "link" | "pulse";
  label: string;
  href: string;
  detail: (overview: Overview) => string;
}

function passDetail(overview: Overview): string {
  const { devices } = overview.pass;
  return `${devices} ${plural(devices, "device", "devices")}`;
}

function linkDetail(overview: Overview): string {
  const { active, files, reported } = overview.link;
  return [
    `${active} ${plural(active, "route", "routes")}`,
    `${files} ${plural(files, "file", "files")}`,
    `${reported} reported`,
  ].join(" · ");
}

function pulseDetail(overview: Overview): string {
  const { nodes, checksFailing, openIncidents } = overview.pulse;
  return [
    `${nodes} ${plural(nodes, "node", "nodes")}`,
    `${checksFailing} ${plural(checksFailing, "check failing", "checks failing")}`,
    `${openIncidents} ${plural(openIncidents, "incident", "incidents")}`,
  ].join(" · ");
}

const TOOLS: ToolDef[] = [
  { key: "pass", label: "Pass", href: PASS_ORIGIN, detail: passDetail },
  { key: "link", label: "Link", href: LINK_ORIGIN, detail: linkDetail },
  { key: "pulse", label: "Pulse", href: PULSE_ORIGIN, detail: pulseDetail },
];

const DEFAULT_COUNTS: NavCounts = {
  role: "USER",
  pass: 0,
  link: 0,
  pulse: 0,
  attention: { pass: null, link: null, pulse: null },
};

const headerTarget = document.querySelector<HTMLElement>("[data-app-header]");
const headerAccountTemplate = document.querySelector<HTMLTemplateElement>(
  "[data-header-account]",
);
const accountNode =
  headerAccountTemplate?.content.firstElementChild instanceof HTMLElement
    ? (headerAccountTemplate.content.firstElementChild.cloneNode(
        true,
      ) as HTMLElement)
    : null;

function paintHeader(counts: NavCounts): void {
  if (!headerTarget) return;
  renderAppHeader(headerTarget, { counts });
  if (accountNode) headerTarget.append(accountNode);
}

paintHeader(DEFAULT_COUNTS);

const account =
  accountNode?.matches("[data-account]") === true
    ? accountNode
    : (accountNode?.querySelector<HTMLElement>("[data-account]") ?? null);
const signIn = accountNode?.querySelector<HTMLElement>("[data-signin]") ?? null;
const menu =
  accountNode?.querySelector<HTMLElement>("[data-account-menu]") ?? null;
const trigger =
  accountNode?.querySelector<HTMLButtonElement>("[data-account-trigger]") ??
  null;
const dropdown =
  accountNode?.querySelector<HTMLElement>("[data-account-dropdown]") ?? null;
const name =
  accountNode?.querySelector<HTMLElement>("[data-account-name]") ?? null;
const logout =
  accountNode?.querySelector<HTMLButtonElement>("[data-logout]") ?? null;

const closeMenu = () => {
  dropdown?.setAttribute("hidden", "");
  trigger?.setAttribute("aria-expanded", "false");
};

trigger?.addEventListener("click", (event) => {
  event.stopPropagation();
  const open = trigger.getAttribute("aria-expanded") === "true";
  if (open) {
    closeMenu();
  } else {
    dropdown?.removeAttribute("hidden");
    trigger.setAttribute("aria-expanded", "true");
  }
});

dropdown?.addEventListener("click", (event) => event.stopPropagation());
window.addEventListener("click", closeMenu);

logout?.addEventListener("click", async () => {
  try {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
  } finally {
    window.location.reload();
  }
});

function renderSignedOut(): void {
  const main = document.querySelector<HTMLElement>("main.kvx-main");
  if (!main) return;
  main.replaceChildren();
  const link = document.createElement("a");
  link.className = "kvx-button kvx-button-primary";
  link.href = signIn?.getAttribute("href") ?? "/";
  link.textContent = "Sign in to Kleavox";
  main.append(link);
}

function homeModel(overview: Overview): StatusLineModel {
  const waiting = overview.attention.length;
  const lead =
    waiting > 0
      ? {
          value: String(waiting),
          label: plural(waiting, "needs attention", "need attention"),
          attention: true,
        }
      : { value: "nothing", label: "needs you" };
  return {
    tool: "kleavox",
    fields: [
      lead,
      {
        value: String(overview.link.active),
        label: plural(overview.link.active, "route", "routes"),
      },
      {
        value: String(overview.pulse.nodes),
        label: plural(overview.pulse.nodes, "node", "nodes"),
      },
      {
        value: String(overview.pass.devices),
        label: plural(overview.pass.devices, "device", "devices"),
      },
    ],
  };
}

function attentionRow(item: AttentionItem): HTMLLIElement {
  const row = document.createElement("li");
  const link = document.createElement("a");
  link.href = item.href;

  const pad = document.createElement("span");
  pad.className =
    item.severity === "danger"
      ? "kvx-pad kvx-pad-danger"
      : "kvx-pad kvx-pad-warn";
  pad.setAttribute("aria-hidden", "true");

  const state = document.createElement("span");
  state.className = "kvx-row-state";
  state.textContent = STATE_WORD[item.kind];

  const title = document.createElement("span");
  title.className = "kvx-row-title";
  title.textContent = item.title;
  const detail = document.createElement("small");
  detail.className = "kvx-row-detail";
  detail.textContent = item.detail;
  title.append(detail);

  const age = document.createElement("span");
  age.className = "kvx-row-age";
  age.textContent = formatAge(item.since);

  const tool = document.createElement("span");
  tool.className = "kvx-row-tool";
  tool.textContent = TOOL_OF[item.kind];

  link.append(pad, state, title, age, tool);
  row.append(link);
  return row;
}

function toolRow(tool: ToolDef, overview: Overview): HTMLLIElement {
  const row = document.createElement("li");
  const link = document.createElement("a");
  link.href = tool.href;
  link.className = "kvx-row-compact";

  const title = document.createElement("span");
  title.className = "kvx-row-title";
  title.textContent = tool.label;
  const detail = document.createElement("small");
  detail.className = "kvx-row-detail";
  detail.textContent = tool.detail(overview);
  title.append(detail);

  link.append(title);
  row.append(link);
  return row;
}

function renderTools(overview: Overview): void {
  const target = document.querySelector<HTMLElement>("[data-tools]");
  if (!target) return;
  const counts = navCountsFrom(overview);
  const rows = TOOLS.filter(
    (tool) => tool.key !== "pulse" || counts.role === "ADMIN",
  ).map((tool) => toolRow(tool, overview));
  target.replaceChildren(...rows);
}

function renderHome(overview: Overview): void {
  const statusTarget =
    document.querySelector<HTMLElement>("[data-status-line]");
  if (statusTarget) renderStatusLine(statusTarget, homeModel(overview));

  const section = document.querySelector<HTMLElement>("[data-attention]");
  const rows = document.querySelector<HTMLElement>("[data-attention-rows]");
  const count = document.querySelector<HTMLElement>("[data-attention-count]");
  if (!section || !rows || !count) return;

  if (overview.attention.length === 0) {
    section.setAttribute("hidden", "");
    return;
  }

  count.textContent = String(overview.attention.length);
  rows.replaceChildren(...overview.attention.map(attentionRow));
  section.removeAttribute("hidden");
}

function reportHomeFailure(reason: string): void {
  const status = document.querySelector<HTMLElement>("[data-home-status]");
  const section = document.querySelector<HTMLElement>("[data-attention]");
  section?.setAttribute("hidden", "");
  if (!status) return;
  status.className = "kvx-error-state";
  status.replaceChildren();
  const message = document.createElement("p");
  message.textContent = `Kleavox could not read your estate: ${reason}`;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "kvx-button kvx-button-secondary";
  retry.textContent = "Try again";
  retry.addEventListener("click", () => {
    void loadHome();
  });
  status.append(message, retry);
}

async function loadHome(): Promise<void> {
  try {
    const response = await fetch("/api/estate", { credentials: "include" });
    if (!response.ok) {
      reportHomeFailure(`the server answered ${response.status}`);
      return;
    }
    const overview = (await response.json()) as Overview;
    document.querySelector("[data-home-status]")?.replaceChildren();
    renderHome(overview);
    renderTools(overview);
    paintHeader(navCountsFrom(overview));
  } catch {
    reportHomeFailure("the request did not complete");
  }
}

fetch("/api/session", { credentials: "include" })
  .then((response) =>
    response.ok ? response.json() : { authenticated: false },
  )
  .then(
    (data: {
      authenticated: boolean;
      identity?: { username?: string; email?: string; role?: string };
    }) => {
      if (!data.authenticated || !data.identity) {
        renderSignedOut();
        return;
      }
      if (name) {
        name.textContent = displayHandle(
          data.identity.username,
          data.identity.email,
        );
      }
      signIn?.setAttribute("hidden", "");
      menu?.removeAttribute("hidden");
      account?.classList.add("is-authenticated");
      if (data.identity.role === "ADMIN") {
        document
          .querySelectorAll("[data-pulse-only]")
          .forEach((element) => element.removeAttribute("hidden"));
      }
      void loadHome();
    },
  )
  .catch(() => {
    renderSignedOut();
  });
