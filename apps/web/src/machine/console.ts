const SHEET_QUERY = "(max-width: 760px)";

export function mountConsole(root: ParentNode): void {
  const panel = root.querySelector<HTMLElement>("[data-console]");
  const dock = root.querySelector<HTMLButtonElement>("[data-dock]");
  if (!panel || !dock) return;

  const scrim = root.querySelector<HTMLElement>("[data-scrim]");
  const closer = root.querySelector<HTMLButtonElement>("[data-console-close]");
  const reader = root.querySelector<HTMLElement>("[data-reader]");
  const terminal = root.querySelector<HTMLDialogElement>("[data-terminal]");
  const sheet = window.matchMedia(SHEET_QUERY);

  let opened = false;

  const isOpen = (): boolean => opened;

  const project = (open: boolean): void => {
    panel.dataset.console = open ? "open" : "closed";
    dock.setAttribute("aria-expanded", String(open));
    panel.setAttribute("aria-hidden", String(!open));
    panel.toggleAttribute("inert", !open);
    scrim?.setAttribute("aria-hidden", String(!open));
  };

  const setOpen = (open: boolean): void => {
    if (!sheet.matches) return;
    opened = open;
    project(open);
    if (open) {
      window.requestAnimationFrame(() =>
        reader?.focus({ preventScroll: true }),
      );
      return;
    }
    dock.focus({ preventScroll: true });
  };

  const syncLayout = (): void => {
    project(sheet.matches ? isOpen() : true);
  };

  dock.addEventListener("click", () => setOpen(true));
  closer?.addEventListener("click", () => setOpen(false));
  scrim?.addEventListener("click", () => setOpen(false));
  sheet.addEventListener("change", syncLayout);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (terminal?.open === true) return;
    if (!sheet.matches || !isOpen()) return;
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
