import type { BayCode, MachineEvent, MachineState } from "./state";

export type Dispatch = (event: MachineEvent) => MachineState;

const MECHANICAL_MOVE_MS = 900;
export const RELEASE_SEQUENCE_MS = 1400;
const REDUCED_MOTION_MS = 40;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const REQUEST_KEY = "kvx:machine-request";
const BAY_CODES: readonly BayCode[] = ["1", "2", "3"];

function prefersReducedMotion(): boolean {
  try {
    return globalThis.matchMedia(REDUCED_MOTION_QUERY).matches;
  } catch {
    return false;
  }
}

export function motionDelay(ms: number, signal?: AbortSignal): Promise<void> {
  const wait = prefersReducedMotion() ? Math.min(ms, REDUCED_MOTION_MS) : ms;
  return new Promise((resolve) => {
    if (signal?.aborted === true) {
      resolve();
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = (): void => {
      clearTimeout(timer);
      resolve();
    };
    timer = setTimeout(() => {
      signal?.removeEventListener("abort", stop);
      resolve();
    }, wait);
    signal?.addEventListener("abort", stop, { once: true });
  });
}

export function rememberRequest(bay: BayCode): boolean {
  try {
    globalThis.sessionStorage.setItem(REQUEST_KEY, bay);
    return true;
  } catch {
    return false;
  }
}

export function takeRememberedRequest(): BayCode | null {
  try {
    const stored = globalThis.sessionStorage.getItem(REQUEST_KEY);
    globalThis.sessionStorage.removeItem(REQUEST_KEY);
    return BAY_CODES.find((code) => code === stored) ?? null;
  } catch {
    return null;
  }
}

export async function runReaderScan(dispatch: Dispatch): Promise<void> {
  const reading = dispatch({ type: "pass-tap" });
  if (reading.status !== "reading") return;
  await motionDelay(MECHANICAL_MOVE_MS);
  dispatch({ type: "reader-scanned" });
}

export async function runDispense(
  dispatch: Dispatch,
  bay: BayCode,
): Promise<void> {
  const releasing = dispatch({ type: "select", bay });
  if (releasing.status !== "dispensing") return;
  await motionDelay(RELEASE_SEQUENCE_MS);
  dispatch({ type: "tray-ready" });
}

export async function runScreenTransfer(
  dispatch: Dispatch,
  navigate: (bay: BayCode) => void,
  signal?: AbortSignal,
): Promise<void> {
  const bridging = dispatch({ type: "activate-tray" });
  const bay = bridging.screenTransfer;
  if (bay === null) return;
  await motionDelay(RELEASE_SEQUENCE_MS, signal);
  if (signal?.aborted === true) {
    dispatch({ type: "cancel" });
    return;
  }
  navigate(bay);
}
