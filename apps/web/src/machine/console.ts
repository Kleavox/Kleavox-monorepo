import { toMachineModel } from "../estate-adapter";
import { render } from "./render";
import { initialState, reduce } from "./state";
import type { MachineEvent, MachineState } from "./state";

const SHEET_QUERY = "(max-width: 760px)";

type MachineHost = {
  read: () => MachineState;
  dispatch: (event: MachineEvent) => MachineState;
};

function guestHost(root: ParentNode): MachineHost {
  const model = toMachineModel({ authenticated: false }, null);
  let current = initialState("guest");
  return {
    read: () => current,
    dispatch: (event) => {
      current = reduce(current, event);
      render(root, current, model);
      return current;
    },
  };
}

export function mountConsole(root: ParentNode, host?: MachineHost): void {
  const panel = root.querySelector<HTMLElement>("[data-console]");
  const dock = root.querySelector<HTMLButtonElement>("[data-dock]");
  if (!panel || !dock) return;

  const scrim = root.querySelector<HTMLElement>("[data-scrim]");
  const closer = root.querySelector<HTMLButtonElement>("[data-console-close]");
  const reader = root.querySelector<HTMLElement>("[data-reader]");
  const terminal = root.querySelector<HTMLDialogElement>("[data-terminal]");
  const sheet = window.matchMedia(SHEET_QUERY);
  const machine = host ?? guestHost(root);

  const setOpen = (open: boolean): void => {
    const next = machine.dispatch({ type: "console", open });
    if (next.consoleLayout !== "sheet") return;
    if (next.consoleOpen) {
      window.requestAnimationFrame(() =>
        reader?.focus({ preventScroll: true }),
      );
      return;
    }
    dock.focus({ preventScroll: true });
  };

  const syncLayout = (): void => {
    const kept = panel.contains(document.activeElement);
    const next = machine.dispatch({
      type: "console-layout",
      layout: sheet.matches ? "sheet" : "column",
    });
    const open = next.consoleLayout === "column" || next.consoleOpen;
    if (!open && kept) dock.focus({ preventScroll: true });
  };

  dock.addEventListener("click", () => setOpen(true));
  closer?.addEventListener("click", () => setOpen(false));
  scrim?.addEventListener("click", () => setOpen(false));
  sheet.addEventListener("change", syncLayout);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (terminal?.open === true) return;
    const state = machine.read();
    if (state.consoleLayout !== "sheet" || !state.consoleOpen) return;
    event.preventDefault();
    setOpen(false);
  });

  syncLayout();
}

export function mountTerminal(root: ParentNode): void {
  const terminal = root.querySelector<HTMLDialogElement>("[data-terminal]");
  if (!terminal) return;

  for (const opener of root.querySelectorAll<HTMLButtonElement>(
    "[data-terminal-open]",
  )) {
    opener.addEventListener("click", () => {
      if (!terminal.open) terminal.showModal();
    });
  }

  for (const closer of root.querySelectorAll<HTMLButtonElement>(
    "[data-terminal-close]",
  )) {
    closer.addEventListener("click", () => terminal.close());
  }
}
