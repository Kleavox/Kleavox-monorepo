import { afterEach, describe, expect, it, vi } from "vitest";
import { mountConsole, type MachineHost } from "./console";
import { initialState, reduce, type MachineEvent } from "./state";

function store(): { host: MachineHost; seen: MachineEvent[] } {
  let state = initialState("guest");
  const seen: MachineEvent[] = [];
  return {
    seen,
    host: {
      read: () => state,
      dispatch: (event) => {
        seen.push(event);
        state = reduce(state, event);
        return state;
      },
    },
  };
}

function media(sheet: boolean): void {
  vi.stubGlobal("matchMedia", () => ({
    matches: sheet,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mountConsole", () => {
  it("tells the store the layout before anything can render the default", () => {
    media(false);
    const root = document.createElement("div");
    root.innerHTML = `
      <aside data-console="closed"><button data-console-close></button></aside>
      <button data-dock aria-expanded="false"></button>`;
    const { host, seen } = store();
    mountConsole(root, host);
    expect(seen[0]).toEqual({ type: "console-layout", layout: "column" });
    expect(host.read().consoleLayout).toBe("column");
  });

  it("still reports the layout when there is no dock to hang the console on", () => {
    media(false);
    const root = document.createElement("div");
    root.innerHTML = `<aside data-console="closed"></aside>`;
    const { host, seen } = store();
    mountConsole(root, host);
    expect(seen).toContainEqual({ type: "console-layout", layout: "column" });
    expect(host.read().consoleLayout).toBe("column");
  });

  it("reports the sheet layout on a narrow viewport", () => {
    media(true);
    const root = document.createElement("div");
    root.innerHTML = `<aside data-console="closed"></aside>`;
    const { host, seen } = store();
    mountConsole(root, host);
    expect(seen).toContainEqual({ type: "console-layout", layout: "sheet" });
    expect(host.read().consoleLayout).toBe("sheet");
  });
});
