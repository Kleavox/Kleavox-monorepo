import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RELEASE_SEQUENCE_MS,
  motionDelay,
  rememberRequest,
  runDispense,
  runReaderScan,
  runScreenTransfer,
  takeRememberedRequest,
  type Dispatch,
} from "./sequence";
import {
  initialState,
  reduce,
  type AccessRole,
  type BayCode,
  type MachineEvent,
  type MachineState,
} from "./state";

const REQUEST_KEY = "kvx:machine-request";

function machine(access: AccessRole): {
  dispatch: Dispatch;
  seen: MachineEvent["type"][];
  read: () => MachineState;
} {
  let state = initialState(access);
  const seen: MachineEvent["type"][] = [];
  const dispatch: Dispatch = (event) => {
    seen.push(event.type);
    state = reduce(state, event);
    return state;
  };
  return { dispatch, seen, read: () => state };
}

function reduceMotion(reduced: boolean): void {
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("motionDelay", () => {
  it("shortens but never skips when motion is reduced", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const started = Date.now();
    await motionDelay(900);
    expect(Date.now() - started).toBeLessThan(200);
  });

  it("waits the whole duration when motion is not reduced", async () => {
    reduceMotion(false);
    vi.useFakeTimers();
    let settled = false;
    const waiting = motionDelay(900).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(880);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(40);
    await waiting;
    expect(settled).toBe(true);
  });

  it("resolves at once when the wait is aborted", async () => {
    reduceMotion(false);
    const controller = new AbortController();
    const started = Date.now();
    const waiting = motionDelay(900, controller.signal);
    controller.abort();
    await waiting;
    expect(Date.now() - started).toBeLessThan(200);
  });
});

describe("remembering a locked request across a redirect", () => {
  it("hands the bay back exactly once", () => {
    rememberRequest("2");
    expect(takeRememberedRequest()).toBe("2");
    expect(takeRememberedRequest()).toBeNull();
  });

  it("returns null when nothing was remembered", () => {
    expect(takeRememberedRequest()).toBeNull();
  });

  it("survives a page load because it lives in sessionStorage", () => {
    rememberRequest("3");
    expect(sessionStorage.getItem(REQUEST_KEY)).toBe("3");
    expect(takeRememberedRequest()).toBe("3");
    expect(sessionStorage.getItem(REQUEST_KEY)).toBeNull();
  });

  it("refuses a stored value that is not a bay, and clears it", () => {
    sessionStorage.setItem(REQUEST_KEY, "9");
    expect(takeRememberedRequest()).toBeNull();
    expect(sessionStorage.getItem(REQUEST_KEY)).toBeNull();
  });

  it("says the request was kept when storage takes it", () => {
    expect(rememberRequest("1")).toBe(true);
  });

  it("says the request was lost, rather than throwing, when storage refuses", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("storage is blocked");
      },
      setItem: () => {
        throw new Error("storage is blocked");
      },
      removeItem: () => {
        throw new Error("storage is blocked");
      },
    });
    expect(rememberRequest("1")).toBe(false);
    expect(takeRememberedRequest()).toBeNull();
  });
});

describe("the release sequence", () => {
  it("selects the bay, waits, then lands it in the tray", async () => {
    reduceMotion(true);
    const { dispatch, seen, read } = machine("owner");
    await runDispense(dispatch, "2");
    expect(seen).toEqual(["select", "tray-ready"]);
    expect(read().tray).toBe("2");
    expect(read().busy).toBe(false);
  });

  it("never lands a locked bay in the tray", async () => {
    reduceMotion(true);
    const { dispatch, seen, read } = machine("guest");
    await runDispense(dispatch, "1");
    expect(seen).toEqual(["select"]);
    expect(read().tray).toBeNull();
    expect(read().status).toBe("denied");
  });

  it("shortens under reduced motion without dropping a state change", async () => {
    reduceMotion(true);
    const { dispatch, seen, read } = machine("visitor");
    const started = Date.now();
    await runDispense(dispatch, "1");
    expect(Date.now() - started).toBeLessThan(RELEASE_SEQUENCE_MS);
    expect(seen).toEqual(["select", "tray-ready"]);
    expect(read().tray).toBe("1");
  });
});

describe("the reader scan", () => {
  it("holds the machine in reading, then opens the terminal", async () => {
    reduceMotion(true);
    const { dispatch, seen, read } = machine("guest");
    const scanning = runReaderScan(dispatch);
    expect(read().status).toBe("reading");
    await scanning;
    expect(seen).toEqual(["pass-tap", "reader-scanned"]);
    expect(read().authStep).toBe("methods");
  });

  it("does nothing for a machine that already holds a pass", async () => {
    reduceMotion(true);
    const { dispatch, seen, read } = machine("owner");
    await runReaderScan(dispatch);
    expect(seen).toEqual(["pass-tap"]);
    expect(read().status).toBe("idle");
  });
});

describe("the cartridge to screen bridge", () => {
  it("opens the bridge and then leaves for the application", async () => {
    reduceMotion(true);
    const { dispatch, seen, read } = machine("owner");
    await runDispense(dispatch, "2");
    const left: BayCode[] = [];
    await runScreenTransfer(dispatch, (bay) => left.push(bay));
    expect(seen).toEqual(["select", "tray-ready", "activate-tray"]);
    expect(left).toEqual(["2"]);
    expect(read().screenTransfer).toBe("2");
  });

  it("cancelling mid bridge leaves the machine where it was", async () => {
    reduceMotion(false);
    const { dispatch, read } = machine("owner");
    await runDispense(dispatch, "2");
    const left: BayCode[] = [];
    const controller = new AbortController();
    const bridging = runScreenTransfer(
      dispatch,
      (bay) => left.push(bay),
      controller.signal,
    );
    expect(read().screenTransfer).toBe("2");
    controller.abort();
    await bridging;
    expect(left).toEqual([]);
    expect(read().screenTransfer).toBeNull();
    expect(read().busy).toBe(false);
  });

  it("cancels the same way when motion is reduced", async () => {
    reduceMotion(true);
    const { dispatch, read } = machine("owner");
    await runDispense(dispatch, "2");
    const left: BayCode[] = [];
    const controller = new AbortController();
    const bridging = runScreenTransfer(
      dispatch,
      (bay) => left.push(bay),
      controller.signal,
    );
    controller.abort();
    await bridging;
    expect(left).toEqual([]);
    expect(read().screenTransfer).toBeNull();
  });

  it("does not open a bridge from an empty tray", async () => {
    reduceMotion(true);
    const { dispatch, seen, read } = machine("owner");
    const left: BayCode[] = [];
    await runScreenTransfer(dispatch, (bay) => left.push(bay));
    expect(seen).toEqual(["activate-tray"]);
    expect(left).toEqual([]);
    expect(read().screenTransfer).toBeNull();
  });
});
